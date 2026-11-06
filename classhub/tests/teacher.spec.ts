import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, request, test, type APIRequestContext } from '@playwright/test'

// Authenticated QA server with an isolated D1. The third owner invitation belongs to this scenario.
const origin = 'http://127.0.0.1:5175'
const password = 'Local-QA-Only-2026!'
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())
const plus = (date: string, days: number) => new Date(Date.parse(date) + days * 86_400_000).toISOString().slice(0, 10)
const weekdayOf = (date: string) => new Date(date + 'T00:00:00Z').getUTCDay() || 7
const newPassword = 'Local-QA-Reset-2026!'
// Sign-ins are rate limited per client IP; this scenario uses its own documentation address (see reports.spec.ts).
const client = { 'CF-Connecting-IP': '198.51.100.31' }
test.use({ extraHTTPHeaders: client })

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

test('teachers activate by link, mark a school session by tapping and correct it within 30 minutes', async ({ browser, page }) => {
  const invites = JSON.parse(readFileSync(join('.wrangler', 'qa-' + process.env.CLASSHUB_QA_ID, 'owners.json'), 'utf8')) as { email: string; code: string }[]
  const owner = page.request
  const org = await activate(owner, invites[2].email, invites[2].code, 'Hiệu trưởng QA', { name: 'Trường THCS QA (hư cấu)', type: 'school' })
  const scope = '/api/v1/orgs/' + org
  const date = today()
  const branch = (await call(owner, scope + '/branches')).data[0].id
  const classId = (await call(owner, scope + '/classes', { data: {
    code: 'QA-7A', name: '7A', branch_id: branch, starts_on: plus(date, -10), ends_on: plus(date, 200), capacity: 45,
  }, status: 201 })).data.id
  for (const [code, name] of [['HS-01', 'An Học sinh'], ['HS-02', 'Bình Học sinh'], ['HS-03', 'Chi Học sinh']]) {
    await call(owner, scope + '/classes/' + classId + '/enrollments', { data: { student: { code, name } }, status: 201 })
  }
  await call(owner, scope + '/school/terms', { data: { name: 'HK QA', starts_on: plus(date, -10), ends_on: plus(date, 120) }, status: 201 })
  await call(owner, scope + '/school/subjects/defaults', { data: {}, status: 201 })
  // One morning that has already started today: period 1 at midnight, period 2 for the rest of the day.
  await call(owner, scope + '/school/bells', { method: 'PUT', data: { periods: [
    { shift: 'morning', period: 1, starts_at: '00:00', ends_at: '00:05' },
    { shift: 'morning', period: 2, starts_at: '00:05', ends_at: '23:58' },
  ] } })

  // The owner creates a teacher invitation and gets a link for the teacher page.
  await page.goto('/w/' + org + '/nhan-su')
  await page.getByLabel('Email người nhận').fill('gvcn@example.test')
  await page.getByRole('button', { name: 'Tạo mã mời' }).click()
  const link = await page.getByLabel('Link kích hoạt vừa tạo').inputValue()
  expect(link).toContain('/gv/kich-hoat#')

  const phone = await browser.newContext({ baseURL: origin, viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, extraHTTPHeaders: client })
  const subject = await request.newContext({ baseURL: origin, extraHTTPHeaders: client })
  const outsider = await request.newContext({ baseURL: origin, extraHTTPHeaders: client })
  try {
    const teacher = await phone.newPage()
    await teacher.goto(link)
    await expect(teacher).toHaveURL(/\/gv\/kich-hoat$/)
    await teacher.getByLabel('Họ và tên').fill('Cô Chủ Nhiệm QA')
    await teacher.getByLabel('Email được mời').fill('gvcn@example.test')
    await teacher.getByLabel('Mật khẩu', { exact: true }).fill(password)
    await teacher.getByLabel('Nhập lại mật khẩu').fill(password)
    await teacher.getByRole('button', { name: 'Kích hoạt' }).click()
    await expect(teacher.getByRole('heading', { name: 'Hôm nay' })).toBeVisible()
    const cookie = (await phone.cookies()).find(item => item.name.includes('session_token'))!
    expect(cookie.expires * 1000).toBeGreaterThan(Date.now() + 20 * 86_400_000)

    const invite = async (email: string) => (await call(owner, scope + '/invitations', { data: { email, role: 'teacher', branch_id: null }, status: 201 })).data.code
    await activate(subject, 'gvbm@example.test', await invite('gvbm@example.test'), 'Thầy Bộ Môn QA')
    await activate(outsider, 'gvkhac@example.test', await invite('gvkhac@example.test'), 'Cô Lớp Khác QA')
    const staff = (await call(owner, scope + '/school/teachers')).data as { id: string; name: string }[]
    const id = (name: string) => staff.find(row => row.name === name)!.id
    const setup = (await call(owner, scope + '/school/setup')).data
    const term = setup.terms[0].id
    const subjectId = (name: string) => setup.subjects.find((row: { name: string }) => row.name === name).id
    await call(owner, scope + '/school/classes/' + classId + '/homeroom', { method: 'PUT', data: { user_id: id('Cô Chủ Nhiệm QA') } })
    await call(owner, scope + '/school/terms/' + term + '/assignments', { method: 'PUT', data: {
      class_id: classId, subject_id: subjectId('Toán'), user_id: id('Thầy Bộ Môn QA') } })
    await call(owner, scope + '/school/terms/' + term + '/assignments', { method: 'PUT', data: {
      class_id: classId, subject_id: subjectId('Ngữ văn'), user_id: id('Cô Chủ Nhiệm QA') } })
    const draft = (await call(owner, scope + '/school/terms/' + term + '/timetable/draft', { data: {}, status: 201 })).data.id
    await call(owner, scope + '/school/timetable/' + draft + '/classes/' + classId, { method: 'PUT', data: { slots: [
      { weekday: weekdayOf(date), shift: 'morning', period: 1, subject_id: subjectId('Toán'), room: 'P.7A' },
      { weekday: weekdayOf(date), shift: 'morning', period: 2, subject_id: subjectId('Ngữ văn'), room: '' },
    ] } })
    const published = (await call(owner, scope + '/school/timetable/' + draft + '/publish', { data: { effective_from: date } })).data
    expect(published.sync.created).toBeGreaterThanOrEqual(1)

    // The homeroom teacher sees today's session, taps two exceptions and finalizes in the app's own dialog.
    await teacher.reload()
    const card = teacher.getByRole('link', { name: /Cần làm ngay/ })
    await expect(card).toContainText('Điểm danh 7A')
    await expect(teacher.getByText('7A · Ngữ văn')).toBeVisible()
    await card.click()
    await expect(teacher.getByText('Cả lớp đang là', { exact: false })).toBeVisible()
    await teacher.getByRole('button', { name: /^Bình Học sinh: Có mặt/ }).click()
    await teacher.getByRole('button', { name: /^Chi Học sinh: Có mặt/ }).click()
    await teacher.getByRole('button', { name: /^Chi Học sinh: Vắng/ }).click()
    await expect(teacher.getByRole('button', { name: /^Chi Học sinh: Đi muộn/ })).toBeVisible()
    expect(await teacher.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
    await teacher.getByRole('button', { name: 'Ghi chú cho Chi Học sinh' }).first().click()
    await teacher.getByRole('textbox', { name: 'Ghi chú cho Chi Học sinh' }).fill('Đến lúc 7:20')
    await teacher.getByRole('button', { name: /^Chốt · 2\/3 có mặt/ }).click()
    const dialog = teacher.getByRole('dialog')
    await expect(dialog).toContainText('Vắng: Bình Học sinh')
    await dialog.getByRole('button', { name: 'Chốt', exact: true }).click()
    await expect(teacher.getByText('Đã chốt điểm danh.')).toBeVisible()

    const session = (await call(owner, scope + '/sessions?from=' + date + '&to=' + date + '&class_id=' + classId)).data[0].id
    const attendance = scope + '/sessions/' + session + '/attendance'
    const marks = Object.fromEntries((await call(owner, attendance)).data.roster.map((row: { name: string; status: string; note: string }) =>
      [row.name, row.status + (row.note ? ':' + row.note : '')]))
    expect(marks).toEqual({ 'An Học sinh': 'present', 'Bình Học sinh': 'absent', 'Chi Học sinh': 'late:Đến lúc 7:20' })

    // The subject teacher with a period in that morning can open it; a teacher without one cannot.
    expect((await call(subject, attendance)).data.roster).toHaveLength(3)
    await call(outsider, attendance, { status: 404 })
    const subjectToday = (await call(subject, scope + '/teacher/today')).data
    expect(subjectToday.periods.map((row: { subject: string }) => row.subject)).toEqual(['Toán'])
    expect(subjectToday.sessions[0]).toMatchObject({ class_name: '7A', attendance_state: 'finalized', roster: 3 })
    expect(subjectToday.sessions[0].flagged.map((row: { name: string }) => row.name)).toEqual(['Bình Học sinh', 'Chi Học sinh'])
    const sheet = (await call(subject, attendance)).data
    await call(subject, attendance + '/reopen', { data: { version: sheet.session.version, reason: 'QA' }, status: 403 })
    await call(owner, scope + '/teacher/today', { status: 403 })

    // Within 30 minutes the teacher who finalized can correct it.
    await teacher.getByRole('button', { name: /^Sửa lại · còn/ }).click()
    await expect(teacher.getByText('Đã mở lại', { exact: false })).toBeVisible()
    await teacher.getByRole('button', { name: /^Bình Học sinh: Vắng/ }).click()
    await teacher.getByRole('button', { name: /^Bình Học sinh: Đi muộn/ }).click()
    await teacher.getByRole('button', { name: /^Chốt · 2\/3 có mặt/ }).click()
    await teacher.getByRole('dialog').getByRole('button', { name: 'Chốt', exact: true }).click()
    await expect(teacher.getByText('Đã chốt điểm danh.')).toBeVisible()
    expect((await call(owner, attendance)).data.roster.find((row: { name: string }) => row.name === 'Bình Học sinh').status).toBe('excused')
    const history = (await call(owner, attendance + '/history')).data
    expect(history.some((row: { event: string }) => row.event === 'attendance.reopened')).toBe(true)

    // Week and class views.
    await teacher.getByRole('link', { name: 'Tuần' }).click()
    await expect(teacher.getByRole('heading', { name: 'Lịch tuần' })).toBeVisible()
    await teacher.getByRole('link', { name: 'Lớp', exact: true }).click()
    await teacher.getByRole('link', { name: /7A/ }).click()
    await expect(teacher.getByRole('heading', { name: 'Lớp 7A' })).toBeVisible()
    const stats = (await call(subject, scope + '/teacher/classes/' + classId)).data
    expect(stats.students.find((row: { name: string }) => row.name === 'Chi Học sinh')).toMatchObject({ late: 1, absent: 0 })
    await call(outsider, scope + '/teacher/classes/' + classId, { status: 404 })

    // The front door routes by role: a teacher at / lands on the teacher page, an owner at /gv on administration.
    await teacher.goto('/')
    await expect(teacher).toHaveURL(/\/gv$/)
    await page.goto('/gv')
    await expect(page).toHaveURL(origin + '/')

    // Forgotten password: the owner creates a one-time link that sets a new password and signs out old sessions.
    await page.goto('/w/' + org + '/nhan-su')
    const member = page.locator('details').filter({ has: page.getByText('Thầy Bộ Môn QA', { exact: true }) })
    await member.locator('summary').click()
    page.once('dialog', dialog => dialog.accept())
    await member.getByRole('button', { name: 'Tạo link đặt lại mật khẩu' }).click()
    const resetLink = await member.getByLabel('Link đặt lại mật khẩu').inputValue()
    expect(resetLink).toContain('/gv/dat-lai-mat-khau#')
    const fresh = await browser.newContext({ baseURL: origin, viewport: { width: 375, height: 812 }, isMobile: true, extraHTTPHeaders: client })
    try {
      const resetPage = await fresh.newPage()
      await resetPage.goto(resetLink)
      await expect(resetPage).toHaveURL(/\/gv\/dat-lai-mat-khau$/)
      await resetPage.getByLabel('Mật khẩu mới', { exact: true }).fill(newPassword)
      await resetPage.getByLabel('Nhập lại mật khẩu mới').fill(newPassword)
      await resetPage.getByRole('button', { name: 'Lưu và đăng nhập' }).click()
      await expect(resetPage.getByRole('heading', { name: 'Hôm nay' })).toBeVisible()
    } finally { await fresh.close() }
    await call(subject, '/api/v1/me', { status: 401 })
    await call(subject, '/api/auth/sign-in/email', { data: { email: 'gvbm@example.test', password }, status: 401 })
    await call(subject, '/api/v1/password-reset', { data: { code: resetLink.split('#')[1], password: newPassword }, status: 404 })
  } finally {
    await Promise.all([phone.close(), subject.dispose(), outsider.dispose()])
  }
})
