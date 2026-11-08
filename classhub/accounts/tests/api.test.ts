// Sign-in lockout and second-factor setup against the real Worker code, with node:sqlite standing in for D1.
// Run from the classhub folder: node --test accounts/tests/api.test.ts
import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire, registerHooks } from 'node:module'
import { DatabaseSync } from 'node:sqlite'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { hashPassword, totp } from '../src/server/crypto.ts'

// The Worker sources use extensionless imports and TypeScript beyond type stripping: transpile them on load.
const ts = createRequire(import.meta.url)('typescript')
const server = (url?: string) => Boolean(url && url.startsWith('file:') && url.includes('/src/server/') && !url.includes('/node_modules/'))
registerHooks({
  resolve(specifier, context, next) {
    if (server(context.parentURL) && /^\.\.?\//.test(specifier) && !/\.[cm]?[jt]sx?$/.test(specifier)) return next(specifier + '.ts', context)
    return next(specifier, context)
  },
  load(url, context, next) {
    if (!server(url) || !url.endsWith('.ts')) return next(url, context)
    const source = ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: fileURLToPath(url),
    }).outputText
    return { format: 'module', source, shortCircuit: true }
  },
})
const worker = (await import('../src/server/index.ts')).default

type Value = string | number | null
/** Just enough of D1 for the Worker: prepare/bind/first/all/run and transactional batches. */
function d1(sqlite: DatabaseSync) {
  const statement = (sql: string, values: Value[] = []) => ({
    bind: (...next: Value[]) => statement(sql, next),
    first: async () => { const row = sqlite.prepare(sql).get(...values); return row ? { ...row } : null },
    all: async () => ({ results: sqlite.prepare(sql).all(...values).map(row => ({ ...row })) }),
    run: async () => ({ meta: { changes: Number(sqlite.prepare(sql).run(...values).changes) } }),
  })
  return {
    prepare: (sql: string) => statement(sql),
    async batch(list: ReturnType<typeof statement>[]) {
      sqlite.exec('BEGIN')
      try {
        const results = []
        for (const item of list) results.push(await item.run())
        sqlite.exec('COMMIT')
        return results
      } catch (error) {
        sqlite.exec('ROLLBACK')
        throw error
      }
    },
  }
}

const origin = 'http://127.0.0.1:5190'
const password = 'Founder-Unit-Only-2026!'
async function setup() {
  const sqlite = new DatabaseSync(':memory:')
  sqlite.exec(readFileSync(new URL('../migrations/0001_accounts.sql', import.meta.url), 'utf8'))
  const id = randomUUID()
  sqlite.prepare("INSERT INTO accounts(id,email,name,platform_role,password_hash,created_at,updated_at) VALUES (?,?,?,'founder',?,0,0)")
    .run(id, 'founder@example.test', 'Founder', await hashPassword(password))
  const env = {
    ACCOUNTS_DB: d1(sqlite), APP_ORIGIN: origin, ACCOUNTS_ENCRYPTION_KEY: randomBytes(32).toString('hex'),
    LOGIN_LIMIT: { limit: async () => ({ success: true }) },
  }
  async function call(path: string, { method = 'POST', data = {} as unknown, ip = '198.51.100.1', cookie = '' } = {}) {
    const headers: Record<string, string> = { 'CF-Connecting-IP': ip }
    if (cookie) headers.Cookie = cookie
    if (method !== 'GET') Object.assign(headers, { Origin: origin, 'Content-Type': 'application/json' })
    const response = await worker.fetch(new Request(origin + path, { method, headers, ...(method === 'GET' ? {} : { body: JSON.stringify(data) }) }),
      env as never, { waitUntil() {}, passThroughOnException() {} } as never)
    const json = await response.json() as { data?: Record<string, unknown>; error?: { code: string; message: string } }
    const session = response.headers.getSetCookie().map(item => item.split(';')[0]).find(item => /^afyllx_session=[0-9a-f]{64}$/.test(item))
    return { status: response.status, ...json, cookie: session ?? '' }
  }
  const login = (pass: string, ip?: string, email = 'founder@example.test') => call('/api/login', { data: { email, password: pass }, ip })
  return { sqlite, id, call, login }
}

test('wrong passwords from one network lock only that network, and a much higher cap protects the account', async () => {
  const { sqlite, login } = await setup()
  for (let attempt = 0; attempt < 10; attempt++) assert.equal((await login('wrong-password-1', '203.0.113.9')).status, 401)
  const locked = await login(password, '203.0.113.9')
  assert.equal(locked.status, 429)
  assert.equal(locked.error?.code, 'locked')
  // Each failure records the client network the lockout reads.
  const clients = sqlite.prepare("SELECT DISTINCT json_extract(details,'$.client') AS client FROM audit_events WHERE action='login.failed'").all()
  assert.deepEqual(clients.map(row => row.client), ['203.0.113.9'])

  // The real owner elsewhere still signs in.
  assert.equal((await login(password, '198.51.100.20')).status, 200)
  // Hosts in one IPv6 /64 count as one network.
  for (let attempt = 0; attempt < 10; attempt++) await login('wrong-password-1', '2001:db8:5:6::' + (attempt + 1).toString(16))
  assert.equal((await login(password, '2001:db8:5:6::ff')).status, 429)
  assert.equal((await login(password, '2001:db8:5:7::1')).status, 200)

  // Unknown emails lock the same way and say the same thing, so the lockout reveals nothing about accounts.
  for (let attempt = 0; attempt < 10; attempt++) await login('wrong-password-1', '203.0.113.9', 'nobody@example.test')
  const unknown = await login('wrong-password-1', '203.0.113.9', 'nobody@example.test')
  assert.deepEqual([unknown.status, unknown.error?.message], [locked.status, locked.error?.message])

  // 100 failures across many networks within 15 minutes stop every network for that email.
  const insert = sqlite.prepare("INSERT INTO audit_events(id,actor_id,action,target_id,details,ip,occurred_at) VALUES (?,NULL,'login.failed',?,?,?,?)")
  for (let n = 0; n < 80; n++) insert.run(randomUUID(), 'founder@example.test', JSON.stringify({ client: '192.0.2.' + n }), '192.0.2.' + n, Date.now())
  assert.equal((await login(password, '198.51.100.30')).status, 429)
  // Older failures no longer count.
  sqlite.prepare("UPDATE audit_events SET occurred_at=occurred_at-16*60000 WHERE action='login.failed'").run()
  assert.equal((await login(password, '203.0.113.9')).status, 200)
})

test('a signed-in session needs the password again to set up or replace the second factor', async () => {
  const { sqlite, id, call, login } = await setup()
  const first = await login(password)
  assert.equal(first.data?.state, 'full')
  const cookie = first.cookie
  const other = (await login(password, '198.51.100.2')).cookie

  // No password, or a wrong one: refused, audited and nothing pending.
  assert.equal((await call('/api/mfa/enroll', { cookie })).status, 400)
  const denied = await call('/api/mfa/enroll', { cookie, data: { password: 'wrong-password-1' } })
  assert.equal(denied.status, 400)
  assert.equal(denied.error?.message, 'Mật khẩu hiện tại chưa đúng.')
  assert.equal(sqlite.prepare('SELECT totp_pending FROM accounts WHERE id=?').get(id)?.totp_pending, null)
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM audit_events WHERE action='mfa.enroll_denied'").get()?.n, 1)
  // Confirm accepts nothing that the verified enrol did not create.
  assert.equal((await call('/api/mfa/confirm', { cookie, data: { code: '123456' } })).error?.message, 'Hãy bắt đầu lại bước thiết lập.')

  const enrolled = await call('/api/mfa/enroll', { cookie, data: { password } })
  assert.equal(enrolled.status, 200)
  const secret = String(enrolled.data?.secret)
  const code = await totp(secret, Math.floor(Date.now() / 30_000))
  // Another session of the same account cannot finish this setup.
  assert.equal((await call('/api/mfa/confirm', { cookie: other, data: { code } })).error?.message, 'Hãy bắt đầu lại bước thiết lập.')
  // A setup older than ten minutes has to be started again.
  const realNow = Date.now
  try {
    Date.now = () => realNow() + 11 * 60_000
    assert.equal((await call('/api/mfa/confirm', { cookie, data: { code } })).error?.message, 'Hãy bắt đầu lại bước thiết lập.')
  } finally {
    Date.now = realNow
  }
  const confirmed = await call('/api/mfa/confirm', { cookie, data: { code } })
  assert.equal(confirmed.status, 200)
  assert.equal((confirmed.data?.recoveryCodes as string[]).length, 10)
  const row = sqlite.prepare('SELECT totp_secret,totp_pending FROM accounts WHERE id=?').get(id)
  assert.ok(row?.totp_secret)
  assert.equal(row?.totp_pending, null)
  // The other device was signed out; replaying the confirmation does nothing.
  assert.equal((await call('/api/me', { method: 'GET', cookie: other })).status, 401)
  assert.equal((await call('/api/mfa/confirm', { cookie, data: { code } })).status, 400)

  // Replacing the phone later asks for the password the same way, and only the newest setup can be confirmed.
  assert.equal((await call('/api/mfa/enroll', { cookie, data: { password: 'wrong-password-1' } })).status, 400)
  const stale = await call('/api/mfa/enroll', { cookie, data: { password } })
  const fresh = await call('/api/mfa/enroll', { cookie, data: { password } })
  const staleCode = await totp(String(stale.data?.secret), Math.floor(Date.now() / 30_000))
  assert.equal((await call('/api/mfa/confirm', { cookie, data: { code: staleCode } })).status, 400)
  const replaced = await call('/api/mfa/confirm', { cookie, data: { code: await totp(String(fresh.data?.secret), Math.floor(Date.now() / 30_000)) } })
  assert.equal(replaced.status, 200)
  assert.notEqual(sqlite.prepare('SELECT totp_secret FROM accounts WHERE id=?').get(id)?.totp_secret, row?.totp_secret)
})
