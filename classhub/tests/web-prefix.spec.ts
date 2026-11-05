import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

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

  await page.goto(app)
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

  await page.getByRole('link', { name: 'Học viên' }).click()
  await expect(page.getByText('Học sinh chung QA 01', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page).toHaveURL(new RegExp(app + '/w/' + orgId + '/hoc-vien$'))
  await expect(page.getByText('Học sinh chung QA 01', { exact: true })).toBeVisible()
  const shared = (await (await page.request.get(api + '/shared-directory')).json()).data
  expect(shared.classes).toHaveLength(8)
})
