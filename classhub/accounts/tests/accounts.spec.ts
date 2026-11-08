import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { expect, request, test, type APIRequestContext, type Page } from '@playwright/test'

// Isolated QA runtime with a fictional founder. Each actor uses its own documentation IP so the sign-in
// rate limit of one does not affect another.
const origin = 'http://127.0.0.1:5191'
const founderPassword = 'Founder-QA-Only-2026!'
const adminPassword = 'Admin-QA-Only-2026!!'
const ipFor = (n: number) => ({ 'CF-Connecting-IP': '198.51.100.' + n })

function totp(secret: string, offsetSteps = 0) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = 0, value = 0
  const bytes: number[] = []
  for (const char of secret.replace(/\s/g, '')) {
    value = (value << 5) | alphabet.indexOf(char)
    bits += 5
    if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 255); bits -= 8 }
  }
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000) + offsetSteps))
  const mac = createHmac('sha1', Buffer.from(bytes)).update(counter).digest()
  const offset = mac[mac.length - 1] & 15
  return String(((mac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000)).padStart(6, '0')
}
async function call(client: APIRequestContext, path: string, method = 'GET', data?: unknown, status = 200) {
  const response = await client.fetch(origin + path, {
    method, ...(method === 'GET' ? {} : { headers: { Origin: origin, 'Content-Type': 'application/json' }, data: data ?? {} }),
  })
  const json = await response.json().catch(() => null)
  expect(response.status(), method + ' ' + path + ' ' + (json?.error?.message ?? '')).toBe(status)
  return json?.data
}
async function enroll(page: Page) {
  await expect(page.getByRole('img', { name: /Mã QR thiết lập/ })).toBeVisible()
  const secret = (await page.locator('.ac-secret code').innerText()).replace(/\s/g, '')
  await page.getByLabel('Mã 6 số từ ứng dụng').fill(totp(secret))
  await page.getByRole('button', { name: 'Bật xác thực hai lớp' }).click()
  const list = page.getByRole('list', { name: 'Mã khôi phục' }).locator('code')
  await expect(list).toHaveCount(10)
  const codes = await list.allInnerTexts()
  await page.getByLabel('Tôi đã cất kỹ các mã này').check()
  await page.getByRole('button', { name: 'Tiếp tục' }).click()
  return { secret, codes }
}
async function setPassword(page: Page, link: string, password: string) {
  await page.goto(link)
  await expect(page).toHaveURL(/\/dat-mat-khau$/)
  await page.getByLabel('Mật khẩu mới', { exact: true }).fill(password)
  await page.getByLabel('Nhập lại mật khẩu mới').fill(password)
  await page.getByRole('button', { name: 'Lưu và đăng nhập' }).click()
}

test('founder activates with a password, opts into a second factor and manages platform roles; protections hold', async ({ browser }) => {
  const qa = process.env.ACCOUNTS_QA_ID
  const founder = JSON.parse(readFileSync(new URL('../.wrangler/qa-' + qa + '/founder.json', import.meta.url), 'utf8')) as { email: string; code: string }
  const phone = await browser.newContext({ baseURL: origin, viewport: { width: 390, height: 844 }, isMobile: true, extraHTTPHeaders: ipFor(11) })
  const second = await browser.newContext({ baseURL: origin, viewport: { width: 1180, height: 820 }, extraHTTPHeaders: ipFor(12) })
  const stranger = await request.newContext({ baseURL: origin, extraHTTPHeaders: ipFor(13) })
  try {
    // Unauthenticated and cross-origin requests are refused.
    await call(stranger, '/api/me', 'GET', undefined, 401)
    expect((await stranger.post(origin + '/api/login', { headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' },
      data: { email: founder.email, password: 'x' } })).status()).toBe(403)

    // Activation link → password → founder home directly (password-only sign-in is the owner's choice).
    const page = await phone.newPage()
    await setPassword(page, '/dat-mat-khau#' + founder.code, founderPassword)
    await expect(page.getByRole('heading', { name: 'Founder QA' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Bật xác thực hai lớp' })).toHaveCount(0)
    await expect(page.getByText('Bạn đang dùng quyền Founder', { exact: false })).toBeVisible()
    await expect(page.getByText('AFYLLX Account Founder').first()).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
    const cookie = (await phone.cookies()).find(item => item.name === 'afyllx_session')!
    expect(cookie.httpOnly).toBe(true)
    expect(cookie.path).toBe('/')
    expect(cookie.expires * 1000).toBeLessThan(Date.now() + 13 * 3_600_000)
    await call(stranger, '/api/password/set', 'POST', { code: founder.code, password: 'Another-Password-2026' }, 404)

    // The second factor stays available as an opt-in from the Security tab.
    await page.getByRole('link', { name: 'Bảo mật' }).click()
    await expect(page.getByText('Tùy chọn. Hiện chỉ cần mật khẩu để đăng nhập.')).toBeVisible()
    await page.getByRole('button', { name: 'Bật xác thực hai lớp' }).click()
    // A signed-in session alone cannot set up a second factor: the password is asked again.
    await call(phone.request, '/api/mfa/enroll', 'POST', {}, 400)
    await page.getByLabel('Nhập lại mật khẩu để tiếp tục').fill('wrong-password-123')
    await page.getByRole('button', { name: 'Hiện mã QR thiết lập' }).click()
    await expect(page.getByText('Mật khẩu hiện tại chưa đúng.')).toBeVisible()
    await page.getByLabel('Nhập lại mật khẩu để tiếp tục').fill(founderPassword)
    await page.getByRole('button', { name: 'Hiện mã QR thiết lập' }).click()
    const { secret, codes } = await enroll(page)
    await expect(page.getByText('Đang bật')).toBeVisible()

    // The founder creates a platform administrator; the link works once.
    await page.getByRole('link', { name: 'Quản trị' }).click()
    await page.getByLabel('Họ và tên').fill('Quản trị QA')
    await page.getByLabel('Email').fill('admin@example.test')
    await page.getByLabel('Vai trò hệ thống').selectOption('platform_admin')
    await page.getByRole('button', { name: 'Tạo và lấy link kích hoạt' }).click()
    const adminLink = await page.getByLabel('Link một lần').inputValue()
    expect(adminLink).toContain('/dat-mat-khau#')

    const adminPage = await second.newPage()
    await setPassword(adminPage, adminLink.replace(origin, ''), adminPassword)
    await expect(adminPage.getByText('Quản trị hệ thống').first()).toBeVisible()
    await adminPage.getByRole('link', { name: 'Quản trị' }).click()
    await expect(adminPage.getByLabel('Vai trò hệ thống')).toHaveCount(0)
    const accounts = await call(second.request, '/api/admin/accounts')
    const founderRow = accounts.find((row: { email: string }) => row.email === founder.email)
    await call(second.request, '/api/admin/accounts/' + founderRow.id, 'PATCH', { status: 'disabled' }, 403)
    await call(second.request, '/api/admin/accounts', 'POST', { email: 'x@example.test', name: 'X', platform_role: 'founder' }, 403)
    const user = await call(second.request, '/api/admin/accounts', 'POST', { email: 'user@example.test', name: 'Người dùng QA', platform_role: null }, 201)
    expect(user.code).toMatch(/^[0-9a-f]{64}$/)

    // The founder cannot remove their own founder role; the last founder is protected.
    await call(phone.request, '/api/admin/accounts/' + founderRow.id, 'PATCH', { platform_role: null }, 400)

    // Sign out, then sign in again with a recovery code, then with a fresh authenticator code.
    await page.getByRole('button', { name: 'Đăng xuất' }).click()
    await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible()
    await page.getByLabel('Email').fill(founder.email)
    await page.getByLabel('Mật khẩu').fill('wrong-password-123')
    await page.getByRole('button', { name: 'Đăng nhập' }).click()
    await expect(page.getByText('Email hoặc mật khẩu chưa đúng.')).toBeVisible()
    await page.getByLabel('Mật khẩu').fill(founderPassword)
    await page.getByRole('button', { name: 'Đăng nhập' }).click()
    await expect(page.getByRole('heading', { name: 'Xác thực hai lớp' })).toBeVisible()
    await call(phone.request, '/api/admin/accounts', 'GET', undefined, 401)
    await page.getByRole('button', { name: 'Mất điện thoại? Dùng mã khôi phục' }).click()
    await page.getByLabel('Mã khôi phục').fill(codes[0].toUpperCase())
    await page.getByRole('button', { name: 'Xác nhận' }).click()
    await expect(page.getByText('Bạn vừa đăng nhập bằng mã khôi phục', { exact: false })).toBeVisible()
    await page.getByRole('button', { name: 'Đăng xuất' }).click()
    await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible()
    await page.getByLabel('Email').fill(founder.email)
    await page.getByLabel('Mật khẩu').fill(founderPassword)
    await page.getByRole('button', { name: 'Đăng nhập' }).click()
    await page.getByLabel('Mã 6 số').fill(totp(secret, 1))
    await page.getByRole('button', { name: 'Xác nhận' }).click()
    await expect(page.getByRole('heading', { name: 'Founder QA' })).toBeVisible()

    // Blocking the administrator signs them out everywhere; the audit log records it.
    const adminRow = (await call(phone.request, '/api/admin/accounts')).find((row: { email: string }) => row.email === 'admin@example.test')
    await call(phone.request, '/api/admin/accounts/' + adminRow.id, 'PATCH', { status: 'disabled' })
    await call(second.request, '/api/me', 'GET', undefined, 401)
    const audit = await (await phone.request.get(origin + '/api/admin/audit')).json()
    const events = audit.data.map((row: { action: string }) => row.action)
    for (const action of ['account.updated', 'login.second_factor', 'login.failed', 'mfa.enabled', 'account.created', 'account.activated']) {
      expect(events).toContain(action)
    }
  } finally {
    await Promise.all([phone.close(), second.close(), stranger.dispose()])
  }
})
