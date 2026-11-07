import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { AlertCircle, ArrowLeft, ArrowRight, Inbox } from 'lucide-react'

export type Page<T> = { data: T[]; pagination: { page: number; hasMore: boolean } }
type ApiError = { error?: { message?: string }; message?: string }
export const basePath = import.meta.env.BASE_URL.replace(/\/$/, '')
export const studentTimetablePath = '/hs'
/** Earlier shared links keep working. */
export const legacyStudentTimetablePath = '/thoi-khoa-bieu'
export class RequestError extends Error {
  constructor(readonly status: number, message: string) { super(message) }
}
export async function request<T>(path: string, method = 'GET', data: unknown = {}) {
  const response = await fetch(basePath + path, {
    method, credentials: 'same-origin', cache: 'no-store',
    ...(method === 'GET' ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  })
  const json = await response.json().catch(() => null) as ApiError & T | null
  if (!response.ok || !json) {
    const message = response.status === 401 && path === signInPath ? 'Email hoặc mật khẩu chưa đúng.'
      : response.status === 401 && !path.startsWith('/api/v1/demo/') ? 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.'
      : json?.error?.message ?? json?.message ?? 'Không thể tải dữ liệu. Vui lòng thử lại.'
    throw new RequestError(response.status, message)
  }
  return json as T
}
const signInPath = '/api/auth/sign-in/email'
/**
 * Signs in with a ClassHub password or, on edu.afyllx.com, an AFYLLX Account (Founder, platform administrator).
 * An AFYLLX Account with two-step sign-in finishes at /tai-khoan and comes back here.
 */
export async function signIn(email: string, password: string, rememberMe: boolean) {
  const response = await request<{ platform?: 'full' | 'mfa' | 'enroll' }>(signInPath, 'POST',
    { email: email.trim().toLowerCase(), password, rememberMe })
  if (response.platform === 'mfa' || response.platform === 'enroll') {
    // AFYLLX Account lives at account.afyllx.com; QA runs keep it under /tai-khoan on the same origin.
    const live = location.hostname === 'afyllx.com' || location.hostname.endsWith('.afyllx.com')
    location.assign(live ? 'https://account.afyllx.com/?tiep=' + encodeURIComponent(location.href)
      : '/tai-khoan/?tiep=' + encodeURIComponent(location.pathname))
    await new Promise(() => undefined)
  }
}
export async function send<T = unknown>(path: string, data: unknown, method = 'POST') {
  return (await request<{ data: T }>(path, method, data)).data
}
export const errorText = (error: unknown) => error instanceof Error ? error.message : 'Có lỗi xảy ra. Vui lòng thử lại.'
/** Thrown when the user declines a confirmation. ActionForm stops quietly without showing an error. */
export class Cancelled extends Error {
  constructor() { super('Đã hủy thao tác.') }
}
export function confirmOrCancel(message: string) {
  if (!window.confirm(message)) throw new Cancelled()
}

export function useLoad<T>(path: string) {
  const [revision, setRevision] = useState(0)
  const key = path + ' ' + revision
  const [state, setState] = useState<{ key: string; value?: T; error?: string }>()
  useEffect(() => {
    if (!path) return
    let current = true
    request<T>(path).then(
      value => { if (current) setState({ key, value }) },
      error => { if (current) setState({ key, error: errorText(error) }) },
    )
    return () => { current = false }
  }, [path, key])
  return {
    value: state?.key === key ? state.value : undefined,
    error: state?.key === key ? state.error : undefined,
    refresh: () => setRevision(value => value + 1),
  }
}
type Load<T> = ReturnType<typeof useLoad<T>>
export function LoadView<T>({ load, children }: { load: Load<T>; children: (value: T) => ReactNode }) {
  if (load.error) return <div className="panel" role="alert"><Notice error>{load.error}</Notice><button onClick={load.refresh}>Thử lại</button></div>
  if (!load.value) return <p className="panel muted" role="status">Đang tải dữ liệu…</p>
  return children(load.value)
}
export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  if (!children) return null
  return <div className={'notice ' + (error ? 'error' : 'success')} role={error ? 'alert' : 'status'}>
    {error && <AlertCircle size={18} aria-hidden="true" />}<span>{children}</span>
  </div>
}
export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty"><Inbox aria-hidden="true" size={23} /><p>{children}</p></div>
}
export function Header({ kicker, title, description, children }: {
  kicker: string; title: string; description?: string; children?: ReactNode
}) {
  return <header className="page-heading">
    <div><p className="eyebrow">{kicker}</p><h1>{title}</h1>{description && <p className="muted">{description}</p>}</div>
    {children}
  </header>
}
export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <section className="panel"><h2>{title}</h2>{children}</section>
}
export function Disclosure({ summary, children }: { summary: ReactNode; children: ReactNode }) {
  const [opened, setOpened] = useState(false)
  return <details className="detail-row" onToggle={event => { if (event.currentTarget.open) setOpened(true) }}>
    <summary>{summary}</summary>
    {opened && children}
  </details>
}
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>
}
export function ActionForm({ action, children, label = 'Lưu thay đổi', grid = true, reset = true, onSaved }: {
  action: (data: FormData) => Promise<unknown>
  children: ReactNode
  label?: string
  grid?: boolean
  reset?: boolean
  onSaved?: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    setBusy(true)
    setError('')
    try {
      await action(data)
      if (reset) form.reset()
      onSaved?.()
    } catch (error) {
      if (!(error instanceof Cancelled)) setError(errorText(error))
    }
    finally { setBusy(false) }
  }
  return <form onSubmit={submit}>
    <fieldset disabled={busy} className={grid ? 'form-grid' : 'form-stack'}>
      {children}
      <Notice error>{error}</Notice>
      <div className="form-actions"><button className="primary" type="submit">{busy ? 'Đang lưu…' : label}</button></div>
    </fieldset>
  </form>
}
export const value = (data: FormData, name: string) => String(data.get(name) ?? '')
export function Pager({ page, hasMore, change }: { page: number; hasMore: boolean; change: (page: number) => void }) {
  if (page === 1 && !hasMore) return null
  return <div className="pager">
    <button type="button" disabled={page === 1} onClick={() => change(page - 1)}><ArrowLeft size={15} aria-hidden="true" /> Trước</button>
    <span>Trang {page}</span>
    <button type="button" disabled={!hasMore} onClick={() => change(page + 1)}>Sau <ArrowRight size={15} aria-hidden="true" /></button>
  </div>
}
export const localDay = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date())
export const formatDay = (date: string) => date.split('-').reverse().join('/')
const clock = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
export const formatClock = (instant: number) => clock.format(instant)
export function addDays(date: string, days: number) {
  return new Date(Date.parse(date) + days * 86_400_000).toISOString().slice(0, 10)
}
export const roles = { owner: 'Chủ đơn vị', branch_admin: 'Quản trị cơ sở', teacher: 'Giáo viên' }
export type Workspace = { id: string; name: string; type: string; role: keyof typeof roles; branch_id: string | null; shared_directory?: boolean }
export const statuses: Record<string, string> = {
  upcoming: 'Sắp diễn ra', needs_attendance: 'Cần điểm danh', needs_review: 'Chờ chốt', recording: 'Đang điểm danh',
  active: 'Đang học', draft: 'Bản nháp', scheduled: 'Đã lên lịch', completed: 'Hoàn tất',
  archived: 'Lưu trữ', cancelled: 'Đã hủy', finalized: 'Đã chốt', unmarked: 'Chưa đánh dấu',
  present: 'Có mặt', late: 'Đi muộn', absent: 'Vắng', excused: 'Có phép',
}
export function Badge({ status }: { status: string }) {
  return <span className={'badge badge-' + status}>{statuses[status] ?? status}</span>
}
export function PageSearch({ action, placeholder }: { action: (q: string) => void; placeholder: string }) {
  return <form className="search" onSubmit={event => {
    event.preventDefault()
    action(value(new FormData(event.currentTarget), 'q'))
  }}>
    <label className="sr-only" htmlFor="search-query">Tìm kiếm</label>
    <input id="search-query" type="search" name="q" maxLength={120} placeholder={placeholder} />
    <button>Tìm</button>
  </form>
}
