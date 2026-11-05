import { betterAuth } from 'better-auth'
import { APIError } from 'better-auth/api'
import { z } from 'zod'
import {
  type Ctx, type Scope, bad, body, conflict, db, email, Failure, missing, newId,
  localAdmin, now, one, optionalText, param, query, result, router, rows, text, tokenHash, unauthenticated,
} from './core'
import { sharedEnabled } from './shared-directory'

const inviteCode = z.string().regex(/^[0-9a-f]{64}$/)
export const organizationProfile = z.object({
  name: text(120),
  type: z.enum(['independent', 'center', 'school', 'other']),
})
type Invitation = {
  id: string; org_id: string | null; branch_id: string | null; email: string; role: Scope['role']
}

export function auth(c: Ctx) {
  if (localAdmin(c)) throw missing()
  const { BETTER_AUTH_SECRET, APP_ORIGIN, APP_BASE_PATH } = c.env
  if (!BETTER_AUTH_SECRET || BETTER_AUTH_SECRET.length < 32 || !APP_ORIGIN) {
    throw new Failure(503, 'not_configured', 'Máy chủ chưa cấu hình xác thực.')
  }
  return betterAuth({
    baseURL: APP_ORIGIN,
    basePath: '/api/auth',
    secret: BETTER_AUTH_SECRET,
    database: db(c),
    emailAndPassword: { enabled: true, autoSignIn: false, minPasswordLength: 12, maxPasswordLength: 128 },
    session: { expiresIn: 8 * 60 * 60, disableSessionRefresh: true },
    advanced: {
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
      ...(APP_BASE_PATH ? { cookiePrefix: 'afyllx-classhub', defaultCookieAttributes: { path: APP_BASE_PATH } } : {}),
    },
    rateLimit: {
      enabled: true, storage: 'database',
      customRules: { '/sign-in/email': { window: 60, max: 12 } },
    },
    logger: { disabled: true },
  })
}

async function identity(c: Ctx) {
  if (localAdmin(c)) {
    const user = await one<{ id: string; name: string; email: string }>(c,
      'SELECT id,name,email FROM "user" WHERE email=?', 'local-admin@classhub.invalid')
    if (!user) throw new Failure(503, 'local_setup', 'Hãy chạy pnpm setup:local để thiết lập ClassHub.')
    return user
  }
  const active = await auth(c).api.getSession({ headers: c.req.raw.headers })
  if (!active) throw unauthenticated()
  return active.user
}

async function invitation(c: Ctx, code: string) {
  const item = await one<Invitation>(c, `SELECT i.id,i.org_id,i.branch_id,i.email,i.role FROM invitations i
    LEFT JOIN organizations o ON o.id=i.org_id
    WHERE i.token_hash=? AND i.used_at IS NULL AND i.expires_at>?
    AND (i.org_id IS NULL OR o.status='active')`, await tokenHash(code), now())
  if (!item) throw missing()
  return item
}

export const identityRoutes = router()
  .get('/me', async c => {
    const user = await identity(c)
    const workspaces = await rows<{ id: string; name: string; type: string; role: Scope['role']; branch_id: string | null }>(c, `SELECT o.id,o.name,o.type,m.role,m.branch_id
      FROM memberships m JOIN organizations o ON o.id=m.org_id
      WHERE m.user_id=? AND m.active=1 AND o.status='active' ORDER BY o.name,o.id LIMIT 50`, user.id)
    return result(c, { user: { name: user.name, email: user.email },
      workspaces: workspaces.map(item => ({ ...item,
        shared_directory: sharedEnabled(c, item.id),
      })), local: localAdmin(c) })
  })
  .post('/activate', async c => {
    if (localAdmin(c)) throw missing()
    const allowed = await c.env.ACTIVATION_LIMIT.limit({ key: c.req.header('CF-Connecting-IP') ?? 'loopback' })
    if (!allowed.success) throw new Failure(429, 'rate_limited', 'Vui lòng thử lại sau ít phút.')
    const input = await body(c, z.object({
      code: inviteCode, name: text(100), email, password: z.string().min(12).max(128),
    }))
    const invite = await invitation(c, input.code)
    if (invite.email !== input.email) throw missing()
    const { name, password } = input
    try {
      await auth(c).api.signUpEmail({ body: { name, email: input.email, password } })
    } catch (error) {
      if (error instanceof APIError && Number(error.statusCode) < 500) {
        throw conflict('Không thể tạo tài khoản. Nếu đã có tài khoản, hãy đăng nhập rồi dùng mã mời.')
      }
      throw error
    }
    return result(c, { activated: true }, 201)
  })
  .post('/accept-invitation', async c => {
    if (localAdmin(c)) throw missing()
    const user = await identity(c)
    const input = await body(c, z.object({
      code: inviteCode, organization: organizationProfile.optional(), branch: optionalText(100),
    }))
    const invite = await invitation(c, input.code)
    if (user.email !== invite.email) throw missing()
    const timestamp = now()
    const orgId = invite.org_id ?? invite.id
    const branchId = invite.org_id ? invite.branch_id : newId()
    if (invite.org_id && await one(c, 'SELECT user_id FROM memberships WHERE org_id=? AND user_id=?', orgId, user.id)) {
      throw conflict('Tài khoản đã có tư cách thành viên tại đơn vị này.')
    }
    const statements: D1PreparedStatement[] = []
    // The id of the owner invitation reserves the workspace across concurrent retries.
    if (!invite.org_id) {
      if (!input.organization) throw bad('Hãy nhập thông tin đơn vị.')
      statements.push(query(c, `INSERT INTO organizations(id,name,type,created_at,updated_at)
        VALUES (?,?,?,?,?)`, orgId, input.organization.name, input.organization.type, timestamp, timestamp))
      statements.push(query(c, 'INSERT INTO branches(org_id,id,name) VALUES (?,?,?)',
        orgId, branchId, input.branch || 'Cơ sở chính'))
    }
    statements.push(query(c, `INSERT INTO memberships(org_id,user_id,branch_id,role,created_at)
      SELECT ?,?,?,role,? FROM invitations WHERE id=? AND used_at IS NULL AND expires_at>?`,
    orgId, user.id, invite.org_id ? branchId : null, timestamp, invite.id, timestamp))
    statements.push(query(c, `INSERT INTO audit_events(org_id,id,actor_id,event,target_id,occurred_at)
      SELECT ?,?,?,'invitation.accepted',id,? FROM invitations WHERE id=? AND used_at IS NULL AND expires_at>?`,
    orgId, newId(), user.id, timestamp, invite.id, timestamp))
    statements.push(query(c, 'UPDATE invitations SET used_at=? WHERE id=? AND used_at IS NULL AND expires_at>?',
      timestamp, invite.id, timestamp))
    const writes = await db(c).batch(statements)
    if (!writes.at(-1)?.meta.changes) throw conflict('Mã mời đã được dùng.')
    return result(c, { orgId }, 201)
  })

export async function workspaceScope(c: Ctx, next: () => Promise<void>) {
  const user = await identity(c)
  const orgId = param(c, 'orgId')
  const member = await one<{ role: Scope['role']; branch_id: string | null }>(c,
    `SELECT m.role,m.branch_id FROM memberships m JOIN organizations o ON o.id=m.org_id
    WHERE m.org_id=? AND m.user_id=? AND m.active=1 AND o.status='active'`, orgId, user.id)
  if (!member) throw missing()
  c.set('scope', { orgId, userId: user.id, branchId: member.branch_id, role: member.role })
  await next()
}
