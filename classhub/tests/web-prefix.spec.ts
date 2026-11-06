import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

test('the front door offers staff and student entrances and keeps administration behind the lock', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/classhub')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByRole('link', { name: /Cán bộ, giáo viên/ })).toHaveAttribute('href', '/classhub/gv')
  await expect(page.getByRole('link', { name: /Học sinh/ })).toHaveAttribute('href', '/classhub/hs')
  await expect(page.getByLabel('Mật khẩu')).toHaveCount(0)
  await page.getByRole('button', { name: 'Đăng nhập quản trị' }).click()
  await expect(page).toHaveURL(/\/classhub\/quan-tri$/)
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Đăng nhập' })).toBeVisible()
  await expect(page.getByLabel('Email')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page).toHaveURL(/\/classhub$/)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.getByRole('link', { name: /Cán bộ, giáo viên/ }).click()
  await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible()
  await expect(page.getByText('Quên mật khẩu?', { exact: false })).toBeVisible()
})

test('students pick a class once and then open straight on its timetable', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/classhub/thoi-khoa-bieu')
  await expect(page.getByRole('heading', { name: 'Em học lớp nào?' })).toBeVisible()
  await page.getByRole('button', { name: 'Khối 9' }).click()
  await expect(page.getByRole('button', { name: 'Lớp 9B' })).toBeVisible()
  await page.getByRole('searchbox', { name: 'Tìm lớp' }).fill('Lớp 8 a')
  await page.getByRole('button', { name: 'Lớp 8A' }).click()
  await expect(page).toHaveURL(/\/thoi-khoa-bieu\?lop=8a$/)
  await page.getByRole('button', { name: /^Thứ Hai / }).click()
  await expect(page.getByText(/Thứ Hai, .* · 7 tiết/)).toBeVisible()
  await expect(page.getByText('Tiết 1', { exact: true })).toBeVisible()
  await expect(page.getByText('07:00–07:45', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Cả tuần' }).click()
  await expect(page.getByText('33 tiết trong tuần')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.goto('/classhub/hs')
  await expect(page.getByRole('heading', { name: 'Lịch lớp 8A' })).toBeAttached()
  await expect(page.getByRole('button', { name: 'Đổi lớp' })).toBeVisible()
  await page.getByRole('button', { name: 'Đổi lớp' }).click()
  await expect(page.getByRole('heading', { name: 'Em học lớp nào?' })).toBeVisible()
  await page.goto('/classhub')
  await expect(page.getByRole('link', { name: /Mở thời khóa biểu lớp 8A/ })).toBeVisible()
  expect((await context.cookies()).some(cookie => cookie.name.startsWith('afyllx-classhub'))).toBe(false)
})

test('ClassHub opens directly in an editable guest workspace isolated by browser', async ({ page, browser, context }) => {
  const app = '/classhub'
  const demo = app + '/api/v1/demo'
  const origin = 'http://127.0.0.1:5178'
  await page.goto(app)
  await page.getByRole('link', { name: 'Xem bản dùng thử' }).click()
  await expect(page).toHaveURL(new RegExp(app + '/thu$'))
  await expect(page.getByRole('heading', { name: 'Hôm nay', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Buổi học theo ngày' })).toBeVisible()
  await expect(page.getByText('88,2%', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '14 ngày', exact: true }).click()
  await page.getByText('Dữ liệu từng ngày', { exact: true }).click()
  await expect(page.getByRole('region', { name: 'Số buổi theo từng ngày' }).getByRole('row')).toHaveCount(15)
  await expect(page.getByRole('region', { name: 'Thống kê lớp học' }).getByRole('row')).toHaveCount(3)
  await page.getByRole('link', { name: /Mở để chốt/ }).first().click()
  await expect(page.getByRole('heading', { name: 'Danh sách điểm danh' })).toBeVisible()
  await expect(page.getByText('Còn 3 học viên chưa được đánh dấu.')).toBeVisible()
  await page.getByRole('link', { name: 'Hôm nay', exact: true }).click()
  await expect(page.getByText('Bản dùng thử', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Mật khẩu')).toHaveCount(0)
  expect((await context.cookies()).some(cookie =>
    cookie.name === 'afyllx-classhub-demo' && cookie.path === demo && cookie.httpOnly,
  )).toBe(true)

  const open = async (request: typeof page.request) => (await (await request.post(demo + '/session', {
    headers: { Origin: origin }, data: {},
  })).json()).data.workspaces[0].id as string
  const id = await open(page.request)
  const students = demo + '/orgs/' + id + '/students'
  const importData = [
    { code: 'mau01', name: 'Tên không được ghi đè' },
    { code: 'QA-IMPORT', name: 'Hồ sơ nhập thử' },
  ]
  const preview = await page.request.post(students + '/import', { headers: { Origin: origin }, data: { preview: true, students: importData } })
  expect(await preview.json()).toEqual({ data: { existing: ['mau01'] } })
  const imported = await page.request.post(students + '/import', { headers: { Origin: origin }, data: { preview: false, students: importData } })
  expect(await imported.json()).toEqual({ data: { created: 1, skipped: 1 } })
  const created = await page.request.post(students, {
    headers: { Origin: origin }, data: { code: 'QA-01', name: 'Học viên chỉ có ở phiên này' },
  })
  expect(created.status()).toBe(201)
  await page.getByRole('link', { name: 'Học viên', exact: true }).click()
  await expect(page.getByText('Học viên chỉ có ở phiên này', { exact: true })).toBeVisible()
  await expect(page.getByText('Hồ sơ nhập thử', { exact: true })).toBeVisible()
  await expect(page.getByText('Học viên mẫu An', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText('Học viên chỉ có ở phiên này', { exact: true })).toBeVisible()
  expect((await page.request.get(app + '/api/v1/orgs/' + id + '/students')).status()).toBe(401)

  const other = await browser.newContext({ baseURL: origin })
  try {
    expect((await other.request.get(students)).status()).toBe(401)
    expect(await open(other.request)).not.toBe(id)
    expect((await other.request.get(students)).status()).toBe(404)
    expect((await other.request.get(demo + '/orgs/' + id + '/dashboard/analytics')).status()).toBe(404)
    expect((await other.request.post(students, {
      headers: { Origin: origin }, data: { code: 'QA-02', name: 'Ghi chéo' },
    })).status()).toBe(404)
  } finally {
    await other.close()
  }
})

test('ClassHub activation and the shared roster work under the Edu gateway prefix', async ({ page, context }) => {
  const owner = JSON.parse(await readFile(
    '.wrangler/qa-' + process.env.CLASSHUB_QA_ID + '-web/owners.json', 'utf8',
  ))[0] as { email: string; code: string }
  const orgId = '51740000-0000-4000-8000-000000000002'
  const app = '/classhub'
  const api = app + '/api/v1/orgs/' + orgId
  expect((await page.request.get(api + '/students')).status()).toBe(401)
  expect(await (await page.request.get('/api/health')).text()).toBe('MealCheck QA')
  expect((await page.request.post(app + '/api/v1/activate', {
    headers: { Origin: 'https://another.example' }, data: {},
  })).status()).toBe(403)

  await page.goto(app + '/truy-cap')
  await page.getByRole('button', { name: 'Tôi có mã mời và cần tạo tài khoản' }).click()
  await page.getByRole('textbox', { name: 'Họ và tên' }).fill('Quản trị QA')
  await page.getByRole('textbox', { name: 'Email' }).fill(owner.email)
  await page.getByLabel('Mật khẩu').fill('Fictional-QA-Password-42')
  await page.getByRole('textbox', { name: 'Mã mời' }).fill(owner.code)
  await page.getByRole('button', { name: 'Kích hoạt và đăng nhập' }).click()
  await page.getByRole('checkbox', { name: 'Mã mời tạo đơn vị mới' }).check()
  await page.getByRole('textbox', { name: 'Tên đơn vị' }).fill('Đơn vị QA')
  await page.getByRole('button', { name: 'Tạo không gian' }).click()
  await expect(page).toHaveURL(new RegExp(app + '/w/' + orgId + '$'))
  expect((await context.cookies()).some(cookie =>
    cookie.name.includes('afyllx-classhub') && cookie.path === app && cookie.httpOnly,
  )).toBe(true)
  const dashboard = await (await page.request.get(api + '/dashboard')).json()
  expect(dashboard.data.stats.enrolled_students).toBe(275)

  await page.getByRole('link', { name: 'Học viên', exact: true }).click()
  await expect(page.getByText('Học sinh chung QA 01', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page).toHaveURL(new RegExp(app + '/w/' + orgId + '/hoc-vien$'))
  await expect(page.getByText('Học sinh chung QA 01', { exact: true })).toBeVisible()
  const shared = (await (await page.request.get(api + '/shared-directory')).json()).data
  expect(shared.classes).toHaveLength(8)
})
