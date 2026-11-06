import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, request, test, type APIRequestContext } from '@playwright/test'

// Authenticated QA server with an isolated D1. The fifth owner invitation belongs to this scenario.
const origin = 'http://127.0.0.1:5175'
const password = 'Local-QA-Only-2026!'
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

// Sign-ins are rate limited per client IP. This scenario uses its own documentation address so it does not
// share the loopback budget with the other scenarios (Miniflare passes the header through; Cloudflare sets it).
const client = { 'CF-Connecting-IP': '198.51.100.24' }
test.use({ extraHTTPHeaders: client })

test('reports summarise a range, build the monthly register and flag students to follow up', async ({ page }) => {
  const invites = JSON.parse(readFileSync(join('.wrangler', 'qa-' + process.env.CLASSHUB_QA_ID, 'owners.json'), 'utf8')) as { email: string; code: string }[]
  const owner = page.request
  const org = await activate(owner, invites[4].email, invites[4].code, 'Hiệu trưởng Báo Cáo', { name: 'THCS Báo Cáo (hư cấu)', type: 'school' })
  const scope = '/api/v1/orgs/' + org
  const date = today()
  const branch = (await call(owner, scope + '/branches')).data[0].id
  const classId = (await call(owner, scope + '/classes', { data: {
    code: 'BC-9A', name: '9A', branch_id: branch, starts_on: plus(date, -10), ends_on: plus(date, 200), capacity: 45,
  }, status: 201 })).data.id
  for (const [code, name] of [['BC-1', 'An Vắng Nhiều'], ['BC-2', 'Bình Có Phép'], ['BC-3', 'Chi Hay Muộn']]) {
    await call(owner, scope + '/classes/' + classId + '/enrollments', { data: { student: { code, name } }, status: 201 })
  }
  const teacherClient = await request.newContext({ baseURL: origin, extraHTTPHeaders: client })
  try {
    const code = (await call(owner, scope + '/invitations', { data: { email: 'gv-bc@example.test', role: 'teacher', branch_id: null }, status: 201 })).data.code
    await activate(teacherClient, 'gv-bc@example.test', code, 'Cô Báo Cáo')
    await call(teacherClient, scope + '/reports/summary', { status: 403 })
    await call(teacherClient, scope + '/reports/alerts', { status: 403 })
  } finally { await teacherClient.dispose() }
  const teacher = (await call(owner, scope + '/school/teachers')).data[0].id
  await call(owner, scope + '/school/classes/' + classId + '/homeroom', { method: 'PUT', data: { user_id: teacher } })
  await call(owner, scope + '/school/terms', { data: { name: 'HK Báo Cáo', starts_on: plus(date, -10), ends_on: plus(date, 120) }, status: 201 })
  await call(owner, scope + '/school/subjects/defaults', { data: {}, status: 201 })
  // Both shifts have already started today so they can be marked.
  await call(owner, scope + '/school/bells', { method: 'PUT', data: { periods: [
    { shift: 'morning', period: 1, starts_at: '00:00', ends_at: '00:01' },
    { shift: 'afternoon', period: 1, starts_at: '00:02', ends_at: '00:03' },
  ] } })
  const setup = (await call(owner, scope + '/school/setup')).data
  const math = setup.subjects.find((row: { name: string }) => row.name === 'Toán').id
  const draft = (await call(owner, scope + '/school/terms/' + setup.terms[0].id + '/timetable/draft', { data: {}, status: 201 })).data.id
  await call(owner, scope + '/school/timetable/' + draft + '/classes/' + classId, { method: 'PUT', data: { slots: [
    { weekday: weekdayOf(date), shift: 'morning', period: 1, subject_id: math, room: '' },
    { weekday: weekdayOf(date), shift: 'afternoon', period: 1, subject_id: math, room: '' },
  ] } })
  await call(owner, scope + '/school/timetable/' + draft + '/publish', { data: { effective_from: date } })
  for (const [start, end] of [['00:04', '00:05'], ['00:06', '00:07'], ['00:08', '00:09']]) {
    await call(owner, scope + '/classes/' + classId + '/sessions', { data: { teacher_id: teacher, lesson_date: date, starts_at: start, ends_at: end, room: '' }, status: 201 })
  }
  const sessions = (await call(owner, scope + '/sessions?from=' + date + '&to=' + date + '&class_id=' + classId)).data
  expect(sessions).toHaveLength(5)
  const plan: Record<string, string[]> = {
    'An Vắng Nhiều': ['absent', 'absent', 'absent', 'absent', 'absent'],
    'Bình Có Phép': ['excused', 'excused', 'absent', 'present', 'present'],
    'Chi Hay Muộn': ['late', 'late', 'late', 'late', 'late'],
  }
  for (const [index, session] of sessions.entries()) {
    const attendance = scope + '/sessions/' + session.id + '/attendance'
    const sheet = (await call(owner, attendance)).data
    await call(owner, attendance + '/finalize', { data: { version: sheet.session.version, entries: sheet.roster.map(
      (row: { enrollment_id: string; name: string }) => ({ enrollment_id: row.enrollment_id, status: plan[row.name][index], note: '' })) } })
  }

  const summary = (await call(owner, scope + '/reports/summary?from=' + plus(date, -6) + '&to=' + date)).data
  expect(summary.classes).toEqual([expect.objectContaining({ name: '9A', due: 5, finalized: 5, absent: 6, excused: 2, late: 5, present: 2, flagged: 2 })])
  expect(summary.students.filter((row: { flagged: boolean }) => row.flagged).map((row: { name: string }) => row.name)).toEqual(['An Vắng Nhiều', 'Chi Hay Muộn'])
  expect(summary.terms.map((row: { name: string }) => row.name)).toEqual(['HK Báo Cáo'])
  await call(owner, scope + '/reports/summary?from=' + plus(date, -400) + '&to=' + date, { status: 400 })
  const alerts = (await call(owner, scope + '/reports/alerts')).data
  expect(alerts.students.map((row: { name: string; absent: number }) => [row.name, row.absent])).toEqual([['An Vắng Nhiều', 5], ['Chi Hay Muộn', 0]])

  const month = date.slice(0, 7)
  const register = (await call(owner, scope + '/reports/register?class_id=' + classId + '&month=' + month)).data
  // Today's five sessions are finalized; later school days of the month are prepared but still open.
  const columns = register.sessions as { date: string; shift: string | null; finalized: boolean }[]
  expect(columns.filter(row => row.date === date).map(row => [row.shift, row.finalized])).toEqual([
    ['morning', true], ['afternoon', true], [null, true], [null, true], [null, true]])
  expect(columns.filter(row => row.date !== date).every(row => !row.finalized && row.date > date)).toBe(true)
  expect(register.students.find((row: { name: string }) => row.name === 'Bình Có Phép').totals).toEqual({ present: 2, late: 0, absent: 1, excused: 2 })
  const registerCsv = await owner.get(scope + '/reports/register.csv?class_id=' + classId + '&month=' + month)
  expect(registerCsv.status()).toBe(200)
  const lines = (await registerCsv.text()).split('\r\n')
  expect(lines[2]).toContain('"Họ và tên"')
  expect(lines[3]).toBe('"1","BC-1","An Vắng Nhiều",' + columns.map(row => row.finalized ? '"K"' : '"–"').join(',') + ',"0","0","5","5"')
  const summaryCsv = await (await owner.get(scope + '/reports/summary.csv?from=' + plus(date, -6) + '&to=' + date)).text()
  expect(summaryCsv).toContain('"9A","BC-3","Chi Hay Muộn","0","5","0","0","100%","Có"')

  // The administration pages show the same numbers.
  await page.goto('/w/' + org)
  await expect(page.getByRole('heading', { name: 'Học sinh cần chú ý' })).toBeVisible()
  await expect(page.getByText('K 5 · P 0 · M 0')).toBeVisible()
  await page.goto('/w/' + org + '/bao-cao?muc=tong-hop&from=' + plus(date, -6) + '&to=' + date)
  await expect(page.getByRole('heading', { name: 'Học sinh cần chú ý (2)' })).toBeVisible()
  await page.getByRole('link', { name: '9A', exact: true }).click()
  await expect(page.getByRole('heading', { name: /^Lớp 9A · Tháng / })).toBeVisible()
  const grid = page.getByRole('region', { name: 'Sổ điểm danh lớp 9A' })
  await expect(grid.getByRole('row')).toHaveCount(5)
  await expect(page.getByRole('combobox', { name: 'Lớp', exact: true })).toHaveValue(classId)
  await expect(grid.getByRole('row', { name: /An Vắng Nhiều/ }).getByRole('cell', { name: 'K', exact: true })).toHaveCount(5)
  await page.getByRole('link', { name: 'Chi tiết', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Báo cáo chuyên cần' })).toBeVisible()
})
