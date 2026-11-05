import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
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
const worker = new Miniflare({
  host: '127.0.0.1',
  port,
  workers: [...(web ? [{
    name: 'edu-qa',
    modulesRoot: dirname(gateway),
    modules: ['index.mjs', 'contact.mjs'].map(path => ({ type: 'ESModule', path: resolve(dirname(gateway), path) })),
    serviceBindings: {
      CLASSHUB: workerName,
      ASSETS: () => new Response('Edu portal QA'),
      MEALCHECK: () => new Response('MealCheck QA'),
    },
  }] : []), {
    ...workerOptions,
    name: workerName,
    ...(directory ? { outboundService: fetchDirectory } : {}),
    ...(web ? {
      serviceBindings: { ...workerOptions.serviceBindings, MEALCHECK_DIRECTORY: fetchDirectory },
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
  const applySql = file => db.batch(unstable_splitSqlQuery(readFileSync(file, 'utf8')).map(sql => db.prepare(sql)))
  for (const file of readdirSync('migrations').filter(name => name.endsWith('.sql')).sort()) {
    await applySql(join('migrations', file))
  }
  if (direct) {
    await applySql('scripts/local-bootstrap.sql')
  } else {
    const owners = ['owner-a@example.test', 'owner-b@example.test'].map(email => ({
      email, code: randomBytes(32).toString('hex'),
    }))
    const now = Date.now()
    await db.batch(owners.map(({ email, code }, index) => db.prepare(
      "INSERT INTO invitations(id,email,role,token_hash,created_at,expires_at) VALUES (?,?,'owner',?,?,?)",
    ).bind(web && index === 0 ? sharedOrg : randomUUID(), email, createHash('sha256').update(code).digest('hex'), now, now + 86_400_000)))
    writeFileSync(join(state, 'owners.json'), JSON.stringify(owners))
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
