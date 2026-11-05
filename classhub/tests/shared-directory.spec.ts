import { expect, test } from '@playwright/test'

const origin = 'http://127.0.0.1:5177'
const org = '51740000-0000-4000-8000-000000000002'
const route = origin + '/api/v1/orgs/' + org
const source = 'http://127.0.0.1:5180'

test('two products use the same roster while QR and past enrollment identities survive edits', async ({ page }) => {
  const client = page.request
  const initial = await (await client.get(source + '/qa/state')).json()
  const metadataResponse = await client.get(route + '/shared-directory')
  const metadata = await metadataResponse.json()
  expect(metadataResponse.status(), metadata.error?.message).toBe(200)
  expect(metadata.data.classes).toHaveLength(2)
  const list = await (await client.get(route + '/students')).json()
  expect(list.data).toHaveLength(3)
  const student = list.data.find((item: { code: string }) => item.code === '001')
  const class9 = metadata.data.classes.find((item: { name: string }) => item.name === '9B')
  const class8 = metadata.data.classes.find((item: { name: string }) => item.name === '8A')
  const historyBefore = await (await client.get(route + '/students/' + student.id + '/enrollments')).json()
  expect(historyBefore.data).toHaveLength(1)
  await client.post(source + '/qa/mealcheck-edit', { data: {
    rows: [{ code: '001', name: 'Học sinh chung QA đã đổi', grade: '9', class: '9B' }],
  } })
  const fresh = await (await client.get(route + '/students')).json()
  expect(fresh.data.find((item: { code: string }) => item.code === '001').name).toBe('Học sinh chung QA đã đổi')
  const stale = await client.patch(route + '/students/' + student.id, { headers: { Origin: origin }, data: {
    code: '001', name: 'Ghi đè cũ', class_id: class8.id, active: 1,
    operation_id: crypto.randomUUID(), revision: metadata.data.revision,
  } })
  expect(stale.status()).toBe(409)
  await page.goto(origin + '/w/' + org + '/hoc-vien')
  await expect(page.getByText('Danh sách dùng chung với MealCheck web.', { exact: false })).toBeVisible()
  const row = page.locator('details').filter({ has: page.getByText('Học sinh chung QA đã đổi', { exact: true }) })
  await row.locator('summary').click()
  await row.getByRole('textbox', { name: 'Họ và tên', exact: true }).fill('Học sinh QA sửa từ ClassHub')
  await row.getByRole('combobox', { name: 'Lớp sinh hoạt' }).selectOption(class8.id)
  await row.getByRole('button', { name: 'Lưu thay đổi' }).click()
  await expect(page.getByText('Đã lưu vào danh sách chung.')).toBeVisible()
  const changed = await (await client.get(source + '/qa/state')).json()
  expect(changed.snapshot.students.find((item: { code: string }) => item.code === '001').name).toBe('Học sinh QA sửa từ ClassHub')
  expect(changed.snapshot.students.find((item: { code: string }) => item.code === '001').class_id).toBe(class8.id)
  expect(changed.qrHash).toBe(initial.qrHash)
  const historyAfter = await (await client.get(route + '/students/' + student.id + '/enrollments')).json()
  expect(historyAfter.data).toHaveLength(2)
  expect(historyAfter.data.some((item: { withdrawn_on: string | null }) => item.withdrawn_on !== null)).toBe(true)
  await page.goto(origin + '/w/' + org + '/thiet-lap')
  await page.getByRole('textbox', { name: 'Khối', exact: true }).first().fill('7')
  await page.getByRole('textbox', { name: 'Tên lớp chung', exact: true }).first().fill('7C')
  await page.getByRole('button', { name: 'Thêm lớp chung' }).click()
  await expect(page.getByText('Đã lưu lớp vào danh sách chung.')).toBeVisible()
  const afterCreate = await (await client.get(source + '/qa/state')).json()
  expect(afterCreate.snapshot.classes.some((item: { name: string }) => item.name === '7C')).toBe(true)
  const latest = await (await client.get(route + '/shared-directory')).json()
  const rename = await client.post(route + '/shared-directory/classes', { headers: { Origin: origin }, data: {
    id: class9.id, name: '9C', grade: '9', revision: latest.data.revision, operation_id: crypto.randomUUID(),
  } })
  expect(rename.status()).toBe(200)
  const roster = await (await client.get(route + '/classes')).json()
  expect(roster.data.find((item: { id: string }) => item.id === class9.class_id).name).toBe('9C')
  await page.reload()
  expect((await (await client.get(source + '/qa/state')).json()).qrHash).toBe(initial.qrHash)
})
