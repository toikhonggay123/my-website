// Small client helpers for AFYLLX Account.
export const base = import.meta.env.BASE_URL.replace(/\/$/, '')
export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message) }
}
export async function api<T>(path: string, method = 'GET', data?: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(base + path, {
      method, credentials: 'same-origin', cache: 'no-store',
      ...(method === 'GET' ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data ?? {}) }),
    })
  } catch { throw new ApiError(0, 'offline', 'Chưa kết nối được. Kiểm tra mạng rồi thử lại.') }
  const json = await response.json().catch(() => null) as { data?: T; error?: { code: string; message: string } } | null
  if (!response.ok || !json) throw new ApiError(response.status, json?.error?.code ?? 'error', json?.error?.message ?? 'Có lỗi xảy ra. Vui lòng thử lại.')
  return json.data as T
}
export const message = (error: unknown) => error instanceof Error ? error.message : 'Có lỗi xảy ra. Vui lòng thử lại.'
export const formatTime = (value: number) => new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short',
}).format(value)
export const roleName: Record<string, string> = {
  founder: 'AFYLLX Account Founder', platform_admin: 'Quản trị hệ thống', support: 'Hỗ trợ',
}
export type Me = {
  state: 'full' | 'mfa' | 'enroll'
  account: { id: string; email: string; name: string; platform_role: 'founder' | 'platform_admin' | 'support' | null; mfa_enabled: boolean }
  memberships: { org_id: string; name: string; role: string }[]
  products: { id: string; name: string; description: string; path: string; access: string }[]
  session: { expires_at: number; absolute_expires_at: number }
}
