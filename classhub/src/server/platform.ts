import { type Ctx, now, newId, one, query } from './core'

/**
 * AFYLLX Account bridge. On edu.afyllx.com the AFYLLX Account cookie (`afyllx_session`, Path=/) reaches ClassHub too.
 * ClassHub asks the accounts Worker over its service binding who the cookie belongs to. A Founder or platform
 * administrator gets owner rights in every active ClassHub workspace. Other AFYLLX accounts are ignored here until
 * per-product roles exist. Without the binding (local runs, QA) nothing changes.
 */
export const platformCookie = 'afyllx_session'
type PlatformAccount = { email: string; name: string; platform_role: 'founder' | 'platform_admin' }
export type PlatformUser = { id: string; name: string; email: string; platform: PlatformAccount['platform_role'] }

const cache = new WeakMap<Request, Promise<PlatformAccount | null>>()

/** Every afyllx_session value sent: a pre-move host-only cookie may sit next to the shared *.afyllx.com one. */
function platformTokens(c: Ctx) {
  return [...new Set((c.req.header('Cookie') ?? '').split(';').map(part => part.trim())
    .filter(part => part.startsWith(platformCookie + '=')).map(part => part.slice(platformCookie.length + 1))
    .filter(value => /^[0-9a-f]{64}$/.test(value)))].slice(0, 3)
}

function accountsRequest(c: Ctx, path: string, init: RequestInit = {}, needsSession = true) {
  const tokens = platformTokens(c)
  if (!c.env.ACCOUNTS || (needsSession && !tokens.length)) return null
  const headers = new Headers(init.headers)
  // Forward only the AFYLLX Account cookie, never ClassHub's own cookies.
  if (tokens.length) headers.set('Cookie', tokens.map(token => platformCookie + '=' + token).join('; '))
  const forwarded = c.req.header('CF-Connecting-IP')
  if (forwarded) headers.set('CF-Connecting-IP', forwarded)
  return c.env.ACCOUNTS.fetch(new Request(new URL(path, c.env.APP_ORIGIN), { ...init, headers }))
}
const writeHeaders = (c: Ctx) => ({ Origin: c.env.APP_ORIGIN, 'Content-Type': 'application/json' })

/**
 * Called when ClassHub's own sign-in rejects the email and password: tries the same pair against AFYLLX Account.
 * Returns null when there is no accounts service, so the original ClassHub answer stands.
 */
export async function platformSignIn(c: Ctx, email: string, password: string) {
  let response: Response | null
  try {
    response = await accountsRequest(c, '/api/login', { method: 'POST', headers: writeHeaders(c), body: JSON.stringify({ email, password }) }, false)
  } catch {
    return null
  }
  if (!response) return null
  const json = await response.json().catch(() => null) as { data?: { state?: string }; error?: { message?: string } } | null
  return { status: response.status, state: json?.data?.state, message: json?.error?.message, cookies: response.headers.getSetCookie() }
}

async function lookup(c: Ctx): Promise<PlatformAccount | null> {
  try {
    const response = await accountsRequest(c, '/api/me')
    if (!response || !response.ok) return null
    const json = await response.json() as { data?: { state?: string; account?: Partial<PlatformAccount> } }
    const account = json.data?.account
    if (json.data?.state !== 'full' || !account?.email || !account.name) return null
    if (account.platform_role !== 'founder' && account.platform_role !== 'platform_admin') return null
    return { email: account.email.toLowerCase(), name: account.name, platform_role: account.platform_role }
  } catch {
    // The accounts service being unavailable must never break ClassHub's own sign-in.
    return null
  }
}

/** The ClassHub user standing for the signed-in AFYLLX platform account, created on first use. */
export async function platformUser(c: Ctx): Promise<PlatformUser | null> {
  let pending = cache.get(c.req.raw)
  if (!pending) cache.set(c.req.raw, pending = lookup(c))
  const account = await pending
  if (!account) return null
  let user = await one<{ id: string; name: string; email: string }>(c, 'SELECT id,name,email FROM "user" WHERE email=?', account.email)
  if (!user) {
    const stamp = new Date(now()).toISOString()
    const id = newId()
    // No credential row: this user can only arrive through AFYLLX Account.
    await query(c, `INSERT INTO "user"(id,name,email,emailVerified,image,createdAt,updatedAt) VALUES (?,?,?,1,NULL,?,?)
      ON CONFLICT(email) DO NOTHING`, id, account.name, account.email, stamp, stamp).run()
    user = await one(c, 'SELECT id,name,email FROM "user" WHERE email=?', account.email)
    if (!user) return null
  }
  return { ...user, platform: account.platform_role }
}

/** Ends the AFYLLX Account session as well, returning the cookie-clearing headers to pass on. */
export async function platformSignOut(c: Ctx) {
  try {
    const response = await accountsRequest(c, '/api/logout', { method: 'POST', headers: writeHeaders(c), body: '{}' })
    return response?.ok ? response.headers.getSetCookie() : null
  } catch {
    return null
  }
}
