import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { apiLimitPeriod, apiRateLimited, clientKey, edgeCached } from '../src/server/edge.ts'

const request = (path, ip) => new Request('https://edu.afyllx.com' + path, ip ? { headers: { 'CF-Connecting-IP': ip } } : {})
/** In-memory stand-in for a Workers Rate Limiting binding. */
function limiter(limit) {
  const counts = new Map()
  const keys = []
  return {
    keys,
    async limit({ key }) {
      keys.push(key)
      counts.set(key, (counts.get(key) ?? 0) + 1)
      return { success: counts.get(key) <= limit }
    },
  }
}

test('client keys group IPv6 by /64 and keep IPv4 addresses apart', () => {
  assert.equal(clientKey('203.0.113.7'), '203.0.113.7')
  assert.equal(clientKey(' 203.0.113.7 '), '203.0.113.7')
  assert.equal(clientKey('::ffff:203.0.113.7'), '203.0.113.7')
  assert.equal(clientKey('2001:db8:1:2:aaaa:bbbb:cccc:dddd'), '2001:db8:1:2::/64')
  assert.equal(clientKey('2001:0DB8:0001:0002::1'), '2001:db8:1:2::/64')
  assert.equal(clientKey('2001:db8::1'), '2001:db8:0:0::/64')
  assert.equal(clientKey('2001:db8:1:2::1'), clientKey('2001:db8:1:2:ffff::9'))
  assert.notEqual(clientKey('2001:db8:1:2::1'), clientKey('2001:db8:1:3::1'))
  assert.equal(clientKey(''), '')
  assert.equal(clientKey(null), '')
  assert.match(clientKey('not-an-ip'), /^raw:/)
  assert.match(clientKey('1::2::3'), /^raw:/)
})

test('the API flood limit answers 429 JSON with Retry-After once a client is over budget', async () => {
  const binding = limiter(2)
  assert.equal(await apiRateLimited(request('/api/health', '198.51.100.1'), binding), null)
  assert.equal(await apiRateLimited(request('/api/health', '198.51.100.1'), binding), null)
  const blocked = await apiRateLimited(request('/api/health', '198.51.100.1'), binding)
  assert.equal(blocked.status, 429)
  assert.equal(blocked.headers.get('Retry-After'), String(apiLimitPeriod))
  assert.equal(blocked.headers.get('Cache-Control'), 'no-store')
  assert.equal((await blocked.json()).error.code, 'rate_limited')
  // Another client, and another host in the same IPv6 /64, are counted separately from the first one.
  assert.equal(await apiRateLimited(request('/api/health', '198.51.100.2'), binding), null)
  await apiRateLimited(request('/api/x', '2001:db8:1:2::1'), binding)
  await apiRateLimited(request('/api/x', '2001:db8:1:2::2'), binding)
  assert.equal((await apiRateLimited(request('/api/x', '2001:db8:1:2::3'), binding)).status, 429)
  assert.deepEqual([...new Set(binding.keys)], ['api:198.51.100.1', 'api:198.51.100.2', 'api:2001:db8:1:2::/64'])
})

test('the API flood limit fails open and leaves internal and non-API requests alone', async () => {
  const throwing = { limit: async () => { throw new Error('limiter down') } }
  assert.equal(await apiRateLimited(request('/api/health', '198.51.100.1'), throwing), null)
  assert.equal(await apiRateLimited(request('/api/health', '198.51.100.1'), undefined), null)
  const binding = limiter(0)
  // Service-binding calls without CF-Connecting-IP are not pooled into one shared bucket.
  assert.equal(await apiRateLimited(request('/api/me'), binding), null)
  assert.equal(await apiRateLimited(request('/hs', '198.51.100.1'), binding), null)
  assert.deepEqual(binding.keys, [])
})

/** In-memory stand-in for caches.default. */
function memoryCache() {
  const store = new Map()
  return {
    store,
    async match(key) { const hit = store.get(key.url); return hit ? hit.clone() : undefined },
    async put(key, response) { store.set(key.url, response) },
  }
}
const json = (body, status = 200, headers = {}) => Response.json(body, { status, headers: { 'Cache-Control': 'public, max-age=60', ...headers } })

test('public answers are served from the edge cache by full URL, and only successful ones are stored', async () => {
  const cache = memoryCache()
  const tasks = []
  let builds = 0
  const build = body => async () => { builds++; return json(body) }
  const url = 'https://edu.afyllx.com/classhub/api/v1/public/timetable?truong=a'
  const first = await edgeCached(url, task => tasks.push(task), build({ n: 1 }), cache)
  await Promise.all(tasks)
  assert.deepEqual(await first.json(), { n: 1 })
  const second = await edgeCached(url, task => tasks.push(task), build({ n: 2 }), cache)
  assert.deepEqual(await second.json(), { n: 1 })
  assert.equal(second.headers.get('X-Edge-Cache'), 'hit')
  assert.equal(builds, 1)
  // Another query string is another entry.
  assert.deepEqual(await (await edgeCached(url + '&lop=8a', task => tasks.push(task), build({ n: 3 }), cache)).json(), { n: 3 })
  await Promise.all(tasks)
  assert.deepEqual([...cache.store.keys()], [url, url + '&lop=8a'])

  // Errors and responses with cookies are never stored; a failing cache or no cache still answers.
  const other = 'https://edu.afyllx.com/classhub/api/v1/public/timetable?truong=b'
  await edgeCached(other, task => tasks.push(task), async () => json({ error: 1 }, 400), cache)
  await edgeCached(other, task => tasks.push(task), async () => json({ n: 4 }, 200, { 'Set-Cookie': 'a=b' }), cache)
  await Promise.all(tasks)
  assert.equal(cache.store.has(other), false)
  const broken = { match: async () => { throw new Error('down') }, put: () => { throw new Error('down') } }
  assert.deepEqual(await (await edgeCached(other, () => {}, async () => json({ n: 5 }), broken)).json(), { n: 5 })
  assert.deepEqual(await (await edgeCached(other, () => {}, async () => json({ n: 6 }), undefined)).json(), { n: 6 })
})

test('only the cloud configs carry the API limit and edge cache, with unique namespaces', () => {
  const strip = text => JSON.parse(text.replace(/^\s*\/\/.*$/gm, ''))
  const config = path => strip(readFileSync(new URL(path, import.meta.url), 'utf8'))
  const cloud = config('../cloud/wrangler.jsonc')
  const accounts = config('../accounts/cloud/wrangler.jsonc')
  const limitOf = (item) => item.ratelimits.find(limit => limit.name === 'API_LIMIT')
  for (const item of [cloud, accounts]) assert.deepEqual(limitOf(item).simple, { limit: 300, period: apiLimitPeriod })
  assert.equal(cloud.vars.PUBLIC_EDGE_CACHE, '1')
  const ids = [...cloud.ratelimits, ...accounts.ratelimits].map(item => item.namespace_id)
  assert.equal(new Set(ids).size, ids.length)
  for (const id of ['7101', '7102', '7103', '7104', '7105', '7106', '7107', '517401', '517402', '517410', '517411', '4086926']) {
    assert.equal([limitOf(cloud).namespace_id, limitOf(accounts).namespace_id].includes(id), false)
  }
  for (const path of ['../wrangler.jsonc', '../accounts/wrangler.jsonc']) {
    const local = config(path)
    assert.equal((local.ratelimits ?? []).some(item => item.name === 'API_LIMIT'), false)
    assert.equal(local.vars?.PUBLIC_EDGE_CACHE, undefined)
  }
})

test('static pages refuse framing and keep their security headers', () => {
  const rules = path => readFileSync(new URL(path, import.meta.url), 'utf8').split(/\r?\n/).filter(line => line && !line.startsWith('#'))
  const accounts = rules('../accounts/public/_headers')
  assert.equal(accounts[0], '/*')
  for (const header of ['X-Frame-Options: DENY', "Content-Security-Policy: frame-ancestors 'none'",
    'Strict-Transport-Security: max-age=31536000; includeSubDomains', 'X-Content-Type-Options: nosniff',
    'Referrer-Policy: strict-origin-when-cross-origin']) assert.ok(accounts.includes('  ' + header), header)
  const classhub = rules('../public/_headers')
  assert.equal(classhub[0], '/*')
  const csp = classhub.find(line => line.startsWith('  Content-Security-Policy:'))
  assert.match(csp, /default-src 'none'; script-src 'self'/)
  assert.match(csp, /frame-ancestors 'none'/)
  for (const header of ['X-Frame-Options: DENY', 'Strict-Transport-Security: max-age=31536000; includeSubDomains',
    'X-Content-Type-Options: nosniff']) assert.ok(classhub.includes('  ' + header), header)
})
