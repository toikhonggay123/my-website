import { Hono, type Context } from 'hono'
import { z } from 'zod'

export type Role = 'owner' | 'branch_admin' | 'teacher'
export type Scope = { userId: string; orgId: string; branchId: string | null; role: Role }
export type Bindings = {
  CLASSHUB_DB: D1Database
  CLASSHUB_DEMO_DB?: D1Database
  APP_ORIGIN: string
  APP_BASE_PATH?: '/classhub'
  CLASSHUB_LOCAL_ADMIN?: string
  MEALCHECK_DIRECTORY?: Fetcher
  MEALCHECK_DIRECTORY_ORIGIN?: string
  MEALCHECK_DIRECTORY_KEY?: string
  MEALCHECK_DIRECTORY_ORG_ID?: string
  BETTER_AUTH_SECRET: string
  ACTIVATION_LIMIT: RateLimit
  /** Per-client limit for every /api/* request (src/server/edge.ts). Cloud only; local runs and QA stay unlimited. */
  API_LIMIT?: RateLimit
  /** '1' on edu.afyllx.com only: public timetable answers are kept in the edge cache for 60 s (src/server/public.ts). */
  PUBLIC_EDGE_CACHE?: string
  /** AFYLLX Account Worker (service binding). Present only on edu.afyllx.com. */
  ACCOUNTS?: Fetcher
}
export type App = { Bindings: Bindings; Variables: { scope: Scope; demoDb?: D1Database } }
export type Ctx = Context<App>
export const router = () => new Hono<App>()

export class Failure extends Error {
  constructor(readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 429 | 503, readonly code: string, message: string) {
    super(message)
  }
}
export const bad = (message: string) => new Failure(400, 'invalid_input', message)
export const missing = () => new Failure(404, 'not_found', 'Không tìm thấy mục này.')
export const denied = () => new Failure(403, 'forbidden', 'Bạn không có quyền thực hiện thao tác này.')
export const conflict = (message: string) => new Failure(409, 'conflict', message)
export const unauthenticated = () => new Failure(401, 'unauthenticated', 'Vui lòng đăng nhập.')
export const uuid = z.uuid()
export const text = (limit: number) => z.string().trim().min(1).max(limit)
export const optionalText = (limit: number) => z.string().trim().max(limit).default('')
export const email = z.string().trim().toLowerCase().pipe(z.email().max(254))
export const isoDate = z.iso.date().refine(value => value >= '2000-01-01' && value <= '2099-12-31')
export const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
export const now = () => Date.now()
export const newId = () => crypto.randomUUID()
export const timezone = 'Asia/Ho_Chi_Minh'
const vietnamDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
})
export const today = () => vietnamDate.format(new Date())
export const localInstant = (date: string, time: string) => Date.parse(date + 'T' + time + ':00+07:00')
export const dayMs = 86_400_000
export const token = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('')
export const tokenHash = async (value: string) => Array.from(
  new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))),
  byte => byte.toString(16).padStart(2, '0'),
).join('')

export function validated<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value)
  if (result.success) return result.data
  const path = result.error.issues[0]?.path.join('.')
  throw bad(path ? 'Kiểm tra lại trường ' + path + '.' : 'Dữ liệu gửi lên không hợp lệ.')
}
export async function body<S extends z.ZodType>(c: Ctx, schema: S) {
  return validated(schema, await c.req.json().catch(() => null))
}
export const param = (c: Ctx, key: string) => validated(uuid, c.req.param(key))
export const db = (c: Ctx) => c.get('demoDb') ?? c.env.CLASSHUB_DB
export function localAdmin(c: Ctx) {
  return c.env.CLASSHUB_LOCAL_ADMIN === '1'
    && /^http:\/\/127\.0\.0\.1:\d+$/.test(c.env.APP_ORIGIN)
    && new URL(c.req.url).origin === c.env.APP_ORIGIN
}
export const staffProfilesOnly = (c: Ctx) => Boolean(c.get('demoDb')) || localAdmin(c)
type Value = string | number | null
export const query = (c: Ctx, sql: string, ...values: Value[]) => db(c).prepare(sql).bind(...values)
export const one = <T>(c: Ctx, sql: string, ...values: Value[]) => query(c, sql, ...values).first<T>()
export const rows = async <T = Record<string, unknown>>(c: Ctx, sql: string, ...values: Value[]) =>
  (await query(c, sql, ...values).all<T>()).results
export const result = <T>(c: Ctx, data: T, status: 200 | 201 = 200) => c.json({ data }, status)
/** Pages hold 25 rows. Routes that pass a larger maxLimit also accept an explicit `limit` query up to that cap. */
export function pagination(c: Ctx, maxLimit = 25) {
  const page = validated(z.coerce.number().int().min(1).max(10_000), c.req.query('page') ?? 1)
  const limit = maxLimit > 25 ? validated(z.coerce.number().int().min(1).max(maxLimit), c.req.query('limit') ?? 25) : 25
  return { page, limit, offset: (page - 1) * limit }
}
export const pageResult = <T>(c: Ctx, list: T[], page: { page: number; limit: number }) =>
  c.json({ data: list.slice(0, page.limit), pagination: { page: page.page, hasMore: list.length > page.limit } })

export function audit(c: Ctx, event: string, targetId: string, details: object = {}) {
  const { orgId, userId } = c.get('scope')
  return query(c, `INSERT INTO audit_events(org_id,id,actor_id,event,target_id,occurred_at,details)
    VALUES (?,?,?,?,?,?,?)`, orgId, newId(), userId, event, targetId, now(), JSON.stringify(details))
}

export function requireRole(c: Ctx, ...roles: Role[]) {
  const scope = c.get('scope')
  if (!roles.includes(scope.role)) throw denied()
  return scope
}

// The alias is internal and always points to a classes row.
export function classScope(scope: Scope, alias = 'cl'): [string, ...Value[]] {
  if (scope.role === 'owner') return ['1=1']
  if (scope.role === 'branch_admin') return [alias + '.branch_id=?', scope.branchId]
  return [`EXISTS (SELECT 1 FROM teacher_assignments ta WHERE ta.org_id=${alias}.org_id
    AND ta.class_id=${alias}.id AND ta.user_id=? AND ta.ended_at IS NULL)`, scope.userId]
}
export type ClassRow = {
  id: string; name: string; code: string; branch_id: string; course_id: string
  starts_on: string; ends_on: string; capacity: number; room: string; notes: string; status: string; shared: number
}
export async function scopedClass(c: Ctx, id = param(c, 'classId')) {
  const scope = c.get('scope')
  const [rule, ...args] = classScope(scope)
  const item = await one<ClassRow>(c, `SELECT cl.*,
    EXISTS (SELECT 1 FROM directory_classes d WHERE d.org_id=cl.org_id AND d.class_id=cl.id) AS shared
    FROM classes cl WHERE cl.org_id=? AND cl.id=? AND ${rule}`, scope.orgId, id, ...args)
  if (!item) throw missing()
  return item
}

export function dbFailure(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  const errors: [string, string][] = [
    ['CLASS_CAPACITY', 'Lớp đã đủ học viên hoặc sĩ số vượt giới hạn mới.'],
    ['ENROLLMENT_OVERLAP', 'Học viên đã có ghi danh trùng thời gian trong lớp.'],
    ['SCHEDULE_CONFLICT', 'Buổi học trùng giờ với lớp, giáo viên hoặc phòng. Hãy kiểm tra lịch và đổi giờ.'],
    ['TEACHER_INACTIVE', 'Giáo viên cần được phân công đang hoạt động trong lớp.'],
    ['UNIQUE constraint failed', 'Mục này đã tồn tại hoặc vừa được thay đổi.'],
    ['FOREIGN KEY constraint failed', 'Dữ liệu liên quan đã thay đổi. Hãy tải lại.'],
  ]
  const known = errors.find(([key]) => message.includes(key))
  return known ? conflict(known[1]) : null
}
