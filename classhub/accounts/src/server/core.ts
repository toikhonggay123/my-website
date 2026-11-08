import { Hono, type Context } from 'hono'
import { setCookie, deleteCookie } from 'hono/cookie'
import { z } from 'zod'
import { randomHex, sha256 } from './crypto'

export type PlatformRole = 'founder' | 'platform_admin' | 'support'
export type Bindings = {
  ACCOUNTS_DB: D1Database
  APP_ORIGIN: string
  APP_BASE_PATH?: string
  /** Other origins that reach the same Worker, e.g. https://edu.afyllx.com/tai-khoan/api through the Edu gateway. */
  EXTRA_ORIGINS?: string
  /** Parent domain for the session cookie (afyllx.com) so every *.afyllx.com product shares one sign-in. */
  COOKIE_DOMAIN?: string
  ACCOUNTS_ENCRYPTION_KEY: string
  LOGIN_LIMIT: RateLimit
  /** Per-client limit for every /api/* request (../../../src/server/edge.ts). Cloud only; local runs and QA stay unlimited. */
  API_LIMIT?: RateLimit
}
export type Account = {
  id: string; email: string; name: string; password_hash: string | null; status: 'active' | 'disabled'
  platform_role: PlatformRole | null; totp_secret: string | null; totp_pending: string | null; totp_last_step: number
}
export type Session = { id: string; mfa_passed: number; expires_at: number; absolute_expires_at: number; last_seen_at: number }
export type Auth = { account: Account; session: Session; state: 'full' | 'mfa' | 'enroll' }
export type App = { Bindings: Bindings; Variables: { auth?: Auth } }
export type Ctx = Context<App>
export const router = () => new Hono<App>()

export class Failure extends Error {
  constructor(readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 429 | 503, readonly code: string, message: string) { super(message) }
}
export const bad = (message: string) => new Failure(400, 'invalid_input', message)
export const missing = () => new Failure(404, 'not_found', 'Không tìm thấy mục này.')
export const denied = () => new Failure(403, 'forbidden', 'Tài khoản của bạn không có quyền thực hiện thao tác này.')
export const signedOut = () => new Failure(401, 'unauthenticated', 'Vui lòng đăng nhập.')

export const now = () => Date.now()
export const newId = () => crypto.randomUUID()
export const email = z.string().trim().toLowerCase().pipe(z.email().max(254))
export const password = z.string().min(12, 'Mật khẩu cần ít nhất 12 ký tự.').max(128)
export const text = (limit: number) => z.string().trim().min(1).max(limit)
export const db = (c: Ctx) => c.env.ACCOUNTS_DB
export const query = (c: Ctx, sql: string, ...values: (string | number | null)[]) => db(c).prepare(sql).bind(...values)
export const one = <T>(c: Ctx, sql: string, ...values: (string | number | null)[]) => query(c, sql, ...values).first<T>()
export const rows = async <T>(c: Ctx, sql: string, ...values: (string | number | null)[]) => (await query(c, sql, ...values).all<T>()).results
export const result = <T>(c: Ctx, data: T, status: 200 | 201 = 200) => c.json({ data }, status)
export const ip = (c: Ctx) => c.req.header('CF-Connecting-IP') ?? ''

export function validated<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const parsed = schema.safeParse(value)
  if (parsed.success) return parsed.data
  const issue = parsed.error.issues[0]
  throw bad(issue?.message && !issue.message.startsWith('Invalid') ? issue.message : 'Kiểm tra lại trường ' + (issue?.path.join('.') || 'gửi lên') + '.')
}
export async function body<S extends z.ZodType>(c: Ctx, schema: S) {
  return validated(schema, await c.req.json().catch(() => null))
}

export function audit(c: Ctx, action: string, targetId = '', details: object = {}, actorId = c.get('auth')?.account.id ?? null) {
  return query(c, 'INSERT INTO audit_events(id,actor_id,action,target_id,details,ip,occurred_at) VALUES (?,?,?,?,?,?,?)',
    newId(), actorId, action, targetId, JSON.stringify(details), ip(c), now())
}

/* ------------------------------------------------------------------ Sessions */

export const cookieName = 'afyllx_session'
const hour = 3_600_000, day = 24 * hour
/** Platform roles get short sessions; everyone else stays signed in on their own device for 30 days of use. */
export const sessionPolicy = (account: Pick<Account, 'platform_role'>) => account.platform_role
  ? { idle: 12 * hour, absolute: 12 * hour }
  : { idle: 30 * day, absolute: 180 * day }
// The owner chose password-only sign-in (07/11/2026): the second factor is optional for every role and applies only once
// the account holder turns it on in the Security tab.
export const needsSecondFactor = (account: Pick<Account, 'totp_secret'>) => Boolean(account.totp_secret)

export async function startSession(c: Ctx, account: Account) {
  const token = randomHex(32)
  const policy = sessionPolicy(account)
  const timestamp = now()
  const id = newId()
  await query(c, `INSERT INTO sessions(id,account_id,token_hash,mfa_passed,created_at,last_seen_at,expires_at,absolute_expires_at,ip,user_agent)
    VALUES (?,?,?,?,?,?,?,?,?,?)`, id, account.id, await sha256(token), needsSecondFactor(account) ? 0 : 1, timestamp, timestamp,
  timestamp + policy.idle, timestamp + policy.absolute, ip(c), (c.req.header('User-Agent') ?? '').slice(0, 200)).run()
  clearHostCookie(c)
  setCookie(c, cookieName, token, {
    path: '/', httpOnly: true, sameSite: 'Lax', secure: new URL(c.req.url).protocol === 'https:',
    maxAge: Math.floor(policy.absolute / 1000), ...(c.env.COOKIE_DOMAIN ? { domain: c.env.COOKIE_DOMAIN } : {}),
  })
  return id
}
/** Sessions made before the shared domain (host-only cookies on edu.afyllx.com) are cleared alongside. */
function clearHostCookie(c: Ctx) {
  if (c.env.COOKIE_DOMAIN) deleteCookie(c, cookieName, { path: '/', secure: new URL(c.req.url).protocol === 'https:' })
}
export function endSession(c: Ctx) {
  clearHostCookie(c)
  deleteCookie(c, cookieName, { path: '/', secure: new URL(c.req.url).protocol === 'https:',
    ...(c.env.COOKIE_DOMAIN ? { domain: c.env.COOKIE_DOMAIN } : {}) })
}
/** Every afyllx_session value the browser sent: an older host-only cookie may sit next to the shared one. */
function sessionTokens(c: Ctx) {
  const header = c.req.header('Cookie') ?? ''
  const values = header.split(';').map(part => part.trim()).filter(part => part.startsWith(cookieName + '='))
    .map(part => part.slice(cookieName.length + 1)).filter(value => /^[0-9a-f]{64}$/.test(value))
  return [...new Set(values)].slice(0, 3)
}

export async function loadAuth(c: Ctx): Promise<Auth | undefined> {
  const tokens = sessionTokens(c)
  if (!tokens.length) return undefined
  const timestamp = now()
  type Row = Account & { session_id: string; mfa_passed: number; expires_at: number; absolute_expires_at: number; last_seen_at: number }
  let row: Row | null = null
  for (const token of tokens) {
    row = await one<Row>(c,
      `SELECT a.*,s.id AS session_id,s.mfa_passed,s.expires_at,s.absolute_expires_at,s.last_seen_at FROM sessions s
      JOIN accounts a ON a.id=s.account_id WHERE s.token_hash=? AND s.expires_at>? AND s.absolute_expires_at>? AND a.status='active'`,
    await sha256(token), timestamp, timestamp)
    if (row) break
  }
  if (!row) return undefined
  const { session_id, mfa_passed, expires_at, absolute_expires_at, last_seen_at, ...account } = row
  const session = { id: session_id, mfa_passed, expires_at, absolute_expires_at, last_seen_at }
  // Slide the idle window at most once an hour.
  if (timestamp - last_seen_at > hour) {
    const idle = Math.min(absolute_expires_at, timestamp + sessionPolicy(account).idle)
    await query(c, 'UPDATE sessions SET last_seen_at=?,expires_at=? WHERE id=?', timestamp, idle, session_id).run()
  }
  const state = !needsSecondFactor(account) || mfa_passed ? 'full' : account.totp_secret ? 'mfa' : 'enroll'
  return { account, session, state }
}

/**
 * The signed-in account once sign-in is complete: the password alone, or the password and the 6-digit code when the
 * account holder turned the optional second factor on. Platform roles pass with the password alone as well
 * (owner's choice, 07/11/2026); see needsSecondFactor.
 */
export function requireFull(c: Ctx) {
  const auth = c.get('auth')
  if (!auth) throw signedOut()
  if (auth.state !== 'full') throw new Failure(401, 'second_factor', 'Hãy hoàn tất bước xác thực hai lớp.')
  return auth
}
export function requirePlatform(c: Ctx, ...roles: PlatformRole[]) {
  const auth = requireFull(c)
  if (!auth.account.platform_role || !roles.includes(auth.account.platform_role)) throw denied()
  return auth
}

export async function revokeSessions(c: Ctx, accountId: string, except?: string) {
  await query(c, 'DELETE FROM sessions WHERE account_id=? AND id IS NOT ?', accountId, except ?? null).run()
}

export async function limit(c: Ctx, key: string) {
  const allowed = await c.env.LOGIN_LIMIT.limit({ key })
  if (!allowed.success) throw new Failure(429, 'rate_limited', 'Bạn thử quá nhiều lần. Vui lòng đợi một phút rồi thử lại.')
}
