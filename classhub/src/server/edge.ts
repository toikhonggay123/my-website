// Edge protections shared by the ClassHub and AFYLLX Account Workers. No relative imports, so Node tests load it directly.
//
// API flood limit: every /api/* request counts against a Workers Rate Limiting binding keyed on the client address
// (CF-Connecting-IP, IPv6 grouped by /64). The binding exists only in the cloud configs; local runs and QA stay
// unlimited. A missing or failing limiter lets the request through: availability beats strictness here, and the
// sign-in, link and second-factor routes keep their own stricter limits.

/** Seconds in the binding's period (cloud/wrangler.jsonc: "simple": { "limit": 300, "period": 10 }). */
export const apiLimitPeriod = 10

/** One key per IPv4 address or per IPv6 /64, which a single host can rotate through freely. */
export function clientKey(raw: string | null | undefined) {
  const ip = String(raw ?? '').trim().toLowerCase()
  if (!ip) return ''
  if (!ip.includes(':')) return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(ip) ? ip : 'raw:' + ip.slice(0, 64)
  const mapped = ip.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/)
  if (mapped) return mapped[1]
  const parts = ip.split('::')
  if (parts.length > 2) return 'raw:' + ip.slice(0, 64)
  const head = parts[0] ? parts[0].split(':') : []
  const tail = parts.length === 2 && parts[1] ? parts[1].split(':') : []
  const groups = parts.length === 2 ? [...head, ...Array<string>(Math.max(0, 8 - head.length - tail.length)).fill('0'), ...tail] : head
  if (groups.length !== 8 || !groups.every(group => /^[0-9a-f]{1,4}$/.test(group))) return 'raw:' + ip.slice(0, 64)
  return groups.slice(0, 4).map(group => parseInt(group, 16).toString(16)).join(':') + '::/64'
}

type Limiter = { limit(options: { key: string }): Promise<{ success: boolean }> }

/**
 * Returns a 429 response when the client has used up its API budget, otherwise null.
 * Requests without CF-Connecting-IP never come straight from the internet (Cloudflare always sets it): they are
 * internal service-binding calls, so they are not pooled into one shared bucket. ClassHub forwards the end user's
 * address when it calls AFYLLX Account, so those calls count against that user only.
 */
export async function apiRateLimited(request: Request, limiter: Limiter | undefined): Promise<Response | null> {
  if (!limiter || typeof limiter.limit !== 'function') return null
  if (!new URL(request.url).pathname.startsWith('/api/')) return null
  const client = clientKey(request.headers.get('CF-Connecting-IP'))
  if (!client) return null
  let allowed = true
  try {
    allowed = (await limiter.limit({ key: 'api:' + client }))?.success !== false
  } catch {
    allowed = true
  }
  if (allowed) return null
  return Response.json({ error: { code: 'rate_limited', message: 'Quá nhiều yêu cầu từ mạng này. Vui lòng thử lại sau ít giây.' } }, {
    status: 429,
    headers: { 'Retry-After': String(apiLimitPeriod), 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  })
}

export type EdgeCache = { match(key: Request): Promise<Response | undefined>; put(key: Request, response: Response): Promise<void> }

/** The Cloudflare data-centre cache (caches.default), or undefined outside Workers. */
export const edgeCache = () => (globalThis as { caches?: { default?: EdgeCache } }).caches?.default

/**
 * Serves a public GET from the edge cache, keyed by its full public URL. Only 200 responses without cookies are
 * stored, for as long as their own Cache-Control allows (the caller sets public, max-age=60). Without a cache (Node,
 * local runs, QA) or when the cache fails, the response is built as usual. Hits carry X-Edge-Cache: hit.
 */
export async function edgeCached(url: string, waitUntil: (task: Promise<unknown>) => void, build: () => Promise<Response>,
  cache: EdgeCache | undefined): Promise<Response> {
  if (!cache) return build()
  const key = new Request(url, { method: 'GET' })
  let hit: Response | undefined
  try { hit = await cache.match(key) } catch { hit = undefined }
  if (hit) {
    // A copy so later middleware can still add headers to it.
    const copy = new Response(hit.body, hit)
    copy.headers.set('X-Edge-Cache', 'hit')
    return copy
  }
  const response = await build()
  if (response.status === 200 && !response.headers.has('Set-Cookie')) {
    try { waitUntil(cache.put(key, response.clone()).catch(() => undefined)) } catch { /* the response still goes out */ }
  }
  return response
}
