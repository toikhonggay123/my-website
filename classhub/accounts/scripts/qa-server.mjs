// Isolated QA runtime for AFYLLX Account: built Worker on Miniflare with a throwaway D1 and a fictional founder.
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { Miniflare } from 'miniflare'
import { unstable_getMiniflareWorkerOptions, unstable_splitSqlQuery } from 'wrangler'

const qa = process.env.ACCOUNTS_QA_ID
if (!qa || !/^[a-f0-9-]{36}$/.test(qa)) throw new Error('Playwright must allocate a QA id.')
const state = join('accounts', '.wrangler', 'qa-' + qa)
mkdirSync(state, { recursive: true })
const port = 5191
const { main, workerOptions } = unstable_getMiniflareWorkerOptions(resolve('accounts/dist/afyllx_accounts_local/wrangler.json'))
const modulesRoot = dirname(main)
const chunks = existsSync(join(modulesRoot, 'assets')) ? readdirSync(join(modulesRoot, 'assets')).filter(name => name.endsWith('.js')) : []
const modules = [basename(main), ...chunks.map(name => 'assets/' + name)]
const worker = new Miniflare({
  host: '127.0.0.1', port,
  workers: [{
    ...workerOptions, name: 'accounts-qa', modulesRoot,
    modules: modules.map(path => ({ type: 'ESModule', path: resolve(modulesRoot, path) })),
    bindings: { APP_ORIGIN: 'http://127.0.0.1:' + port, ACCOUNTS_ENCRYPTION_KEY: randomBytes(32).toString('hex') },
  }],
})
const db = await worker.getD1Database('ACCOUNTS_DB', 'accounts-qa')
for (const file of readdirSync('accounts/migrations').filter(name => name.endsWith('.sql')).sort()) {
  await db.batch(unstable_splitSqlQuery(readFileSync(join('accounts/migrations', file), 'utf8')).map(sql => db.prepare(sql)))
}
const founder = randomUUID(), code = randomBytes(32).toString('hex'), now = Date.now()
await db.batch([
  db.prepare("INSERT INTO accounts(id,email,name,platform_role,created_at,updated_at) VALUES (?,?,?,'founder',?,?)")
    .bind(founder, 'founder@example.test', 'Founder QA', now, now),
  db.prepare("INSERT INTO action_tokens(id,account_id,kind,token_hash,created_at,expires_at) VALUES (?,?,'activate',?,?,?)")
    .bind(randomUUID(), founder, createHash('sha256').update(code).digest('hex'), now, now + 3_600_000),
])
writeFileSync(join(state, 'founder.json'), JSON.stringify({ email: 'founder@example.test', code }))
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await worker.dispose(); process.exit(0) })
