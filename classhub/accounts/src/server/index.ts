import { bodyLimit } from 'hono/body-limit'
import { secureHeaders } from 'hono/secure-headers'
import { z } from 'zod'
import {
  type Account, type Bindings, type Ctx, type PlatformRole, Failure, audit, bad, body, db, denied, email, endSession, ip, limit, loadAuth,
  missing, needsSecondFactor, newId, now, one, password, query, requireFull, requirePlatform, result, revokeSessions, router, rows,
  startSession, text, validated,
} from './core'
import {
  hashPassword, newTotpSecret, normalizeRecovery, otpauthUri, randomHex, recoveryCodes, seal, sha256, unseal, verifyPassword, verifyTotp,
} from './crypto'
import { apiRateLimited, clientKey } from '../../../src/server/edge'

const app = router()
const day = 86_400_000
const platformRole = z.enum(['founder', 'platform_admin', 'support'])
const products = [
  { id: 'classhub', name: 'ClassHub', description: 'Lớp học, thời khóa biểu, điểm danh', path: 'https://edu.afyllx.com/classhub' },
  { id: 'mealcheck', name: 'CheckIn', description: 'Điểm danh học sinh bằng thẻ QR', path: 'https://edu.afyllx.com/mealcheck' },
  { id: 'edu', name: 'Cổng AFYLLX Edu', description: 'Trang chính của AFYLLX Edu', path: 'https://edu.afyllx.com/' },
]
const publicAccount = (account: Account) => ({
  id: account.id, email: account.email, name: account.name, platform_role: account.platform_role, mfa_enabled: Boolean(account.totp_secret),
})

app.use('*', secureHeaders())
// Flood limit per client before the session lookup (cloud only, see edge.ts).
app.use('/api/*', async (c, next) => (await apiRateLimited(c.req.raw, c.env.API_LIMIT)) ?? next())
app.use('*', async (c, next) => {
  c.header('Cache-Control', 'no-store')
  // The Worker answers on its own domain and, for the API, under the Edu gateway. Anything else is refused.
  const origins = [c.env.APP_ORIGIN, ...(c.env.EXTRA_ORIGINS ?? '').split(',').map(item => item.trim()).filter(Boolean)]
  if ((c.env.APP_BASE_PATH || c.env.EXTRA_ORIGINS) && !origins.includes(new URL(c.req.url).origin)) throw missing()
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(c.req.method)) {
    if (!origins.includes(c.req.header('Origin') ?? '')) throw new Failure(403, 'origin', 'Nguồn yêu cầu không hợp lệ.')
    if (!/^application\/json(?:\s*;|$)/i.test(c.req.header('Content-Type') ?? '')) throw bad('Yêu cầu cần dùng định dạng JSON.')
  }
  c.set('auth', await loadAuth(c))
  await next()
})
app.use('*', bodyLimit({ maxSize: 32 * 1024, onError: () => { throw new Failure(413, 'request_too_large', 'Dữ liệu vượt giới hạn.') } }))

app.get('/api/health', async c => {
  await db(c).prepare('SELECT 1').first()
  return c.json({ status: 'ok' })
})

/* ------------------------------------------------------------------ Sign-in */

/**
 * Sign-in lockout over the last 15 minutes of failures for one email. Failures count per client network (IPv4
 * address or IPv6 /64, stored as details.client of each login.failed row), so guessing from one place cannot keep
 * the real owner out from anywhere else. A much higher cap across every network stops a distributed guess at one
 * account. Both answer with the same message, whether or not the email has an account.
 */
const loginLock = { window: 15 * 60_000, perClient: 10, perEmail: 100 }

app.post('/api/login', async c => {
  const client = clientKey(ip(c))
  await limit(c, 'login:' + client)
  const input = await body(c, z.object({ email, password: z.string().min(1).max(128) }))
  const recent = await one<{ client: number; total: number }>(c, `SELECT COUNT(CASE WHEN json_extract(details,'$.client')=? THEN 1 END) AS client,
    COUNT(*) AS total FROM audit_events WHERE action='login.failed' AND target_id=? AND occurred_at>?`, client, input.email, now() - loginLock.window)
  if ((recent?.client ?? 0) >= loginLock.perClient || (recent?.total ?? 0) >= loginLock.perEmail) {
    throw new Failure(429, 'locked', 'Đăng nhập tạm khóa 15 phút vì nhập sai nhiều lần.')
  }
  const account = await one<Account>(c, 'SELECT * FROM accounts WHERE email=?', input.email)
  const valid = await verifyPassword(input.password, account?.password_hash ?? null)
  if (!account || !valid || account.status !== 'active') {
    await audit(c, 'login.failed', input.email, { client }, account?.id ?? null).run()
    throw new Failure(401, 'invalid_login', 'Email hoặc mật khẩu chưa đúng.')
  }
  await startSession(c, account)
  await query(c, 'UPDATE accounts SET last_login_at=? WHERE id=?', now(), account.id).run()
  await audit(c, 'login.password', account.id, {}, account.id).run()
  return result(c, { state: !needsSecondFactor(account) ? 'full' : account.totp_secret ? 'mfa' : 'enroll' })
})

app.post('/api/logout', async c => {
  const auth = c.get('auth')
  if (auth) await query(c, 'DELETE FROM sessions WHERE id=?', auth.session.id).run()
  endSession(c)
  return result(c, { signedOut: true })
})

app.get('/api/me', async c => {
  const auth = c.get('auth')
  if (!auth) throw new Failure(401, 'unauthenticated', 'Vui lòng đăng nhập.')
  if (auth.state !== 'full') return result(c, { state: auth.state, account: { email: auth.account.email, name: auth.account.name } })
  const role = auth.account.platform_role
  const memberships = await rows<{ org_id: string; name: string; role: string }>(c, `SELECT m.org_id,o.name,m.role FROM memberships m
    JOIN organizations o ON o.id=m.org_id WHERE m.account_id=? AND o.status='active' ORDER BY o.name`, auth.account.id)
  return result(c, {
    state: 'full', account: publicAccount(auth.account), memberships,
    products: role === 'founder' || role === 'platform_admin' ? products.map(item => ({ ...item, access: 'Toàn quyền' }))
      : products.filter(item => item.id === 'edu').map(item => ({ ...item, access: 'Xem' })),
    session: { expires_at: auth.session.expires_at, absolute_expires_at: auth.session.absolute_expires_at },
  })
})

/* ------------------------------------------------------------------ Second factor */

async function finishSecondFactor(c: Ctx, sessionId: string) {
  await query(c, 'UPDATE sessions SET mfa_passed=1 WHERE id=?', sessionId).run()
}

app.post('/api/mfa/verify', async c => {
  const auth = c.get('auth')
  if (!auth || auth.state !== 'mfa' || !auth.account.totp_secret) throw new Failure(401, 'unauthenticated', 'Vui lòng đăng nhập lại.')
  await limit(c, 'mfa:' + auth.account.id)
  const { code } = await body(c, z.object({ code: z.string().trim().min(6).max(20) }))
  const digits = code.replace(/\s/g, '')
  if (/^\d{6}$/.test(digits)) {
    const step = await verifyTotp(await unseal(auth.account.totp_secret, c.env.ACCOUNTS_ENCRYPTION_KEY), digits, auth.account.totp_last_step)
    if (step) {
      await query(c, 'UPDATE accounts SET totp_last_step=? WHERE id=? AND totp_last_step<?', step, auth.account.id, step).run()
      await finishSecondFactor(c, auth.session.id)
      await audit(c, 'login.second_factor', auth.account.id, { method: 'totp' }, auth.account.id).run()
      return result(c, { state: 'full' })
    }
  } else {
    const used = await query(c, 'UPDATE recovery_codes SET used_at=? WHERE account_id=? AND code_hash=? AND used_at IS NULL',
      now(), auth.account.id, await sha256(normalizeRecovery(code))).run()
    if (used.meta.changes) {
      await finishSecondFactor(c, auth.session.id)
      await audit(c, 'login.second_factor', auth.account.id, { method: 'recovery_code' }, auth.account.id).run()
      return result(c, { state: 'full', recovery: true })
    }
  }
  await audit(c, 'login.second_factor_failed', auth.account.id, {}, auth.account.id).run()
  throw bad('Mã chưa đúng. Kiểm tra lại mã 6 số trên ứng dụng xác thực.')
})

/** How long a new authenticator setup stays open between enrol and confirm. */
const pendingLifetime = 10 * 60_000
type PendingSecond = { secret: string; session: string; at: number }
/** The pending setup, or null when it is missing, unreadable or from before setups were tied to a session. */
async function pendingSecond(c: Ctx, sealed: string | null | undefined): Promise<PendingSecond | null> {
  if (!sealed) return null
  try {
    const value = JSON.parse(await unseal(sealed, c.env.ACCOUNTS_ENCRYPTION_KEY)) as Partial<PendingSecond>
    return typeof value?.secret === 'string' && typeof value.session === 'string' && typeof value.at === 'number' ? value as PendingSecond : null
  } catch {
    return null
  }
}

app.post('/api/mfa/enroll', async c => {
  const auth = c.get('auth')
  // The 'enroll' state comes straight from the password step. A full session is a device that may be borrowed or
  // stolen: turning on or replacing the second factor (which signs out every other device) needs the password again.
  if (!auth || (auth.state !== 'enroll' && auth.state !== 'full')) throw new Failure(401, 'unauthenticated', 'Vui lòng đăng nhập lại.')
  if (auth.state === 'full') {
    await limit(c, 'mfa:' + auth.account.id)
    const input = await body(c, z.object({ password: z.string().min(1).max(128) }))
    if (!await verifyPassword(input.password, auth.account.password_hash)) {
      await audit(c, 'mfa.enroll_denied', auth.account.id, {}, auth.account.id).run()
      throw bad('Mật khẩu hiện tại chưa đúng.')
    }
  }
  const secret = newTotpSecret()
  // Sealed with this session and the time, so only this verified setup can be confirmed, and only for a short while.
  const pending = JSON.stringify({ secret, session: auth.session.id, at: now() } satisfies PendingSecond)
  await query(c, 'UPDATE accounts SET totp_pending=?,updated_at=? WHERE id=?', await seal(pending, c.env.ACCOUNTS_ENCRYPTION_KEY), now(), auth.account.id).run()
  return result(c, { secret, uri: otpauthUri(secret, auth.account.email) })
})

app.post('/api/mfa/confirm', async c => {
  const auth = c.get('auth')
  if (!auth || (auth.state !== 'enroll' && auth.state !== 'full')) throw new Failure(401, 'unauthenticated', 'Vui lòng đăng nhập lại.')
  await limit(c, 'mfa:' + auth.account.id)
  const { code } = await body(c, z.object({ code: z.string().trim().regex(/^\d{6}$/, 'Nhập đúng mã 6 số.') }))
  const sealed = (await one<{ totp_pending: string | null }>(c, 'SELECT totp_pending FROM accounts WHERE id=?', auth.account.id))?.totp_pending
  const pending = await pendingSecond(c, sealed)
  if (!sealed || !pending || pending.session !== auth.session.id || now() - pending.at > pendingLifetime) throw bad('Hãy bắt đầu lại bước thiết lập.')
  const step = await verifyTotp(pending.secret, code, 0)
  if (!step) throw bad('Mã chưa đúng. Kiểm tra giờ trên điện thoại và nhập mã mới nhất.')
  const codes = recoveryCodes()
  const timestamp = now()
  // Only the setup that was just checked: a newer enrol in the meantime makes this one stale.
  const enabled = await query(c, 'UPDATE accounts SET totp_secret=?,totp_pending=NULL,totp_last_step=?,updated_at=? WHERE id=? AND totp_pending=?',
    await seal(pending.secret, c.env.ACCOUNTS_ENCRYPTION_KEY), step, timestamp, auth.account.id, sealed).run()
  if (!enabled.meta.changes) throw bad('Hãy bắt đầu lại bước thiết lập.')
  await db(c).batch([
    query(c, 'DELETE FROM recovery_codes WHERE account_id=?', auth.account.id),
    ...await Promise.all(codes.map(async item => query(c, 'INSERT INTO recovery_codes(account_id,code_hash,created_at) VALUES (?,?,?)',
      auth.account.id, await sha256(item), timestamp))),
    query(c, 'UPDATE sessions SET mfa_passed=1 WHERE id=?', auth.session.id),
    // Other devices must sign in again with the new second factor.
    query(c, 'DELETE FROM sessions WHERE account_id=? AND id<>?', auth.account.id, auth.session.id),
    audit(c, 'mfa.enabled', auth.account.id, {}, auth.account.id),
  ])
  return result(c, { state: 'full', recoveryCodes: codes })
})

app.post('/api/recovery-codes', async c => {
  const auth = requireFull(c)
  const input = await body(c, z.object({ password: z.string().min(1).max(128) }))
  if (!auth.account.totp_secret) throw bad('Hãy bật xác thực hai lớp trước.')
  if (!await verifyPassword(input.password, auth.account.password_hash)) throw bad('Mật khẩu hiện tại chưa đúng.')
  const codes = recoveryCodes()
  const timestamp = now()
  await db(c).batch([
    query(c, 'DELETE FROM recovery_codes WHERE account_id=?', auth.account.id),
    ...await Promise.all(codes.map(async item => query(c, 'INSERT INTO recovery_codes(account_id,code_hash,created_at) VALUES (?,?,?)',
      auth.account.id, await sha256(item), timestamp))),
    audit(c, 'mfa.recovery_codes_regenerated', auth.account.id),
  ])
  return result(c, { recoveryCodes: codes })
})

/* ------------------------------------------------------------------ Passwords and sessions */

app.post('/api/password/change', async c => {
  const auth = requireFull(c)
  const input = await body(c, z.object({ current: z.string().min(1).max(128), next: password }))
  if (!await verifyPassword(input.current, auth.account.password_hash)) throw bad('Mật khẩu hiện tại chưa đúng.')
  await db(c).batch([
    query(c, 'UPDATE accounts SET password_hash=?,updated_at=? WHERE id=?', await hashPassword(input.next), now(), auth.account.id),
    query(c, 'DELETE FROM sessions WHERE account_id=? AND id<>?', auth.account.id, auth.session.id),
    audit(c, 'password.changed', auth.account.id),
  ])
  return result(c, { changed: true })
})

/** Completes an activation or reset link: sets the password, ends every session, returns the email to sign in. */
app.post('/api/password/set', async c => {
  await limit(c, 'link:' + ip(c))
  const input = await body(c, z.object({ code: z.string().regex(/^[0-9a-f]{64}$/), password }))
  const token = await one<{ id: string; account_id: string; kind: string; email: string }>(c, `SELECT t.id,t.account_id,t.kind,a.email
    FROM action_tokens t JOIN accounts a ON a.id=t.account_id WHERE t.token_hash=? AND t.used_at IS NULL AND t.expires_at>? AND a.status='active'`,
  await sha256(input.code), now())
  if (!token) throw new Failure(404, 'link_invalid', 'Link đã dùng hoặc hết hạn. Hãy nhờ quản trị AFYLLX tạo link mới.')
  const timestamp = now()
  const writes = await db(c).batch([
    query(c, 'UPDATE action_tokens SET used_at=? WHERE id=? AND used_at IS NULL', timestamp, token.id),
    query(c, 'UPDATE accounts SET password_hash=?,updated_at=? WHERE id=? AND changes()=1', await hashPassword(input.password), timestamp, token.account_id),
    query(c, 'DELETE FROM sessions WHERE account_id=? AND EXISTS (SELECT 1 FROM action_tokens WHERE id=? AND used_at=?)', token.account_id, token.id, timestamp),
    audit(c, token.kind === 'activate' ? 'account.activated' : 'password.reset', token.account_id, {}, token.account_id),
  ])
  if (!writes[0].meta.changes) throw new Failure(409, 'link_used', 'Link vừa được dùng. Hãy đăng nhập bằng mật khẩu mới.')
  return result(c, { email: token.email })
})

app.get('/api/sessions', async c => {
  const auth = requireFull(c)
  const list = await rows<{ id: string; created_at: number; last_seen_at: number; ip: string; user_agent: string }>(c,
    'SELECT id,created_at,last_seen_at,ip,user_agent FROM sessions WHERE account_id=? AND expires_at>? ORDER BY last_seen_at DESC LIMIT 30',
    auth.account.id, now())
  return result(c, list.map(row => ({ ...row, current: row.id === auth.session.id })))
})
app.delete('/api/sessions/:id', async c => {
  const auth = requireFull(c)
  const id = validated(z.uuid(), c.req.param('id'))
  const write = await query(c, 'DELETE FROM sessions WHERE id=? AND account_id=?', id, auth.account.id).run()
  if (!write.meta.changes) throw missing()
  await audit(c, 'session.revoked', id).run()
  return result(c, { id })
})

/* ------------------------------------------------------------------ Administration */

type AdminRow = Pick<Account, 'id' | 'email' | 'name' | 'status' | 'platform_role'> & { mfa_enabled: number; last_login_at: number | null; has_password: number }
async function target(c: Ctx) {
  const id = validated(z.uuid(), c.req.param('id'))
  const account = await one<Account>(c, 'SELECT * FROM accounts WHERE id=?', id)
  if (!account) throw missing()
  return account
}
/** Founders manage everyone. Platform admins and support only manage accounts without a platform role. */
function canManage(actor: PlatformRole, subject: Pick<Account, 'platform_role'>) {
  return actor === 'founder' || !subject.platform_role
}
async function oneTimeLink(c: Ctx, accountId: string, kind: 'activate' | 'reset', hours: number) {
  const code = randomHex(32)
  const timestamp = now()
  await db(c).batch([
    query(c, 'UPDATE action_tokens SET used_at=? WHERE account_id=? AND used_at IS NULL', timestamp, accountId),
    query(c, `INSERT INTO action_tokens(id,account_id,kind,token_hash,created_by,created_at,expires_at) VALUES (?,?,?,?,?,?,?)`,
      newId(), accountId, kind, await sha256(code), c.get('auth')?.account.id ?? null, timestamp, timestamp + hours * 3_600_000),
    audit(c, 'link.created', accountId, { kind, hours }),
  ])
  return { code, expiresAt: timestamp + hours * 3_600_000 }
}

app.get('/api/admin/summary', async c => {
  requirePlatform(c, 'founder', 'platform_admin', 'support')
  const counts = await one(c, `SELECT (SELECT COUNT(*) FROM accounts) AS accounts,
    (SELECT COUNT(*) FROM accounts WHERE platform_role IS NOT NULL AND status='active') AS platform,
    (SELECT COUNT(*) FROM organizations) AS organizations,
    (SELECT COUNT(*) FROM audit_events WHERE action='login.failed' AND occurred_at>?) AS failed_today`, now() - day)
  return result(c, counts)
})

app.get('/api/admin/accounts', async c => {
  requirePlatform(c, 'founder', 'platform_admin', 'support')
  const q = validated(z.string().trim().max(120), c.req.query('q') ?? '')
  return result(c, await rows<AdminRow>(c, `SELECT id,email,name,status,platform_role,last_login_at,totp_secret IS NOT NULL AS mfa_enabled,
    password_hash IS NOT NULL AS has_password FROM accounts
    WHERE instr(lower(email),lower(?))>0 OR instr(lower(name),lower(?))>0
    ORDER BY CASE platform_role WHEN 'founder' THEN 0 WHEN 'platform_admin' THEN 1 WHEN 'support' THEN 2 ELSE 3 END,name LIMIT 200`, q, q))
})

app.post('/api/admin/accounts', async c => {
  const auth = requirePlatform(c, 'founder', 'platform_admin')
  const input = await body(c, z.object({ email, name: text(100), platform_role: platformRole.nullable().default(null) }))
  if (input.platform_role && auth.account.platform_role !== 'founder') throw denied()
  if (await one(c, 'SELECT id FROM accounts WHERE email=?', input.email)) throw new Failure(409, 'exists', 'Email này đã có tài khoản AFYLLX.')
  const id = newId(), timestamp = now()
  await db(c).batch([
    query(c, 'INSERT INTO accounts(id,email,name,platform_role,created_at,updated_at) VALUES (?,?,?,?,?,?)',
      id, input.email, input.name, input.platform_role, timestamp, timestamp),
    audit(c, 'account.created', id, { platform_role: input.platform_role }),
  ])
  const link = await oneTimeLink(c, id, 'activate', 72)
  return result(c, { id, ...link }, 201)
})

app.patch('/api/admin/accounts/:id', async c => {
  const auth = requirePlatform(c, 'founder', 'platform_admin')
  const subject = await target(c)
  const actor = auth.account.platform_role!
  const input = await body(c, z.object({ status: z.enum(['active', 'disabled']).optional(), platform_role: platformRole.nullable().optional(),
    name: text(100).optional() }))
  if (!canManage(actor, subject)) throw denied()
  if (input.platform_role !== undefined && actor !== 'founder') throw denied()
  if (subject.id === auth.account.id && (input.status === 'disabled' || input.platform_role !== undefined)) {
    throw bad('Không tự khóa hoặc tự đổi vai trò của chính mình. Hãy nhờ một Founder khác.')
  }
  try {
    await db(c).batch([
      query(c, `UPDATE accounts SET status=coalesce(?,status),name=coalesce(?,name),
        platform_role=CASE WHEN ? THEN ? ELSE platform_role END,updated_at=? WHERE id=?`,
      input.status ?? null, input.name ?? null, Number(input.platform_role !== undefined), input.platform_role ?? null, now(), subject.id),
      audit(c, 'account.updated', subject.id, { status: input.status, platform_role: input.platform_role, from: subject.platform_role }),
    ])
  } catch (error) {
    if (error instanceof Error && error.message.includes('LAST_FOUNDER')) throw new Failure(409, 'last_founder', 'Phải luôn còn ít nhất một Founder đang hoạt động.')
    throw error
  }
  // A change of role or a block takes effect at once on every device.
  if (input.status === 'disabled' || input.platform_role !== undefined) await revokeSessions(c, subject.id)
  return result(c, { id: subject.id })
})

app.post('/api/admin/accounts/:id/link', async c => {
  const auth = requirePlatform(c, 'founder', 'platform_admin', 'support')
  const subject = await target(c)
  if (!canManage(auth.account.platform_role!, subject) || subject.id === auth.account.id) throw denied()
  if (subject.status !== 'active') throw bad('Tài khoản đang bị khóa.')
  return result(c, await oneTimeLink(c, subject.id, subject.password_hash ? 'reset' : 'activate', subject.password_hash ? 24 : 72), 201)
})

app.post('/api/admin/accounts/:id/second-factor/reset', async c => {
  const auth = requirePlatform(c, 'founder')
  const subject = await target(c)
  if (subject.id === auth.account.id) throw bad('Dùng mã khôi phục để vào lại tài khoản của chính bạn.')
  await db(c).batch([
    query(c, 'UPDATE accounts SET totp_secret=NULL,totp_pending=NULL,totp_last_step=0,updated_at=? WHERE id=?', now(), subject.id),
    query(c, 'DELETE FROM recovery_codes WHERE account_id=?', subject.id),
    query(c, 'DELETE FROM sessions WHERE account_id=?', subject.id),
    audit(c, 'mfa.reset_by_founder', subject.id),
  ])
  return result(c, { id: subject.id })
})

app.get('/api/admin/organizations', async c => {
  requirePlatform(c, 'founder', 'platform_admin', 'support')
  return result(c, await rows(c, `SELECT o.id,o.name,o.kind,o.status,o.created_at,
    (SELECT COUNT(*) FROM memberships m WHERE m.org_id=o.id) AS members FROM organizations o ORDER BY o.name LIMIT 200`))
})
app.post('/api/admin/organizations', async c => {
  requirePlatform(c, 'founder', 'platform_admin')
  const input = await body(c, z.object({ name: text(120), kind: z.enum(['school', 'center', 'other']).default('school') }))
  const id = newId(), timestamp = now()
  await db(c).batch([
    query(c, 'INSERT INTO organizations(id,name,kind,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?)',
      id, input.name, input.kind, c.get('auth')!.account.id, timestamp, timestamp),
    audit(c, 'organization.created', id, input),
  ])
  return result(c, { id }, 201)
})

app.get('/api/admin/audit', async c => {
  requirePlatform(c, 'founder', 'platform_admin')
  const page = validated(z.coerce.number().int().min(1).max(500), c.req.query('page') ?? 1)
  const list = await rows(c, `SELECT e.id,e.action,e.target_id,e.details,e.ip,e.occurred_at,a.name AS actor_name,a.email AS actor_email
    FROM audit_events e LEFT JOIN accounts a ON a.id=e.actor_id ORDER BY e.occurred_at DESC,e.id LIMIT 51 OFFSET ?`, (page - 1) * 50)
  return c.json({ data: list.slice(0, 50), pagination: { page, hasMore: list.length > 50 } })
})

app.notFound(c => c.json({ error: { code: 'not_found', message: 'Không tìm thấy mục này.' } }, 404))
app.onError((error, c) => {
  if (error instanceof Failure) return c.json({ error: { code: error.code, message: error.message } }, error.status)
  console.error('AFYLLX Account request failed', { method: c.req.method, type: error.name })
  return c.json({ error: { code: 'internal', message: 'Có lỗi trên máy chủ. Vui lòng thử lại.' } }, 500)
})

export default { fetch: app.fetch } satisfies ExportedHandler<Bindings>
