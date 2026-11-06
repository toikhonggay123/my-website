import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, request, test, type APIRequestContext } from '@playwright/test'

const origin = 'http://127.0.0.1:5175'
const password = 'Local-QA-Only-2026!'
const viDate = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date())
const plus = (date: string, days: number) => new Date(Date.parse(date) + days * 86_400_000).toISOString().slice(0, 10)
const api = (org: string) => '/api/v1/orgs/' + org

async function call<T = any>(client: APIRequestContext, path: string, options: {
  data?: unknown; method?: string; status?: number; host?: string
} = {}): Promise<T> {
  const method = options.method ?? (options.data === undefined ? 'GET' : 'POST')
  const response = await client.fetch(path, {
    method,
    ...(method === 'GET' ? {} : {
      headers: { Origin: options.host ?? origin, 'Content-Type': 'application/json' },
      data: options.data ?? {},
    }),
  })
  const json = await response.json().catch(() => null)
  if (!json) throw new Error(method + ' ' + path + ' returned ' + response.status() + ' ' + (await response.text()).slice(0, 220))
  expect(response.status(), path + ' ' + method + ' ' + (json.error?.code ?? '')).toBe(options.status ?? 200)
  return json as T
}

async function activate(client: APIRequestContext, invite: { email: string; code: string }, name: string, organization?: string) {
  await call(client, '/api/v1/activate', { data: { ...invite, name, password }, status: 201 })
  await call(client, '/api/auth/sign-in/email', { data: { email: invite.email, password } })
  const response = await call(client, '/api/v1/accept-invitation', {
    data: { code: invite.code, ...(organization ? { organization: { name: organization, type: 'center' } } : {}) }, status: 201,
  })
  return response.data.orgId as string
}

test('owner and teacher complete the ClassCheck workflow across isolated workspaces', async ({ browser, page }) => {
  const invites = JSON.parse(readFileSync(join('.wrangler', 'qa-' + process.env.CLASSHUB_QA_ID, 'owners.json'), 'utf8')) as
    { email: string; code: string }[]
  const current = viDate()
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Đăng nhập', exact: true })).toBeVisible()
  await call(page.request, '/api/v1/me', { status: 401 })
  await call(page.request, '/api/auth/sign-up/email', { data: { name: 'Tài khoản ngoài', email: 'blocked@example.test', password }, status: 404 })
  await call(page.request, '/api/v1/activate', { data: {}, host: 'https://invalid.example.test', status: 403 })
  await page.getByRole('button', { name: 'Tôi có mã mời và cần tạo tài khoản' }).click()
  await page.getByLabel('Họ và tên').fill('Chủ đơn vị QA')
  await page.getByLabel('Email', { exact: true }).fill(invites[0].email)
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password)
  await page.getByLabel('Mã mời', { exact: true }).fill(invites[0].code)
  await page.getByRole('button', { name: 'Kích hoạt và đăng nhập' }).click()
  await expect(page.getByRole('heading', { name: 'Chào Chủ đơn vị QA' })).toBeVisible()
  await page.getByLabel('Mã mời tạo đơn vị mới').check()
  await page.getByLabel('Tên đơn vị').fill('Trung tâm Minh Học (hư cấu)')
  await page.getByRole('button', { name: 'Tạo không gian' }).click()
  await expect(page.getByRole('heading', { name: 'Hôm nay', exact: true })).toBeVisible()
  const org = new URL(page.url()).pathname.split('/')[2]
  const scope = api(org)
  const owner = page.request
  await page.getByRole('link', { name: 'Khóa học', exact: true }).click()
  await page.getByLabel('Mã', { exact: true }).fill('QA-TOAN')
  await page.getByLabel('Tên khóa học').fill('Toán luyện tập')
  await page.getByLabel('Môn học').fill('Toán')
  await page.getByRole('button', { name: 'Tạo khóa học' }).click()
  await expect(page.getByText('Đã lưu khóa học.')).toBeVisible()
  const course = (await call(owner, scope + '/courses')).data[0].id
  const branch = (await call(owner, scope + '/branches')).data[0].id
  const otherBranch = (await call(owner, scope + '/branches', { data: { name: 'Cơ sở QA khác' }, status: 201 })).data.id

  await page.getByRole('link', { name: 'Lớp học', exact: true }).click()
  await page.getByText('Tạo lớp học', { exact: true }).click()
  await page.getByLabel('Mã', { exact: true }).fill('QA-01')
  await page.getByLabel('Tên lớp').fill('Toán A (hư cấu)')
  await page.getByLabel('Ngày bắt đầu').fill(current)
  await page.getByLabel('Ngày kết thúc').fill(plus(current, 40))
  await page.getByRole('combobox', { name: 'Khóa học', exact: true }).selectOption(course)
  await page.getByRole('combobox', { name: 'Cơ sở', exact: true }).selectOption(branch)
  await page.getByRole('button', { name: 'Tạo lớp', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Toán A (hư cấu)' })).toBeVisible()
  const first = new URL(page.url()).pathname.split('/')[4]
  const createClass = async (number: number, location = branch, client = owner, route = scope, offering = course) =>
    (await call(client, route + '/classes', {
      data: { name: 'Lớp QA ' + number, code: 'QA-' + number, course_id: offering, branch_id: location,
        starts_on: current, ends_on: plus(current, 40), capacity: 30 }, status: 201,
    })).data.id as string
  const second = await createClass(2)
  const third = await createClass(3)
  const restricted = await createClass(4, otherBranch)
  await call(owner, scope + '/classes/' + first, {
    method: 'PATCH', status: 200, data: { code: 'QA-01', name: 'Toán A (hư cấu)', starts_on: current,
      ends_on: plus(current, 40), capacity: 30, status: 'active' },
  })
  await call(owner, scope + '/classes/' + first, {
    method: 'PATCH', status: 409, data: { code: 'QA-01', name: 'Toán A (hư cấu)', starts_on: current,
      ends_on: plus(current, 40), capacity: 30, status: 'draft' },
  })
  const firstClass = scope + '/classes/' + first
  const students = Array.from({ length: 30 }, (_, index) => ({
    code: 'HV-' + String(index + 1).padStart(2, '0'), name: 'Học viên QA ' + String(index + 1).padStart(2, '0'),
  }))
  for (const student of students) {
    await call(owner, firstClass + '/enrollments', { data: { student }, status: 201 })
  }
  await call(owner, firstClass + '/enrollments', { data: { student_code: 'HV-01' }, status: 409 })
  await call(owner, firstClass + '/enrollments', { data: { student: { code: 'FULL', name: 'Không được ghi danh' } }, status: 409 })
  expect((await call(owner, scope + '/students?q=FULL')).data).toHaveLength(0)
  await call(owner, scope + '/classes/' + second + '/enrollments', { data: { student_code: 'HV-01' }, status: 201 })
  const firstStudent = (await call(owner, scope + '/students?q=HV-01')).data[0].id
  expect((await call(owner, scope + '/students/' + firstStudent + '/enrollments')).data).toHaveLength(2)

  const teacherBrowser = await browser.newContext({ baseURL: origin, viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })
  const teacherPage = await teacherBrowser.newPage()
  const other = await request.newContext({ baseURL: origin })
  const branchAdmin = await request.newContext({ baseURL: origin })
  const teacher2 = await request.newContext({ baseURL: origin })
  try {
    const inviteStaff = async (email: string, client: APIRequestContext, role: string, branchId: string | null, name: string) => {
      const response = await call(owner, scope + '/invitations', { data: { email, role, branch_id: branchId }, status: 201 })
      await activate(client, { email, code: response.data.code }, name)
    }
    await inviteStaff('teacher@example.test', teacherPage.request, 'teacher', branch, 'Giáo viên QA')
    await inviteStaff('teacher2@example.test', teacher2, 'teacher', branch, 'Giáo viên hỗ trợ QA')
    await inviteStaff('branch@example.test', branchAdmin, 'branch_admin', branch, 'Quản trị cơ sở QA')
    const staff = (await call(owner, scope + '/staff')).data
    const teacher = staff.find((item: { name: string }) => item.name === 'Giáo viên QA').user_id
    const support = staff.find((item: { name: string }) => item.name === 'Giáo viên hỗ trợ QA').user_id
    for (const id of [first, second, third]) {
      await call(owner, scope + '/classes/' + id + '/teachers', { data: { user_id: teacher, duty: 'primary' }, status: 201 })
    }
    await call(owner, firstClass + '/teachers', { data: { user_id: support, duty: 'support' }, status: 201 })
    await call(teacherPage.request, scope + '/classes/' + restricted, { status: 404 })
    await call(branchAdmin, scope + '/classes/' + restricted, { status: 404 })
    await call(branchAdmin, scope + '/students', { status: 403 })
    await call(teacherPage.request, firstClass + '/enrollments', { data: { student_code: 'HV-09' }, status: 403 })
    expect((await call(teacherPage.request, scope + '/classes')).data).toHaveLength(3)
    const orgB = await activate(other, invites[1], 'Chủ đơn vị B QA', 'Trung tâm B (hư cấu)')
    await call(other, firstClass, { status: 404 })
    const otherCourse = (await call(other, api(orgB) + '/courses', {
      data: { code: 'EN-QA', name: 'Tiếng Anh QA', subject: 'Tiếng Anh' }, status: 201,
    })).data.id
    await call(other, api(orgB) + '/classes/' + first, { status: 404 })
    await call(other, api(orgB) + '/students/' + firstStudent, { method: 'PATCH', data: { code: 'OVERWRITE', name: 'Cross tenant' }, status: 404 })
    await call(owner, scope + '/courses/' + otherCourse, {
      method: 'PATCH', data: { code: 'HIJACK', name: 'Cross tenant', subject: 'Test' }, status: 404,
    })
    const starts = { teacher_id: teacher, starts_at: '00:00', ends_at: '00:20', room: 'QA-P1' }
    const rule = (await call(owner, firstClass + '/timetable', { data: {
      ...starts, weekday: new Date(current).getUTCDay() || 7, every_weeks: 1,
      starts_on: current, ends_on: plus(current, 14),
    }, status: 201 })).data.id
    const preview = () => call(owner, firstClass + '/timetable/' + rule + '/preview?' + new URLSearchParams({ from: current, to: plus(current, 14) }))
    expect((await preview()).data.map((row: {status: string}) => row.status)).toEqual(['ready', 'ready', 'ready'])
    const generate = () => call(owner, firstClass + '/timetable/' + rule + '/generate', { data: { from: current, to: plus(current, 14) } })
    expect((await generate()).data).toEqual({ created: 3, occurrences: 3 })
    expect((await generate()).data.created).toBe(0)
    expect((await preview()).data.map((row: {status: string}) => row.status)).toEqual(['existing', 'existing', 'existing'])
    await call(owner, scope + '/classes/' + second + '/sessions', { data: { ...starts, lesson_date: current, room: 'QA-P2' }, status: 409 })
    const secondLesson = (await call(owner, scope + '/classes/' + second + '/sessions', {
      data: { ...starts, lesson_date: current, starts_at: '00:20', ends_at: '00:40' }, status: 201,
    })).data.id
    const lessons = (await call(owner, scope + '/sessions?from=' + current + '&to=' + plus(current, 14) + '&class_id=' + first)).data
    expect(lessons.map((lesson: { lesson_date: string }) => lesson.lesson_date)).toEqual([current, plus(current, 7), plus(current, 14)])
    const lesson = lessons[0].id
    const attendance = scope + '/sessions/' + lesson + '/attendance'
    await call(other, attendance, { status: 404 })
    await call(teacher2, attendance, { status: 404 })
    await call(teacherPage.request, scope + '/reports/attendance.csv', { status: 403 })

    await call(teacherPage.request, '/api/auth/sign-out', { data: {} })
    await call(teacherPage.request, '/api/v1/me', { status: 401 })
    await teacherPage.goto('/w/' + org)
    await teacherPage.getByLabel('Email', { exact: true }).fill('teacher@example.test')
    await teacherPage.getByLabel('Mật khẩu', { exact: true }).fill(password)
    await teacherPage.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
    await expect(teacherPage.getByRole('heading', { name: 'Lịch dạy của bạn' })).toBeVisible()
    await expect(teacherPage.getByRole('link', { name: 'Nhân sự' })).toHaveCount(0)
    await teacherPage.goto('/w/' + org + '/buoi/' + lesson)
    await expect(teacherPage.getByText('30 học viên', { exact: true })).toBeVisible()
    expect(await teacherPage.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
    const before = (await call(teacherPage.request, attendance)).data
    expect(before.roster).toHaveLength(30)
    expect(before.roster.every((row: { status: string }) => row.status === 'unmarked')).toBe(true)
    await call(teacherPage.request, attendance + '/finalize', { data: { version: 0, entries: before.roster }, status: 400 })
    await teacherPage.getByRole('button', { name: 'Đánh dấu còn lại có mặt' }).click()
    teacherPage.once('dialog', dialog => dialog.dismiss())
    await teacherPage.getByRole('link', { name: 'Lịch học', exact: true }).last().click()
    await expect(teacherPage.getByText('Có thay đổi chưa lưu', { exact: false })).toBeVisible()
    await teacherPage.getByRole('combobox', { name: 'Trạng thái của Học viên QA 02', exact: true }).selectOption('absent')
    await teacherPage.getByRole('button', { name: 'Lưu nháp' }).click()
    await expect(teacherPage.getByText('Đã lưu điểm danh nháp.')).toBeVisible()
    await call(teacherPage.request, attendance, { method: 'PUT', data: { version: 0, entries: before.roster }, status: 409 })
    await teacherPage.reload()
    await expect(teacherPage.getByRole('combobox', { name: 'Trạng thái của Học viên QA 02', exact: true })).toHaveValue('absent')
    teacherPage.once('dialog', dialog => dialog.accept())
    await teacherPage.getByRole('button', { name: 'Chốt điểm danh' }).click()
    await expect(teacherPage.getByText('Đã chốt điểm danh.')).toBeVisible()
    const reportPath = scope + '/reports/attendance?from=' + current + '&to=' + current + '&class_id=' + first
    const summary = (await call(owner, reportPath)).summary
    expect(summary).toMatchObject({ present: 29, absent: 1, excused: 0, unmarked: 0, total: 30 })
    const analytics = (await call(teacherPage.request, scope + '/dashboard/analytics?days=14')).data
    expect(analytics.daily).toHaveLength(14)
    expect(analytics.daily.at(-1)).toMatchObject({ date: current, done: 1 })
    expect(analytics.attendance).toEqual({ present: 29, late: 0, absent: 1, excused: 0 })
    expect(analytics.classes.find((row: { id: string }) => row.id === first)).toMatchObject({ done: 1, absent: 1 })
    await call(other, scope + '/dashboard/analytics', { status: 404 })
    const csv = await owner.get(reportPath.replace('/attendance?', '/attendance.csv?'))
    expect(csv.status()).toBe(200)
    expect((await csv.text()).split('\r\n')).toHaveLength(31)
    const reportB = (await call(other, api(orgB) + '/reports/attendance?from=' + current + '&to=' + current)).summary
    expect(reportB.total).toBe(0)

    const marked = (await call(owner, attendance)).data
    await call(teacherPage.request, attendance + '/reopen', { data: { version: marked.session.version, reason: 'QA' }, status: 403 })
    const reopened = (await call(owner, attendance + '/reopen', { data: { version: marked.session.version, reason: 'Kiểm tra minh chứng QA' } })).data
    const correction = marked.roster.map((row: { code: string; status: string }) => row.code === 'HV-02' ? { ...row, status: 'excused' } : row)
    await call(owner, attendance + '/finalize', { data: { version: reopened.version, entries: correction } })
    const log = (await call(owner, attendance + '/history')).data
    expect(log.some((row: { event: string }) => row.event === 'attendance.reopened')).toBe(true)
    expect(log.filter((row: { event: string }) => row.event === 'attendance.finalized')).toHaveLength(2)
    expect((await call(owner, reportPath)).summary).toMatchObject({ present: 29, absent: 0, excused: 1, total: 30 })

    const future = lessons[1].id
    await call(owner, scope + '/sessions/' + future, { method: 'PATCH', data: {
      ...starts, action: 'reschedule', version: 0, lesson_date: plus(current, 8),
    } })
    expect((await generate()).data.created).toBe(0)
    expect((await call(owner, scope + '/sessions/' + future)).data.lesson_date).toBe(plus(current, 8))
    expect((await call(owner, attendance)).data.session.lesson_date).toBe(current)

    const enrollment = marked.roster.find((row: { code: string }) => row.code === 'HV-03').enrollment_id
    await call(owner, firstClass + '/enrollments/' + enrollment, { method: 'PATCH', data: { transfer_to: third } })
    expect((await call(owner, attendance)).data.roster).toHaveLength(30)
    const secondSheet = (await call(owner, scope + '/sessions/' + secondLesson + '/attendance')).data
    expect(secondSheet.roster.map((row: { code: string; status: string }) => [row.code, row.status])).toEqual([['HV-01', 'unmarked']])

    await page.goto('/w/' + org + '/bao-cao')
    await expect(page.getByRole('heading', { name: 'Báo cáo chuyên cần' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Kết quả đã chốt' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('cell', { name: 'Học viên QA 01', exact: true })).toBeVisible()
    await call(owner, scope + '/staff/' + teacher, { method: 'PATCH', data: { active: false } })
    await call(teacherPage.request, attendance, { status: 404 })
    await call(teacherPage.request, attendance, { method: 'PUT', data: { version: 0, entries: [] }, status: 404 })
    expect((await call(teacherPage.request, '/api/v1/me')).data.workspaces).toHaveLength(0)
    await call(owner, scope + '/staff/' + teacher, { method: 'PATCH', data: { active: true } })
    expect((await call(teacherPage.request, attendance)).data.roster).toHaveLength(30)
  } finally {
    await Promise.all([teacherBrowser.close(), other.dispose(), branchAdmin.dispose(), teacher2.dispose()])
  }
})
