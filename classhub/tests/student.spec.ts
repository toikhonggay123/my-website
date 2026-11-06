import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, request, test, type APIRequestContext } from '@playwright/test'

// Authenticated QA server with an isolated D1. The fourth owner invitation belongs to this scenario.
const origin = 'http://127.0.0.1:5175'
const password = 'Local-QA-Only-2026!'
const slug = 'anh-duong-qa'
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())
const plus = (date: string, days: number) => new Date(Date.parse(date) + days * 86_400_000).toISOString().slice(0, 10)
const weekdayOf = (date: string) => new Date(date + 'T00:00:00Z').getUTCDay() || 7

async function call<T = any>(client: APIRequestContext, path: string, options: { data?: unknown; method?: string; status?: number } = {}) {
  const method = options.method ?? (options.data === undefined ? 'GET' : 'POST')
  const response = await client.fetch(path, {
    method, ...(method === 'GET' ? {} : { headers: { Origin: origin, 'Content-Type': 'application/json' }, data: options.data ?? {} }),
  })
  const json = await response.json().catch(() => null)
  expect(response.status(), method + ' ' + path + ' ' + (json?.error?.message ?? '')).toBe(options.status ?? 200)
  return json as T & { data: any }
}
async function activate(client: APIRequestContext, email: string, code: string, name: string, organization?: object) {
  await call(client, '/api/v1/activate', { data: { code, email, name, password }, status: 201 })
  await call(client, '/api/auth/sign-in/email', { data: { email, password } })
  return (await call(client, '/api/v1/accept-invitation', { data: { code, ...(organization ? { organization } : {}) }, status: 201 })).data.orgId as string
}

test('students read the published school timetable, closures and cancelled shifts without signing in', async ({ browser, page }) => {
  const invites = JSON.parse(readFileSync(join('.wrangler', 'qa-' + process.env.CLASSHUB_QA_ID, 'owners.json'), 'utf8')) as { email: string; code: string }[]
  const owner = page.request
  const org = await activate(owner, invites[3].email, invites[3].code, 'Hiệu trưởng Ánh Dương', { name: 'THCS Ánh Dương (hư cấu)', type: 'school' })
  const scope = '/api/v1/orgs/' + org
  const date = today()
  const branch = (await call(owner, scope + '/branches')).data[0].id
  const classes: Record<string, string> = {}
  for (const name of ['8A', '8B']) {
    classes[name] = (await call(owner, scope + '/classes', { data: {
      code: 'AD-' + name, name, branch_id: branch, starts_on: plus(date, -10), ends_on: plus(date, 200), capacity: 45,
    }, status: 201 })).data.id
  }
  await call(owner, scope + '/classes/' + classes['8A'] + '/enrollments', { data: { student: { code: 'AD-HS', name: 'Học Sinh Riêng Tư' } }, status: 201 })
  await call(owner, scope + '/school/terms', { data: { name: 'HK Ánh Dương', starts_on: plus(date, -10), ends_on: plus(date, 120) }, status: 201 })
  await call(owner, scope + '/school/subjects/defaults', { data: {}, status: 201 })
  const setup = (await call(owner, scope + '/school/setup')).data
  await call(owner, scope + '/school/bells', { method: 'PUT', data: { periods: setup.default_bells } })
  const subjectId = (name: string) => setup.subjects.find((row: { name: string }) => row.name === name).id
  const homeroom = await request.newContext({ baseURL: origin })
  try {
    const code = (await call(owner, scope + '/invitations', { data: { email: 'gvcn-ad@example.test', role: 'teacher', branch_id: null }, status: 201 })).data.code
    await activate(homeroom, 'gvcn-ad@example.test', code, 'Thầy Chủ Nhiệm Bí Mật')
  } finally { await homeroom.dispose() }
  const teacher = (await call(owner, scope + '/school/teachers')).data[0].id
  await call(owner, scope + '/school/classes/' + classes['8A'] + '/homeroom', { method: 'PUT', data: { user_id: teacher } })
  const term = setup.terms[0].id
  await call(owner, scope + '/school/terms/' + term + '/assignments', { method: 'PUT', data: {
    class_id: classes['8A'], subject_id: subjectId('Toán'), user_id: teacher } })
  const draft = (await call(owner, scope + '/school/terms/' + term + '/timetable/draft', { data: {}, status: 201 })).data.id
  await call(owner, scope + '/school/timetable/' + draft + '/classes/' + classes['8A'], { method: 'PUT', data: { slots: [
    { weekday: 1, shift: 'morning', period: 1, subject_id: subjectId('Chào cờ'), room: '' },
    { weekday: 1, shift: 'morning', period: 2, subject_id: subjectId('Toán'), room: 'P.8A' },
    { weekday: 2, shift: 'afternoon', period: 1, subject_id: subjectId('Tiếng Anh'), room: 'P.Ngoại ngữ' },
  ] } })
  await call(owner, scope + '/school/timetable/' + draft + '/classes/' + classes['8B'], { method: 'PUT', data: { slots: [
    { weekday: 1, shift: 'morning', period: 1, subject_id: subjectId('Chào cờ'), room: '' },
  ] } })
  await call(owner, scope + '/school/timetable/' + draft + '/publish', { data: { effective_from: date } })

  // Nothing is public until the owner opts in.
  const anonymous = await request.newContext({ baseURL: origin })
  const student = await browser.newContext({ baseURL: origin, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  try {
    expect((await call(anonymous, '/api/v1/public/timetable?truong=' + slug)).data).toEqual({ enabled: false })
    await page.goto('/w/' + org + '/thiet-lap')
    await page.getByLabel('Tên ngắn trong link').fill(slug)
    await page.getByRole('button', { name: 'Công bố trang học sinh' }).click()
    await expect(page.getByText('Đã công bố trang học sinh.')).toBeVisible()
    const link = await page.getByLabel('Link cho học sinh').inputValue()
    expect(link).toBe(origin + '/hs?truong=' + slug)

    // Next Monday and Tuesday are inside the published timetable whatever weekday the test runs on.
    const nextMonday = plus(date, 8 - weekdayOf(date))
    const nextTuesday = plus(nextMonday, 1)
    const response = (await call(anonymous, '/api/v1/public/timetable?truong=' + slug + '&lop=8a&tuan=' + nextMonday)).data
    expect(response.classes.map((row: { id: string }) => row.id)).toEqual(['8a', '8b'])
    expect(response.timetable.periods.map((row: { date: string; subject: string; start: string }) => [row.date, row.subject, row.start])).toEqual([
      [nextMonday, 'Chào cờ', '07:00'], [nextMonday, 'Toán', '07:50'], [nextTuesday, 'Tiếng Anh', '13:30'],
    ])
    const raw = await (await anonymous.get('/api/v1/public/timetable?truong=' + slug + '&lop=8a&tuan=' + nextMonday)).text()
    for (const secret of ['Thầy Chủ Nhiệm Bí Mật', 'Học Sinh Riêng Tư', 'AD-HS', teacher, classes['8A']]) expect(raw).not.toContain(secret)

    const pupil = await student.newPage()
    await pupil.goto(link)
    await expect(pupil.getByText('THCS Ánh Dương (hư cấu)')).toBeVisible()
    await pupil.getByRole('button', { name: 'Lớp 8A' }).click()
    await expect(pupil).toHaveURL(/\/hs\?truong=anh-duong-qa&lop=8a$/)
    await pupil.getByRole('button', { name: 'Tuần sau' }).click()
    await pupil.getByRole('button', { name: /^Thứ Hai / }).click()
    await expect(pupil.getByText(/Thứ Hai, .* · 2 tiết/)).toBeVisible()
    await expect(pupil.getByText('07:50–08:35', { exact: true })).toBeVisible()
    expect(await pupil.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)

    // A closure and a cancelled afternoon appear as notices; the cancelled periods are marked.
    await call(owner, scope + '/school/closures', { data: { closed_on: nextMonday, reason: 'Hội thao QA' }, status: 201 })
    const tuesday = (await call(owner, scope + '/sessions?from=' + nextTuesday + '&to=' + nextTuesday + '&class_id=' + classes['8A'])).data[0]
    await call(owner, scope + '/sessions/' + tuesday.id, { method: 'PATCH', data: { action: 'cancel', version: 0 } })
    // A hand-cancelled session stays cancelled when the timetable is synchronised again.
    await call(owner, scope + '/school/sessions/sync', { data: { from: date, to: plus(date, 13) } })
    expect((await call(owner, scope + '/sessions/' + tuesday.id)).data.status).toBe('cancelled')
    await pupil.reload()
    await pupil.getByRole('button', { name: 'Tuần sau' }).click()
    const notices = pupil.getByRole('list', { name: 'Thông báo' })
    await expect(notices).toContainText('nghỉ học · Hội thao QA')
    await expect(notices).toContainText('Buổi chiều Thứ Ba')
    await pupil.getByRole('button', { name: /^Thứ Ba / }).click()
    await expect(pupil.getByText(/Thứ Ba, .* · 0 tiết/)).toBeVisible()
    await expect(pupil.getByText('Nghỉ', { exact: true }).first()).toBeVisible()
    expect((await student.cookies()).length).toBe(0)

    // Stopping publication closes the page again.
    await call(owner, scope + '/school/public', { method: 'PATCH', data: { slug: null } })
    expect((await call(anonymous, '/api/v1/public/timetable?truong=' + slug)).data).toEqual({ enabled: false })
    await pupil.reload()
    await expect(pupil.getByText('chưa công bố thời khóa biểu', { exact: false })).toBeVisible()
  } finally {
    await Promise.all([anonymous.dispose(), student.close()])
  }
})
