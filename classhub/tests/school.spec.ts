import { expect, test, type APIResponse } from '@playwright/test'

// Runs on the loopback administration server (isolated QA D1) with fictional classes and teachers.
const origin = 'http://127.0.0.1:5176'
const dayMs = 86_400_000
const vnDate = (offset: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(Date.now() + offset * dayMs))
const weekdayOf = (date: string) => new Date(date + 'T00:00:00Z').getUTCDay() || 7
const weekdays = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']
const at = (date: string, time: string) => Date.parse(date + 'T' + time + ':00+07:00')
type Session = { id: string; class_id: string; lesson_date: string; starts_at: number; ends_at: number; status: string; teacher_name: string }

async function data<T>(response: APIResponse, status = 200): Promise<T> {
  const json = await response.json()
  expect(response.status(), json.error?.message).toBe(status)
  return json.data as T
}

test('school mode builds a timetable and keeps one attendance session per class and shift', async ({ page }) => {
  const client = page.request
  const me = await data<{ workspaces: { id: string }[] }>(await client.get(origin + '/api/v1/me'))
  const org = me.workspaces[0].id
  const api = origin + '/api/v1/orgs/' + org
  const call = (path: string, payload: object = {}, method = 'POST') =>
    client.fetch(api + path, { method, headers: { Origin: origin }, data: payload })
  await data(await call('/settings', { name: 'Trường THCS QA', type: 'school' }, 'PATCH'))

  const teachers: string[] = []
  for (const name of ['GV Chủ nhiệm 6A', 'GV Chủ nhiệm 6B', 'GV Toán QA']) {
    teachers.push((await data<{ id: string }>(await call('/staff', { name }), 201)).id)
  }
  const branch = (await data<{ id: string }[]>(await client.get(api + '/branches')))[0].id
  const classes: Record<string, string> = {}
  for (const name of ['6A', '6B']) {
    classes[name] = (await data<{ id: string }>(await call('/classes', {
      code: 'QA-' + name, name, branch_id: branch, starts_on: vnDate(-30), ends_on: vnDate(200), capacity: 45,
    }), 201)).id
  }
  await data(await call('/classes/' + classes['6A'] + '/enrollments', { student: { code: 'QA-HS-01', name: 'Học sinh QA' } }), 201)

  // Settings: term, THCS subjects and the suggested bell schedule.
  await page.goto(origin + '/w/' + org + '/thiet-lap')
  await expect(page.getByRole('link', { name: 'Thời khóa biểu' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Khóa học' })).toHaveCount(0)
  await page.getByRole('textbox', { name: 'Tên học kỳ' }).last().fill('Học kỳ QA')
  await page.getByLabel('Từ ngày').last().fill(vnDate(-30))
  await page.getByLabel('Đến ngày').last().fill(vnDate(150))
  await page.getByRole('button', { name: 'Thêm học kỳ', exact: true }).click()
  await expect(page.getByText('Đã thêm học kỳ.')).toBeVisible()
  await page.getByRole('button', { name: 'Thêm bộ môn THCS', exact: true }).click()
  await expect(page.getByText('Đã thêm các môn THCS', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Lưu khung giờ', exact: true }).click()
  await expect(page.getByText('Đã lưu khung giờ tiết', { exact: false })).toBeVisible()

  const setup = await data<{ terms: { id: string; name: string }[]; subjects: { id: string; name: string }[] }>(await client.get(api + '/school/setup'))
  const term = setup.terms.find(row => row.name === 'Học kỳ QA')!
  const subject = (name: string) => setup.subjects.find(row => row.name === name)!.id
  await data(await call('/school/classes/' + classes['6A'] + '/homeroom', { user_id: teachers[0] }, 'PUT'))
  await data(await call('/school/classes/' + classes['6B'] + '/homeroom', { user_id: teachers[1] }, 'PUT'))
  for (const [className, subjectName, teacher] of [['6A', 'Toán', 2], ['6B', 'Toán', 2], ['6A', 'Ngữ văn', 0]] as const) {
    await data(await call('/school/terms/' + term.id + '/assignments', {
      class_id: classes[className], subject_id: subject(subjectName), user_id: teachers[teacher],
    }, 'PUT'))
  }

  // A school day between tomorrow and a week ahead, so its sessions have not started yet.
  const target = [1, 2, 3, 4, 5, 6, 7].map(vnDate).find(date => weekdayOf(date) <= 6)!
  const day = weekdays[weekdayOf(target) - 1]
  const cell = (shift: string, period: number) => page.getByRole('combobox', { name: day + ', ' + shift + ' tiết ' + period, exact: true })

  await page.goto(origin + '/w/' + org + '/tkb?muc=soan&hk=' + term.id)
  await page.getByRole('button', { name: 'Tạo bản nháp', exact: true }).click()
  await cell('sáng', 1).selectOption({ label: 'Toán' })
  await cell('sáng', 2).selectOption({ label: 'Văn' })
  await expect(page.getByText('GV Toán QA', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Lưu thời khóa biểu lớp 6A', exact: true }).click()
  await expect(page.getByText('Đã lưu thời khóa biểu lớp 6A.')).toBeVisible()
  await page.getByRole('group', { name: 'Chọn lớp' }).getByRole('button', { name: '6B', exact: true }).click()
  await cell('sáng', 1).selectOption({ label: 'Toán' })
  await page.getByRole('button', { name: 'Lưu thời khóa biểu lớp 6B', exact: true }).click()
  await expect(page.getByText('GV Toán QA', { exact: true }).and(page.locator('strong'))).toBeVisible()
  await expect(page.getByText('trùng tiết', { exact: false })).toBeVisible()

  const versions = await data<{ versions: { id: string; status: string }[] }>(await client.get(api + '/school/terms/' + term.id + '/timetable'))
  const draft = versions.versions.find(row => row.status === 'draft')!
  expect((await call('/school/timetable/' + draft.id + '/publish', { effective_from: vnDate(0) })).status()).toBe(409)

  // Move 6B's maths to period 3 so the shared teacher is free, then publish from the UI.
  await cell('sáng', 1).selectOption('')
  await cell('sáng', 3).selectOption({ label: 'Toán' })
  await page.getByRole('button', { name: 'Lưu thời khóa biểu lớp 6B', exact: true }).click()
  await expect(page.getByText('Không có giáo viên bị trùng tiết', { exact: false })).toBeVisible()
  await page.getByRole('group', { name: 'Mục thời khóa biểu' }).getByRole('button', { name: 'Công bố' }).click()
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Công bố thời khóa biểu', exact: true }).click()
  await expect(page.getByText('Đã công bố thời khóa biểu', { exact: false })).toBeVisible()
  await expect(page.getByText('Đang áp dụng', { exact: true })).toBeVisible()

  const sessions = async (classId: string, from: string, to = from) => (await data<Session[]>(await client.get(api + '/sessions?' +
    new URLSearchParams({ from, to, class_id: classId, limit: '400' }))))
  const fortnight = await sessions(classes['6A'], vnDate(0), vnDate(13))
  expect(fortnight.filter(row => row.status === 'scheduled')).toHaveLength(2)
  const [lesson6A] = await sessions(classes['6A'], target)
  expect(lesson6A.starts_at).toBe(at(target, '07:00'))
  expect(lesson6A.ends_at).toBe(at(target, '08:35'))
  expect(lesson6A.teacher_name).toBe('GV Chủ nhiệm 6A')
  const [lesson6B] = await sessions(classes['6B'], target)
  expect([lesson6B.starts_at, lesson6B.ends_at]).toEqual([at(target, '08:50'), at(target, '09:35')])
  const sheet = await data<{ roster: { name: string }[] }>(await client.get(api + '/sessions/' + lesson6A.id + '/attendance'))
  expect(sheet.roster.map(row => row.name)).toEqual(['Học sinh QA'])

  // Closures cancel unstarted sessions and removing them restores the sessions.
  const closed = await data<{ sync: { cancelled: number } }>(await call('/school/closures', { closed_on: target, reason: 'Nghỉ QA' }), 201)
  expect(closed.sync.cancelled).toBe(2)
  expect((await sessions(classes['6A'], target))[0].status).toBe('cancelled')
  const reopened = await data<{ sync: { updated: number } }>(await call('/school/closures/' + target, {}, 'DELETE'))
  expect(reopened.sync.updated).toBe(2)
  expect((await sessions(classes['6A'], target))[0].status).toBe('scheduled')

  // A new homeroom teacher takes over sessions that hold no attendance yet.
  await data(await call('/school/classes/' + classes['6A'] + '/homeroom', { user_id: teachers[2] }, 'PUT'))
  expect((await sessions(classes['6A'], target))[0].teacher_name).toBe('GV Toán QA')

  // Republishing without 6A cancels its future sessions and keeps 6B.
  const next = await data<{ id: string }>(await call('/school/terms/' + term.id + '/timetable/draft'), 201)
  const copied = await data<{ slots: unknown[] }>(await client.get(api + '/school/timetable/' + next.id))
  expect(copied.slots).toHaveLength(3)
  await data(await call('/school/timetable/' + next.id + '/classes/' + classes['6A'], { slots: [] }, 'PUT'))
  const republished = await data<{ sync: { cancelled: number } }>(await call('/school/timetable/' + next.id + '/publish', { effective_from: target }))
  expect(republished.sync.cancelled).toBeGreaterThanOrEqual(1)
  expect((await sessions(classes['6A'], target))[0].status).toBe('cancelled')
  expect((await sessions(classes['6B'], target))[0].status).toBe('scheduled')
  expect((await call('/school/timetable/' + next.id + '/classes/' + classes['6B'], { slots: [] }, 'PUT')).status()).toBe(409)
})
