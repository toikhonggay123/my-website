import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { Miniflare } from 'miniflare'
import { unstable_getMiniflareWorkerOptions, unstable_splitSqlQuery } from 'wrangler'

const qa = process.env.CLASSHUB_QA_ID
if (!qa || !/^[a-f0-9-]{36}$/.test(qa)) throw new Error('Playwright must allocate a QA directory.')
const directory = process.argv[2] === 'directory'
const web = process.argv[2] === 'web'
const direct = process.argv[2] === 'direct' || directory
const state = join('.wrangler', 'qa-' + qa + (web ? '-web' : directory ? '-directory' : direct ? '-direct' : ''))
mkdirSync(state, { recursive: true })
const port = web ? 5178 : directory ? 5177 : direct ? 5176 : 5175
const origin = 'http://127.0.0.1:' + port
const sharedOrg = '51740000-0000-4000-8000-000000000002'
const workerName = 'classhub-qa'
const { main, workerOptions, externalWorkers } =
  unstable_getMiniflareWorkerOptions(resolve(web ? '.wrangler/web-build/afyllx_classhub/wrangler.json' : 'dist/afyllx_classhub_local/wrangler.json'))
const modulesRoot = dirname(main)
const modules = [basename(main), ...readdirSync(join(modulesRoot, 'assets'))
  .filter(name => name.endsWith('.js')).map(name => 'assets/' + name)]
const source = directory || web ? await (await import('./qa-directory-source.mjs')).createDirectorySource(web) : null
const directoryOrigin = 'https://my-website.fyllxestonia.workers.dev'
// Use the same integration contract with a disposable roster on loopback.
async function fetchDirectory(request) {
  const url = new URL(request.url)
  if (url.origin !== directoryOrigin || url.pathname !== '/api/v1/shared-directory') {
    return new Response(null, { status: 502 })
  }
  return fetch('http://127.0.0.1:5180' + url.pathname + url.search, {
    method: request.method,
    headers: {
      Authorization: request.headers.get('Authorization') ?? '',
      Origin: request.headers.get('Origin') ?? '',
      'Content-Type': 'application/json',
    },
    ...(request.method === 'POST' ? { body: await request.arrayBuffer() } : {}),
  })
}
const gateway = resolve(process.env.CLASSHUB_QA_GATEWAY ?? '../edu-gateway/worker/index.mjs')
// Under the gateway, AFYLLX Account runs at /tai-khoan with its own throwaway D1 (build it first with
// `vite build --config accounts/vite.config.ts`). ClassHub reaches it over the same service binding as in production.
const accountsName = 'accounts-qa'
const accounts = web ? (() => {
  const options = unstable_getMiniflareWorkerOptions(resolve('accounts/dist/afyllx_accounts_local/wrangler.json'))
  const root = dirname(options.main)
  // Only its API is needed here. Two workers with static assets in one Miniflare end up sharing one asset store.
  const { assets: _assets, ...accountsOptions } = options.workerOptions
  return {
    ...accountsOptions, name: accountsName, modulesRoot: root,
    modules: [basename(options.main), ...(existsSync(join(root, 'assets')) ? readdirSync(join(root, 'assets')) : [])
      .filter(name => name.endsWith('.js')).map(name => 'assets/' + name)].map(path => ({ type: 'ESModule', path: resolve(root, path) })),
    bindings: { APP_ORIGIN: origin, APP_BASE_PATH: '/tai-khoan', ACCOUNTS_ENCRYPTION_KEY: randomBytes(32).toString('hex') },
  }
})() : null
const worker = new Miniflare({
  host: '127.0.0.1',
  port,
  workers: [...(web ? [{
    name: 'edu-qa',
    modulesRoot: dirname(gateway),
    modules: ['index.mjs', 'contact.mjs'].map(path => ({ type: 'ESModule', path: resolve(dirname(gateway), path) })),
    serviceBindings: {
      CLASSHUB: workerName,
      ACCOUNTS: accountsName,
      ASSETS: () => new Response('Edu portal QA'),
      MEALCHECK: () => new Response('MealCheck QA'),
    },
  }, accounts] : []), {
    ...workerOptions,
    name: workerName,
    ...(directory ? { outboundService: fetchDirectory } : {}),
    ...(web ? {
      serviceBindings: { ...workerOptions.serviceBindings, MEALCHECK_DIRECTORY: fetchDirectory, ACCOUNTS: accountsName },
      outboundService: () => new Response(null, { status: 502 }),
    } : {}),
    modulesRoot,
    modules: modules.map(path => ({ type: 'ESModule', path: resolve(modulesRoot, path) })),
    bindings: { APP_ORIGIN: origin, ...(web ? { APP_BASE_PATH: '/classhub' } : {}), ...(direct ? { CLASSHUB_LOCAL_ADMIN: '1' } : {
      BETTER_AUTH_SECRET: randomBytes(48).toString('hex'),
    }), ...(source ? {
      MEALCHECK_DIRECTORY_ORIGIN: directoryOrigin,
      MEALCHECK_DIRECTORY_KEY: source.key,
      MEALCHECK_DIRECTORY_ORG_ID: sharedOrg,
    } : {}) },
  }, ...externalWorkers],
})
try {
  const db = await worker.getD1Database('CLASSHUB_DB', workerName)
  const demoDb = web ? await worker.getD1Database('CLASSHUB_DEMO_DB', workerName) : null
  const applySql = (file, database = db) => database.batch(
    unstable_splitSqlQuery(readFileSync(file, 'utf8')).map(sql => database.prepare(sql)),
  )
  for (const file of readdirSync('migrations').filter(name => name.endsWith('.sql')).sort()) {
    await applySql(join('migrations', file))
    if (demoDb) await applySql(join('migrations', file), demoDb)
  }
  if (direct) {
    await applySql('scripts/local-bootstrap.sql')
  } else {
    const owners = ['owner-a@example.test', 'owner-b@example.test', 'owner-c@example.test', 'owner-d@example.test', 'owner-e@example.test'].map(email => ({
      email, code: randomBytes(32).toString('hex'),
    }))
    const now = Date.now()
    await db.batch(owners.map(({ email, code }, index) => db.prepare(
      "INSERT INTO invitations(id,email,role,token_hash,created_at,expires_at) VALUES (?,?,'owner',?,?,?)",
    ).bind(web && index === 0 ? sharedOrg : randomUUID(), email, createHash('sha256').update(code).digest('hex'), now, now + 86_400_000)))
    writeFileSync(join(state, 'owners.json'), JSON.stringify(owners))
  }
  if (accounts) {
    const accountsDb = await worker.getD1Database('ACCOUNTS_DB', accountsName)
    for (const file of readdirSync('accounts/migrations').filter(name => name.endsWith('.sql')).sort()) {
      await accountsDb.batch(unstable_splitSqlQuery(readFileSync(join('accounts/migrations', file), 'utf8')).map(sql => accountsDb.prepare(sql)))
    }
    const founder = randomUUID(), code = randomBytes(32).toString('hex'), now = Date.now()
    await accountsDb.batch([
      accountsDb.prepare("INSERT INTO accounts(id,email,name,platform_role,created_at,updated_at) VALUES (?,?,?,'founder',?,?)")
        .bind(founder, 'founder@example.test', 'Founder QA', now, now),
      accountsDb.prepare("INSERT INTO action_tokens(id,account_id,kind,token_hash,created_at,expires_at) VALUES (?,?,'activate',?,?,?)")
        .bind(randomUUID(), founder, createHash('sha256').update(code).digest('hex'), now, now + 3_600_000),
    ])
    writeFileSync(join(state, 'founder.json'), JSON.stringify({ email: 'founder@example.test', code }))
  }
} catch (error) {
  await worker.dispose()
  await source?.close()
  throw error
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => {
  await worker.dispose()
  await source?.close()
  process.exit(0)
})
