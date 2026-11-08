import { bodyLimit } from 'hono/body-limit'
import { secureHeaders } from 'hono/secure-headers'
import { type Bindings, dbFailure, Failure, missing, one, router } from './core'
import { auth, identityRoutes, workspaceScope } from './identity'
import { demo, expireDemoWorkspaces } from './demo'
import { operations } from './operations'
import { scheduling } from './scheduling'
import { classcheck } from './classcheck'
import { school } from './school'
import { teacherRoutes } from './teacher'
import { publicRoutes } from './public'
import { reports } from './reports'
import { directoryRoutes, refreshDirectory, sharedEnabled } from './shared-directory'
import { platformSignIn, platformSignOut } from './platform'
import { apiRateLimited } from './edge'

const app = router()
app.use('*', secureHeaders())
// Flood limit per client before any database work (cloud only, see edge.ts).
app.use('/api/*', async (c, next) => (await apiRateLimited(c.req.raw, c.env.API_LIMIT)) ?? next())
app.use('*', async (c, next) => {
  c.header('Cache-Control', 'no-store')
  if (c.env.APP_BASE_PATH && new URL(c.req.url).origin !== c.env.APP_ORIGIN) throw missing()
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(c.req.method)) {
    if (!c.env.APP_ORIGIN || c.req.header('Origin') !== c.env.APP_ORIGIN) {
      throw new Failure(403, 'origin', 'Nguồn yêu cầu không hợp lệ.')
    }
    if (!/^application\/json(?:\s*;|$)/i.test(c.req.header('Content-Type') ?? '')) {
      throw new Failure(400, 'content_type', 'Yêu cầu cần dùng định dạng JSON.')
    }
  }
  await next()
})
app.use('*', bodyLimit({
  maxSize: 96 * 1024,
  onError: () => { throw new Failure(413, 'request_too_large', 'Dữ liệu vượt giới hạn.') },
}))

app.get('/api/health', async c => {
  await c.env.CLASSHUB_DB.prepare('SELECT id FROM organizations LIMIT 1').first()
  return c.json({ status: 'ok' })
})
app.post('/api/auth/sign-in/email', async c => {
  const text = await c.req.text()
  const response = await auth(c).handler(new Request(c.req.raw.url, { method: 'POST', headers: c.req.raw.headers, body: text }))
  if (response.status !== 401) return response
  // Not a ClassHub password: an AFYLLX Account (Founder, platform administrator) may sign in with the same form.
  const input = (() => { try { return JSON.parse(text) as { email?: unknown; password?: unknown } } catch { return {} } })()
  const platform = typeof input.email === 'string' && typeof input.password === 'string'
    ? await platformSignIn(c, input.email.trim().toLowerCase(), input.password) : null
  const invalid = { error: { code: 'invalid_login', message: 'Email hoặc mật khẩu chưa đúng.' } }
  if (!platform) return c.json(invalid, 401)
  for (const cookie of platform.cookies) c.header('Set-Cookie', cookie, { append: true })
  if (platform.status === 200 && (platform.state === 'full' || platform.state === 'mfa' || platform.state === 'enroll')) {
    return c.json({ platform: platform.state })
  }
  if (platform.status === 429) return c.json({ error: { code: 'rate_limited', message: platform.message ?? 'Vui lòng thử lại sau ít phút.' } }, 429)
  return c.json(invalid, 401)
})
app.post('/api/auth/sign-out', async c => {
  const cleared = await platformSignOut(c)
  const response = await auth(c).handler(c.req.raw)
  if (!cleared) return response
  const headers = new Headers(response.headers)
  for (const cookie of cleared) headers.append('Set-Cookie', cookie)
  headers.set('Content-Type', 'application/json')
  return new Response(JSON.stringify({ success: true }), { status: 200, headers })
})
app.route('/api/v1', identityRoutes)
app.route('/api/v1', publicRoutes)
app.route('/api/v1/demo', demo)
app.use('/api/v1/orgs/:orgId/*', workspaceScope)
app.use('/api/v1/orgs/:orgId/*', async (c, next) => {
  const path = c.req.path
  // Dashboard loads the directory with its overview. Range changes only read attendance data.
  // The student list always checks MealCheck; other reads reuse a check from the last few seconds.
  if (c.req.method === 'GET' && sharedEnabled(c) && !path.endsWith('/shared-directory') && !path.endsWith('/dashboard/analytics')) {
    try { await refreshDirectory(c, { force: /\/students$/.test(path) }) } catch (error) {
      const cache = await one(c, 'SELECT revision FROM directory_connections WHERE org_id=? AND revision>=0', c.get('scope').orgId)
      if (!(error instanceof Failure) || error.status !== 503 || !cache) throw error
      c.header('X-Directory-Stale', '1')
    }
  }
  await next()
})
app.route('/api/v1/orgs/:orgId', directoryRoutes)
app.route('/api/v1/orgs/:orgId', operations)
app.route('/api/v1/orgs/:orgId', scheduling)
app.route('/api/v1/orgs/:orgId', classcheck)
app.route('/api/v1/orgs/:orgId', school)
app.route('/api/v1/orgs/:orgId', teacherRoutes)
app.route('/api/v1/orgs/:orgId', reports)

app.notFound(c => {
  const error = missing()
  return c.json({ error: { code: error.code, message: error.message } }, error.status)
})
app.onError((error, c) => {
  const known = error instanceof Failure ? error : dbFailure(error)
  if (known) return c.json({ error: { code: known.code, message: known.message } }, known.status)
  console.error('ClassHub request failed', { method: c.req.method, type: error.name })
  return c.json({ error: { code: 'internal', message: 'Có lỗi trên máy chủ. Vui lòng thử lại.' } }, 500)
})
export default {
  fetch: app.fetch,
  async scheduled(controller, env) {
    if (env.CLASSHUB_DEMO_DB) await expireDemoWorkspaces(env.CLASSHUB_DEMO_DB, controller.scheduledTime)
  },
} satisfies ExportedHandler<Bindings>
