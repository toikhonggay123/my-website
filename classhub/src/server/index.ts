import { bodyLimit } from 'hono/body-limit'
import { secureHeaders } from 'hono/secure-headers'
import { dbFailure, Failure, missing, one, router } from './core'
import { auth, identityRoutes, workspaceScope } from './identity'
import { operations } from './operations'
import { scheduling } from './scheduling'
import { classcheck } from './classcheck'
import { directoryRoutes, refreshDirectory, sharedEnabled } from './shared-directory'

const app = router()
app.use('*', secureHeaders())
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
app.post('/api/auth/sign-in/email', c => auth(c).handler(c.req.raw))
app.post('/api/auth/sign-out', c => auth(c).handler(c.req.raw))
app.route('/api/v1', identityRoutes)
app.use('/api/v1/orgs/:orgId/*', workspaceScope)
app.use('/api/v1/orgs/:orgId/*', async (c, next) => {
  if (c.req.method === 'GET' && sharedEnabled(c) && !c.req.path.endsWith('/shared-directory')) {
    try { await refreshDirectory(c) } catch (error) {
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
export default app
