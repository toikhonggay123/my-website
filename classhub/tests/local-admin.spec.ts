import { expect, test } from '@playwright/test'

const origin = 'http://127.0.0.1:5176'

test('loopback opens administration directly and keeps teachers usable without credentials', async ({ page }) => {
  const identity = await page.request.get(origin + '/api/v1/me')
  expect(identity.status()).toBe(200)
  expect(identity.headers()['set-cookie']).toBeUndefined()
  const { data } = await identity.json()
  expect(data.local).toBe(true)
  expect(data.workspaces).toHaveLength(1)
  const org = data.workspaces[0].id
  const api = origin + '/api/v1/orgs/' + org
  expect((await page.request.post(origin + '/api/auth/sign-in/email', {
    headers: { Origin: origin }, data: {},
  })).status()).toBe(404)
  expect((await page.request.post(api + '/staff', {
    headers: { Origin: 'https://untrusted.example.test' }, data: { name: 'QA' },
  })).status()).toBe(403)
  await page.goto(origin)
  await expect(page.getByRole('heading', { name: 'Tổng quan' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Đăng nhập', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Đăng xuất', exact: true })).toHaveCount(0)
  await page.getByRole('link', { name: 'Nhân sự' }).click()
  await page.getByLabel('Họ và tên giáo viên').fill('Giáo viên local QA')
  await page.getByRole('button', { name: 'Thêm giáo viên', exact: true }).click()
  await expect(page.getByText('Đã thêm giáo viên.')).toBeVisible()
  await page.reload()
  await expect(page.getByText('Giáo viên local QA', { exact: true })).toBeVisible()
  const course = await page.request.post(api + '/courses', {
    headers: { Origin: origin }, data: { code: 'QA-DIRECT', name: 'Khóa QA', subject: 'Toán' },
  })
  expect(course.status()).toBe(201)
  const courseId = (await course.json()).data.id
  const branch = (await (await page.request.get(api + '/branches')).json()).data[0].id
  const staff = (await (await page.request.get(api + '/staff')).json()).data.find(
    (member: { role: string }) => member.role === 'teacher',
  )
  const lesson = await page.request.post(api + '/classes', { headers: { Origin: origin }, data: {
    code: 'QA-DIRECT', name: 'Lớp QA', course_id: courseId, branch_id: branch,
    starts_on: '2026-01-01', ends_on: '2027-12-31', capacity: 20,
  } })
  expect(lesson.status()).toBe(201)
  const classId = (await lesson.json()).data.id
  expect((await page.request.post(api + '/classes/' + classId + '/teachers', { headers: { Origin: origin }, data: {
    user_id: staff.user_id, duty: 'primary',
  } })).status()).toBe(201)
})
