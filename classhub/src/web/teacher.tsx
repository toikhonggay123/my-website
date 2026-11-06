import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle, ArrowLeft, BellRing, CalendarDays, Check, ChevronLeft, ChevronRight, ClipboardCheck, Filter, House,
  KeyRound, LogOut, MessageSquare, Moon, Sparkles, UsersRound,
} from 'lucide-react'
import {
  RequestError, addDays, basePath, errorText, formatClock, formatDay, localDay, request, send, useLoad, type Workspace,
} from './ui'
import './edu.css'
import './teacher.css'

// The teacher page: one clear "do this now" card, the day as a single timeline, one-tap attendance,
// the week and the teacher's classes. It reuses the ClassHub API and sign-in, scoped to the teacher.

type Identity = { user: { name: string; email: string }; workspaces: Workspace[]; local: boolean }
type Status = 'present' | 'late' | 'absent' | 'excused' | 'unmarked'
type Shift = 'morning' | 'afternoon'
type Period = { class_id: string; class_name: string; shift: Shift; period: number; subject: string; room: string
  starts_at: string | null; ends_at: string | null }
type TodaySession = { id: string; class_id: string; class_name: string; shift: Shift | null; lesson_date: string
  starts_at: number; ends_at: number; status: string; attendance_state: 'unmarked' | 'draft' | 'finalized'; teacher_name: string
  mine: boolean; roster: number; counts: Partial<Record<Status, number>>; flagged: { name: string; status: Status }[] }
type PendingSession = Omit<TodaySession, 'mine' | 'roster' | 'counts' | 'flagged'>
type Today = { date: string; weekday: number; closure: string | null; periods: Period[]; sessions: TodaySession[]; pending: PendingSession[] }
type Entry = { enrollment_id: string; name: string; code: string; status: Status; note: string }
type Sheet = {
  session: { id: string; class_name: string; lesson_date: string; starts_at: number; ends_at: number; teacher_name: string
    status: 'scheduled' | 'completed' | 'cancelled'; attendance_state: 'unmarked' | 'draft' | 'finalized'; version: number; shift: Shift | null }
  roster: Entry[]; canEdit: boolean; correctableUntil: number | null
}

const workspaceKey = 'classhub:gv:workspace'
const shiftName: Record<Shift, string> = { morning: 'Buổi sáng', afternoon: 'Buổi chiều' }
const dayNames = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật']
const statusName: Record<Status, string> = { present: 'Có mặt', absent: 'Vắng', late: 'Đi muộn', excused: 'Có phép', unmarked: 'Chưa đánh dấu' }
const cycle: Status[] = ['present', 'absent', 'late', 'excused']
const weekdayOf = (date: string) => new Date(date + 'T00:00:00Z').getUTCDay() || 7
const weekStart = (date: string) => addDays(date, 1 - weekdayOf(date))
const clock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
function readStorage(key: string) { try { return localStorage.getItem(key) } catch { return null } }
function writeStorage(key: string, value: string | null) {
  try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value) } catch { /* Storage is optional. */ }
}
function useNow() {
  const [now, setNow] = useState(() => clock.format(new Date()))
  useEffect(() => {
    const timer = setInterval(() => setNow(clock.format(new Date())), 30_000)
    return () => clearInterval(timer)
  }, [])
  return now
}
const stagger = (index: number) => ({ '--i': index }) as CSSProperties

function Brand() {
  return <Link className="tp-brand" to="/gv">
    <span className="tp-mark"><img src={basePath + '/afyllx-edu-mark.png'} width={30} height={20} alt="" /></span>
    <span><strong>AFYLLX Edu</strong><small>Giáo viên</small></span>
  </Link>
}
function Loading() {
  return <div className="tp-loading" role="status"><span className="edu-skeleton" /><span className="edu-skeleton" /><span className="sr-only">Đang tải…</span></div>
}
function Problem({ message, retry }: { message: string; retry?: () => void }) {
  return <div className="tp-problem" role="alert"><p>{message}</p>{retry && <button type="button" onClick={retry}>Thử lại</button>}</div>
}
function Load<T>({ load, children }: { load: { value?: T; error?: string; refresh: () => void }; children: (value: T) => ReactNode }) {
  if (load.error) return <Problem message={load.error} retry={load.refresh} />
  if (!load.value) return <Loading />
  return <>{children(load.value)}</>
}
function Gate({ title, children }: { title: string; children: ReactNode }) {
  return <div className="edu tp tp-gate"><header className="tp-top edu-glass-bar"><Brand /></header>
    <main className="tp-main edu-page"><div className="tp-gate-card edu-card"><h1>{title}</h1>{children}</div></main></div>
}
function DoneMark() {
  return <svg className="edu-check tp-done-mark" viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
    <path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

/* ------------------------------------------------------------------ Sign-in, activation, reset */

async function signIn(email: string, password: string) {
  await request('/api/auth/sign-in/email', 'POST', { email: email.trim().toLowerCase(), password, rememberMe: true })
}
function useSubmit(action: (data: FormData) => Promise<void>) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try { await action(new FormData(event.currentTarget)) } catch (failure) { setError(errorText(failure)) } finally { setBusy(false) }
  }
  return { busy, error, submit }
}
const text = (data: FormData, name: string) => String(data.get(name) ?? '')
function useHashCode() {
  const location = useLocation()
  const navigate = useNavigate()
  const [code] = useState(() => {
    const value = location.hash.slice(1)
    return /^[0-9a-f]{64}$/.test(value) ? value : ''
  })
  // Drop the one-time code from the address bar and history once it is in memory.
  useEffect(() => { if (location.hash) navigate(location.pathname, { replace: true }) }, [])
  return code
}

function Login({ onDone }: { onDone: () => void }) {
  const form = useSubmit(async data => { await signIn(text(data, 'email'), text(data, 'password')); onDone() })
  return <Gate title="Đăng nhập">
    <p className="tp-muted">Dành cho cán bộ, giáo viên. Đăng nhập một lần, điện thoại sẽ nhớ trong 30 ngày.</p>
    <form className="tp-form" onSubmit={form.submit}>
      <label>Email<input type="email" name="email" autoComplete="username" required maxLength={254} /></label>
      <label>Mật khẩu<input type="password" name="password" autoComplete="current-password" required maxLength={128} /></label>
      {form.error && <p className="tp-error" role="alert">{form.error}</p>}
      <button className="edu-primary edu-press" disabled={form.busy}>{form.busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
    </form>
    <p className="tp-muted tp-small"><KeyRound size={15} aria-hidden="true" /> Quên mật khẩu? Nhờ quản trị trường gửi link đặt lại.</p>
    <p className="tp-muted tp-small">Chưa có tài khoản? Nhờ quản trị gửi link kích hoạt.</p>
    <Link className="tp-small" to="/">← Về trang chọn lối vào</Link>
  </Gate>
}

function Activate({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate()
  const code = useHashCode()
  const [existing, setExisting] = useState(false)
  const form = useSubmit(async data => {
    const email = text(data, 'email').trim().toLowerCase()
    const password = text(data, 'password')
    if (!existing) {
      if (password !== text(data, 'confirm')) throw new Error('Hai lần nhập mật khẩu chưa khớp.')
      await send('/api/v1/activate', { code, email, password, name: text(data, 'name') })
    }
    await signIn(email, password)
    await send('/api/v1/accept-invitation', { code })
    onDone()
    navigate('/gv', { replace: true })
  })
  if (!code) return <Gate title="Link chưa đúng">
    <p>Link kích hoạt không đầy đủ hoặc đã được dùng. Hãy mở lại đúng link quản trị gửi, hoặc nhờ tạo link mới.</p>
    <Link className="button" to="/gv">Đến trang đăng nhập</Link>
  </Gate>
  return <Gate title={existing ? 'Nhận lời mời' : 'Kích hoạt tài khoản'}>
    <p className="tp-muted">{existing ? 'Đăng nhập bằng tài khoản ClassHub đã có để vào đơn vị mới.'
      : 'Tạo mật khẩu để vào trang giáo viên. Dùng đúng email đã được mời.'}</p>
    <form className="tp-form" onSubmit={form.submit} key={String(existing)}>
      {!existing && <label>Họ và tên<input name="name" autoComplete="name" required maxLength={100} /></label>}
      <label>Email được mời<input type="email" name="email" autoComplete="username" required maxLength={254} /></label>
      <label>Mật khẩu
        <input type="password" name="password" autoComplete={existing ? 'current-password' : 'new-password'}
          aria-describedby={existing ? undefined : 'tp-password-hint'} minLength={existing ? undefined : 12} maxLength={128} required /></label>
      {!existing && <small id="tp-password-hint" className="tp-muted">Ít nhất 12 ký tự.</small>}
      {!existing && <label>Nhập lại mật khẩu<input type="password" name="confirm" autoComplete="new-password" minLength={12} maxLength={128} required /></label>}
      {form.error && <p className="tp-error" role="alert">{form.error}</p>}
      <button className="edu-primary edu-press" disabled={form.busy}>{form.busy ? 'Đang xử lý…' : existing ? 'Đăng nhập và tham gia' : 'Kích hoạt'}</button>
    </form>
    <button type="button" className="text-button" onClick={() => setExisting(!existing)}>
      {existing ? 'Tôi chưa có tài khoản' : 'Tôi đã có tài khoản ClassHub'}
    </button>
  </Gate>
}

function ResetPassword({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate()
  const code = useHashCode()
  const form = useSubmit(async data => {
    const password = text(data, 'password')
    if (password !== text(data, 'confirm')) throw new Error('Hai lần nhập mật khẩu chưa khớp.')
    const { email } = await send<{ email: string }>('/api/v1/password-reset', { code, password })
    await signIn(email, password)
    onDone()
    navigate('/gv', { replace: true })
  })
  if (!code) return <Gate title="Link chưa đúng">
    <p>Link đặt lại mật khẩu không đầy đủ hoặc đã được dùng. Hãy nhờ quản trị tạo link mới.</p>
    <Link className="button" to="/gv">Đến trang đăng nhập</Link>
  </Gate>
  return <Gate title="Đặt mật khẩu mới">
    <p className="tp-muted">Sau khi đặt, mọi thiết bị đang đăng nhập tài khoản này sẽ phải đăng nhập lại.</p>
    <form className="tp-form" onSubmit={form.submit}>
      <label>Mật khẩu mới<input type="password" name="password" autoComplete="new-password" minLength={12} maxLength={128} required
        aria-describedby="tp-reset-hint" /></label>
      <small id="tp-reset-hint" className="tp-muted">Ít nhất 12 ký tự.</small>
      <label>Nhập lại mật khẩu mới<input type="password" name="confirm" autoComplete="new-password" minLength={12} maxLength={128} required /></label>
      {form.error && <p className="tp-error" role="alert">{form.error}</p>}
      <button className="edu-primary edu-press" disabled={form.busy}>{form.busy ? 'Đang lưu…' : 'Lưu và đăng nhập'}</button>
    </form>
  </Gate>
}

/* ------------------------------------------------------------------ Today */

function sessionState(session: Pick<TodaySession, 'attendance_state' | 'starts_at' | 'status'>) {
  if (session.status === 'cancelled') return ['Đã hủy', 'muted'] as const
  if (session.attendance_state === 'finalized') return ['Đã chốt', 'done'] as const
  if (session.attendance_state === 'draft') return ['Đang nháp', 'draft'] as const
  if (session.starts_at > Date.now()) return ['Chưa đến giờ', 'muted'] as const
  return ['Cần điểm danh', 'todo'] as const
}
function sessionLabel(session: { shift: Shift | null; starts_at: number; ends_at: number }) {
  return (session.shift ? shiftName[session.shift] + ' · ' : '') + formatClock(session.starts_at) + '–' + formatClock(session.ends_at)
}
function Summary({ session }: { session: TodaySession }) {
  if (session.attendance_state === 'unmarked') return <small>{session.roster} học sinh</small>
  const present = (session.counts.present ?? 0) + (session.counts.late ?? 0)
  const absent = session.flagged.filter(row => row.status === 'absent').map(row => row.name)
  return <small>{present}/{session.roster} có mặt{absent.length ? ' · Vắng: ' + absent.slice(0, 4).join(', ') + (absent.length > 4 ? '…' : '') : ''}</small>
}

function ActionHero({ data, now }: { data: Today; now: number }) {
  const started = data.sessions.filter(row => row.status === 'scheduled' && row.attendance_state !== 'finalized' && row.starts_at <= now)
  const queue = [...started, ...data.pending.filter(row => !started.some(item => item.id === row.id))]
  const action = queue[0]
  if (action) {
    const today = action.lesson_date === data.date
    return <Link to={'/gv/diem-danh/' + action.id} className="tp-hero tp-hero-todo edu-press edu-rise edu-glow">
      <span className="tp-hero-kicker"><BellRing size={15} aria-hidden="true" /> Cần làm ngay</span>
      <strong className="tp-hero-title">Điểm danh {action.class_name}</strong>
      <span className="tp-hero-sub">{today ? '' : formatDay(action.lesson_date) + ' · '}{sessionLabel(action)}
        {action.attendance_state === 'draft' ? ' · đang nháp' : ''}</span>
      <span className="tp-hero-button">{action.attendance_state === 'draft' ? 'Tiếp tục điểm danh' : 'Điểm danh'} <ChevronRight size={18} aria-hidden="true" /></span>
      {queue.length > 1 && <span className="tp-hero-more">và {queue.length - 1} buổi khác chưa chốt</span>}
    </Link>
  }
  const upcoming = data.sessions.filter(row => row.status === 'scheduled' && row.attendance_state !== 'finalized').sort((a, b) => a.starts_at - b.starts_at)[0]
  if (upcoming) return <div className="tp-hero tp-hero-next edu-rise">
    <span className="tp-hero-kicker"><CalendarDays size={15} aria-hidden="true" /> Sắp tới</span>
    <strong className="tp-hero-title">Điểm danh {upcoming.class_name} lúc {formatClock(upcoming.starts_at)}</strong>
    <span className="tp-hero-sub">{sessionLabel(upcoming)}</span>
  </div>
  if (data.sessions.some(row => row.attendance_state === 'finalized')) return <div className="tp-hero tp-hero-done edu-rise">
    <span className="tp-hero-kicker"><DoneMark /> Xong rồi</span>
    <strong className="tp-hero-title">Đã điểm danh xong hôm nay</strong>
    <span className="tp-hero-sub">Cảm ơn bạn. Kết quả đã được ghi lại.</span>
  </div>
  return <div className="tp-hero tp-hero-rest edu-rise">
    <span className="tp-hero-kicker"><Moon size={15} aria-hidden="true" /> {data.closure ? 'Trường nghỉ' : 'Hôm nay'}</span>
    <strong className="tp-hero-title">{data.closure ? data.closure : 'Không có buổi cần điểm danh'}</strong>
  </div>
}

type TimelineItem = { key: string; start: string; end: string; title: string; detail: string; session?: TodaySession; live: boolean; past: boolean }
function timeline(data: Today, now: string): TimelineItem[] {
  const used = new Set<string>()
  const items: TimelineItem[] = data.periods.map(row => {
    const session = data.sessions.find(item => item.class_id === row.class_id && item.shift === row.shift)
    const start = row.starts_at ?? '--:--', end = row.ends_at ?? '--:--'
    return { key: row.shift + row.period + row.class_id, start, end, title: row.class_name + ' · ' + row.subject,
      detail: shiftName[row.shift] + ', tiết ' + row.period + (row.room ? ' · ' + row.room : ''), session,
      live: start <= now && now < end, past: end <= now }
  })
  for (const item of items) if (item.session) used.add(item.session.id)
  for (const session of data.sessions.filter(row => !used.has(row.id))) {
    const start = formatClock(session.starts_at), end = formatClock(session.ends_at)
    items.push({ key: session.id, start, end, title: 'Điểm danh ' + session.class_name, detail: sessionLabel(session), session,
      live: start <= now && now < end, past: end <= now })
  }
  return items.sort((a, b) => a.start.localeCompare(b.start))
}

function TodayView({ api, name }: { api: string; name: string }) {
  const load = useLoad<{ data: Today }>(api + '/teacher/today')
  const now = useNow()
  return <Load load={load}>{({ data }) => {
    const items = timeline(data, now)
    return <>
      <header className="tp-heading edu-rise">
        <p className="tp-greeting"><Sparkles size={15} aria-hidden="true" /> Chào {name}</p>
        <h1>Hôm nay</h1><p>{dayNames[data.weekday - 1]}, {formatDay(data.date)}</p>
      </header>
      <ActionHero data={data} now={Date.now()} />
      <section aria-labelledby="tp-day">
        <h2 id="tp-day">Lịch trong ngày</h2>
        {items.length ? <ol className="tp-timeline">{items.map((item, index) => {
          const [label, tone] = item.session ? sessionState(item.session) : ['', '']
          const body = <>
            <span className="tp-time">{item.start}<small>{item.end}</small></span>
            <span className="tp-dot" aria-hidden="true" />
            <span className="tp-period"><strong>{item.title}</strong><small>{item.detail}</small>
              {item.session && item.session.attendance_state !== 'unmarked' && <Summary session={item.session} />}</span>
            {item.live ? <span className="tp-chip tp-chip-live"><span className="tp-live edu-live-dot" aria-hidden="true" /> Đang dạy</span>
              : item.session ? <span className={'tp-chip tp-chip-' + tone}>{tone === 'done' && <Check size={13} aria-hidden="true" />} {label}</span> : null}
          </>
          const className = 'tp-slot edu-rise' + (item.live ? ' is-live' : item.past ? ' is-past' : '')
          return <li key={item.key} style={stagger(index + 2)}>
            {item.session ? <Link className={className + ' edu-press'} to={'/gv/diem-danh/' + item.session.id}>{body}</Link>
              : <div className={className}>{body}</div>}
          </li>
        })}</ol> : <p className="tp-empty">{data.closure ? 'Không có tiết vì trường nghỉ.' : 'Hôm nay bạn không có tiết theo thời khóa biểu.'}</p>}
        <Link className="tp-more" to="/gv/tuan"><CalendarDays size={16} aria-hidden="true" /> Xem cả tuần</Link>
      </section>
    </>
  }}</Load>
}

/* ------------------------------------------------------------------ Attendance */

function restore(key: string, roster: Entry[]) {
  const saved = readStorage(key)
  if (!saved) return null
  try {
    const statuses = JSON.parse(saved) as Record<string, { status: Status; note: string }>
    return roster.map(row => statuses[row.enrollment_id] ? { ...row, ...statuses[row.enrollment_id] } : row)
  } catch { return null }
}

function ConfirmSheet({ title, children, confirm, cancel }: { title: string; children: ReactNode; confirm: () => void; cancel: () => void }) {
  const primary = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    primary.current?.focus()
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') cancel() }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [])
  return <div className="edu-backdrop" onClick={event => { if (event.target === event.currentTarget) cancel() }}>
    <div className="edu-sheet tp-sheet" role="dialog" aria-modal="true" aria-labelledby="tp-sheet-title">
      <div className="edu-sheet-grip" aria-hidden="true" />
      <h2 id="tp-sheet-title">{title}</h2>{children}
      <div className="tp-sheet-actions"><button type="button" className="edu-press" onClick={cancel}>Quay lại</button>
        <button type="button" className="edu-primary edu-press" ref={primary} onClick={confirm}>Chốt</button></div>
    </div>
  </div>
}

function Finalized({ sheet, endpoint, done }: { sheet: Sheet; endpoint: string; done: (message: string) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const count = (status: Status) => sheet.roster.filter(row => row.status === status).length
  const absent = sheet.roster.filter(row => row.status === 'absent').map(row => row.name)
  async function reopen() {
    setBusy(true)
    setError('')
    try {
      await send(endpoint + '/reopen', { version: sheet.session.version, reason: 'Giáo viên sửa trong 30 phút sau khi chốt' })
      done('Đã mở lại. Sửa xong hãy chốt lại.')
    } catch (failure) { setError(errorText(failure)) } finally { setBusy(false) }
  }
  return <section className="tp-finished edu-card edu-rise" aria-labelledby="tp-finished-title">
    <span className="tp-finished-icon"><DoneMark /></span>
    <h2 id="tp-finished-title">Đã chốt điểm danh</h2>
    <p>{count('present') + count('late')}/{sheet.roster.length} có mặt · Vắng {count('absent')} · Muộn {count('late')} · Có phép {count('excused')}</p>
    {absent.length > 0 && <p className="tp-muted">Vắng: {absent.join(', ')}</p>}
    {error && <p className="tp-error" role="alert">{error}</p>}
    <div className="tp-finished-actions">
      <Link className="button edu-primary edu-press" to="/gv">Về Hôm nay</Link>
      {sheet.correctableUntil && <button type="button" className="edu-press" disabled={busy} onClick={reopen}>
        Sửa lại · còn {Math.max(1, Math.ceil((sheet.correctableUntil - Date.now()) / 60_000))} phút</button>}
    </div>
  </section>
}

function MarkSheet({ sheet, endpoint, done }: { sheet: Sheet; endpoint: string; done: (message: string) => void }) {
  const { session, roster, canEdit } = sheet
  const storageKey = 'classhub:gv:attendance:' + session.id + ':' + session.version
  const editable = canEdit && session.attendance_state !== 'finalized'
  // A sheet nobody has marked starts with everyone present; the teacher only taps the exceptions.
  const initial = session.attendance_state === 'unmarked' && editable
    ? roster.map(row => row.status === 'unmarked' ? { ...row, status: 'present' as Status } : row) : roster
  const [entries, setEntries] = useState(() => (editable && restore(storageKey, roster)) || initial)
  const [notes, setNotes] = useState<string[]>([])
  const [onlyExceptions, setOnlyExceptions] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const differs = (list: Entry[]) => entries.some((row, index) => row.status !== list[index].status || row.note !== list[index].note)
  const unsaved = differs(initial)
  const changed = differs(roster)
  useEffect(() => {
    if (!editable) return
    writeStorage(storageKey, unsaved ? JSON.stringify(Object.fromEntries(entries.map(row => [row.enrollment_id, { status: row.status, note: row.note }]))) : null)
  }, [entries])
  useEffect(() => {
    if (!unsaved || !editable) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [unsaved, editable])
  if (session.attendance_state === 'finalized') return <Finalized sheet={sheet} endpoint={endpoint} done={done} />
  const count = (status: Status) => entries.filter(row => row.status === status).length
  const unmarked = count('unmarked')
  const tap = (id: string) => setEntries(old => old.map(row => row.enrollment_id !== id ? row
    : { ...row, status: cycle[(cycle.indexOf(row.status) + 1) % cycle.length] }))
  async function submit(finalize: boolean) {
    setBusy(true)
    setError('')
    try {
      await send(endpoint + (finalize ? '/finalize' : ''), {
        version: session.version, entries: entries.map(({ enrollment_id, status, note }) => ({ enrollment_id, status, note })),
      }, finalize ? 'POST' : 'PUT')
      writeStorage(storageKey, null)
      done(finalize ? 'Đã chốt điểm danh.' : 'Đã lưu nháp.')
    } catch (failure) {
      setError(failure instanceof RequestError ? failure.message
        : 'Chưa gửi được vì mất kết nối. Dữ liệu vẫn giữ trên máy này, hãy thử lại khi có mạng.')
    } finally { setBusy(false) }
  }
  const absentNames = entries.filter(row => row.status === 'absent').map(row => row.name)
  const exceptions = entries.length - count('present')
  const visible = entries.filter(row => !onlyExceptions || row.status !== 'present')
  return <>
    <div className="tp-counts" role="status" aria-live="polite">
      {(['present', 'absent', 'late', 'excused'] as const).map(status => <span key={status} className={'tp-count tp-' + status}>
        <strong key={count(status)} className="edu-bump">{count(status)}</strong>{statusName[status]}</span>)}
    </div>
    {session.status === 'cancelled' && <p className="tp-banner">Buổi này đã hủy.</p>}
    {!canEdit && session.status === 'scheduled' && <p className="tp-banner">Điểm danh mở lúc {formatClock(session.starts_at)}.</p>}
    {editable && session.attendance_state === 'unmarked' && <p className="tp-hint">Cả lớp đang là <strong>Có mặt</strong>. Chạm vào tên để đổi: Vắng → Đi muộn → Có phép.</p>}
    {editable && entries.length > 12 && <button type="button" className="tp-filter edu-press" aria-pressed={onlyExceptions}
      onClick={() => setOnlyExceptions(!onlyExceptions)}><Filter size={15} aria-hidden="true" />
      {onlyExceptions ? 'Hiện cả lớp' : 'Chỉ em vắng, muộn, có phép (' + exceptions + ')'}</button>}
    {error && <p className="tp-error" role="alert">{error}</p>}
    <ul className="tp-roster">{visible.map((row, index) => {
      const noteOpen = notes.includes(row.enrollment_id) || Boolean(row.note)
      return <li key={row.enrollment_id} className={'tp-student edu-rise tp-' + row.status} style={stagger(Math.min(index, 12))}>
        <div className="tp-student-row">
          <button type="button" className="tp-student-tap" disabled={!editable || busy} onClick={() => tap(row.enrollment_id)}
            aria-label={row.name + ': ' + statusName[row.status] + (editable ? '. Chạm để đổi trạng thái' : '')}>
            <span className="tp-index" aria-hidden="true">{entries.indexOf(row) + 1}</span>
            <span className="tp-name">{row.name}<small>{row.code}</small></span>
            <span key={row.status} className="tp-pill edu-pop" aria-hidden="true">{statusName[row.status]}</span>
          </button>
          {editable && <button type="button" className="tp-note-button" aria-expanded={noteOpen}
            aria-label={'Ghi chú cho ' + row.name} onClick={() => setNotes(old => old.includes(row.enrollment_id)
              ? old.filter(id => id !== row.enrollment_id) : [...old, row.enrollment_id])}><MessageSquare size={17} aria-hidden="true" /></button>}
        </div>
        {noteOpen && (editable ? <input className="tp-note" aria-label={'Ghi chú cho ' + row.name} maxLength={400} value={row.note}
          placeholder="Ví dụ: về sớm tiết 4" onChange={event => {
            const note = event.target.value
            setEntries(old => old.map(item => item.enrollment_id === row.enrollment_id ? { ...item, note } : item))
          }} /> : <p className="tp-note-text">{row.note}</p>)}
      </li>
    })}</ul>
    {!entries.length && <p className="tp-empty">Chưa có học sinh trong buổi này.</p>}
    {editable && entries.length > 0 && <div className="tp-footer edu-glass-bar">
      <button type="button" className="edu-press" disabled={busy || !changed} onClick={() => submit(false)}>{busy ? 'Đang lưu…' : 'Lưu nháp'}</button>
      <button type="button" className="edu-primary edu-press" disabled={busy || unmarked > 0} onClick={() => setConfirming(true)}>
        Chốt · {count('present') + count('late')}/{entries.length} có mặt</button>
    </div>}
    {confirming && <ConfirmSheet title={'Chốt điểm danh ' + session.class_name + '?'} cancel={() => setConfirming(false)}
      confirm={() => { setConfirming(false); submit(true) }}>
      <div className="tp-sheet-stats">
        <span className="tp-present"><strong>{count('present')}</strong>Có mặt</span><span className="tp-late"><strong>{count('late')}</strong>Đi muộn</span>
        <span className="tp-absent"><strong>{count('absent')}</strong>Vắng</span><span className="tp-excused"><strong>{count('excused')}</strong>Có phép</span>
      </div>
      {absentNames.length > 0 && <p>Vắng: {absentNames.join(', ')}</p>}
      {session.shift && <p className="tp-muted">Sau khi chốt, bạn còn 30 phút để tự sửa.</p>}
    </ConfirmSheet>}
  </>
}

function MarkView({ api }: { api: string }) {
  const { sessionId } = useParams()
  const endpoint = api + '/sessions/' + sessionId + '/attendance'
  const load = useLoad<{ data: Sheet }>(endpoint)
  const [notice, setNotice] = useState('')
  return <>
    <Link className="tp-back" to="/gv"><ArrowLeft size={17} aria-hidden="true" /> Hôm nay</Link>
    {notice && <p key={notice} className="tp-notice edu-rise" role="status">{notice}</p>}
    <Load load={load}>{({ data }) => <>
      <header className="tp-heading tp-mark-heading">
        <p className="edu-eyebrow"><ClipboardCheck size={13} aria-hidden="true" /> Điểm danh</p>
        <h1>{data.session.class_name}</h1>
        <p>{formatDay(data.session.lesson_date)} · {sessionLabel(data.session)}</p>
        <span className={'tp-chip tp-chip-' + sessionState(data.session)[1]}>{sessionState(data.session)[0]}</span>
      </header>
      <MarkSheet key={data.session.id + ':' + data.session.version} sheet={data} endpoint={endpoint}
        done={message => { setNotice(message); load.refresh() }} />
    </>}</Load>
  </>
}

/* ------------------------------------------------------------------ Week and classes */

function WeekView({ api }: { api: string }) {
  const today = localDay()
  const [monday, setMonday] = useState(weekStart(today))
  const load = useLoad<{ data: { monday: string; days: { date: string; closure: string | null; periods: Period[] }[] } }>(
    api + '/teacher/week?from=' + monday)
  return <>
    <header className="tp-heading"><p className="edu-eyebrow"><CalendarDays size={13} aria-hidden="true" /> Lịch dạy</p><h1>Lịch tuần</h1>
      <div className="tp-week-nav">
        <button type="button" className="edu-press" aria-label="Tuần trước" onClick={() => setMonday(addDays(monday, -7))}><ChevronLeft size={18} aria-hidden="true" /></button>
        <span>{formatDay(monday)} – {formatDay(addDays(monday, 5))}</span>
        <button type="button" className="edu-press" aria-label="Tuần sau" onClick={() => setMonday(addDays(monday, 7))}><ChevronRight size={18} aria-hidden="true" /></button>
      </div>
      {monday !== weekStart(today) && <button type="button" className="text-button" onClick={() => setMonday(weekStart(today))}>Về tuần này</button>}
    </header>
    <Load load={load}>{({ data }) => <div className="tp-week" key={data.monday}>{data.days.map((day, index) => <section key={day.date}
      className={'tp-day edu-card edu-rise' + (day.date === today ? ' tp-day-today' : '')} style={stagger(index)} aria-labelledby={'tp-day-' + index}>
      <h2 id={'tp-day-' + index}>{dayNames[index]} <small>{formatDay(day.date)}</small></h2>
      {day.closure ? <p className="tp-muted">Nghỉ: {day.closure}</p> : day.periods.length ? <ol className="tp-mini">
        {day.periods.map(row => <li key={row.shift + row.period + row.class_id}>
          <span className="tp-time">{row.starts_at ?? '--:--'}</span>
          <span className="tp-period"><strong>{row.class_name} · {row.subject}</strong>
            <small>{shiftName[row.shift]}, tiết {row.period}{row.room ? ' · ' + row.room : ''}</small></span>
        </li>)}</ol> : <p className="tp-muted">Không có tiết.</p>}
    </section>)}</div>}</Load>
  </>
}

type ClassRow = { id: string; name: string; homeroom: number; enrolled: number; subjects: string | null }
function ClassesView({ api }: { api: string }) {
  const load = useLoad<{ data: ClassRow[] }>(api + '/teacher/classes')
  return <>
    <header className="tp-heading"><p className="edu-eyebrow"><UsersRound size={13} aria-hidden="true" /> Phân công</p><h1>Lớp của tôi</h1></header>
    <Load load={load}>{({ data }) => data.length ? <ul className="tp-cards">{data.map((item, index) => <li key={item.id} className="edu-rise" style={stagger(index)}>
      <Link className="tp-card edu-card edu-press" to={'/gv/lop/' + item.id}>
        <span className={'tp-class-badge' + (item.homeroom ? ' is-home' : '')}>{item.name}</span>
        <span className="tp-card-main"><strong>Lớp {item.name}</strong>
          <small>{[item.homeroom ? 'Chủ nhiệm' : '', item.subjects ?? ''].filter(Boolean).join(' · ') || 'Phân công giảng dạy'}</small>
          <small>{item.enrolled} học sinh</small></span>
        {Boolean(item.homeroom) && <span className="tp-chip tp-chip-done">GVCN</span>}
        <ChevronRight size={18} aria-hidden="true" />
      </Link></li>)}</ul> : <p className="tp-empty">Bạn chưa được phân công lớp nào trong học kỳ này.</p>}</Load>
  </>
}

type StudentStat = { id: string; name: string; code: string; present: number; late: number; absent: number; excused: number }
function ClassView({ api }: { api: string }) {
  const { classId } = useParams()
  const load = useLoad<{ data: { name: string; homeroom: boolean; from: string; to: string; sessions: number; students: StudentStat[] } }>(
    api + '/teacher/classes/' + classId)
  const [onlyFlagged, setOnlyFlagged] = useState(false)
  return <>
    <Link className="tp-back" to="/gv/lop"><ArrowLeft size={17} aria-hidden="true" /> Lớp của tôi</Link>
    <Load load={load}>{({ data }) => {
      const flagged = (row: StudentStat) => row.absent >= 2 || row.late >= 2
      const list = data.students.filter(row => !onlyFlagged || flagged(row))
      return <>
        <header className="tp-heading"><p className="edu-eyebrow">30 ngày qua</p><h1>Lớp {data.name}</h1>
          <p>{data.students.length} học sinh · {data.sessions} buổi đã chốt từ {formatDay(data.from)}</p></header>
        <label className="tp-toggle"><input type="checkbox" checked={onlyFlagged} onChange={event => setOnlyFlagged(event.target.checked)} />
          Chỉ học sinh vắng hoặc đi muộn từ 2 lần ({data.students.filter(flagged).length})</label>
        <ul className="tp-stats" key={String(onlyFlagged)}>{list.map((row, index) => <li key={row.id} className={'edu-rise' + (flagged(row) ? ' tp-flagged' : '')} style={stagger(Math.min(index, 12))}>
          <span className="tp-name">{flagged(row) && <AlertTriangle size={15} aria-label="Cần chú ý" />} {row.name}<small>{row.code}</small></span>
          <span className="tp-stat-values"><span>Vắng <strong>{row.absent}</strong></span><span>Muộn <strong>{row.late}</strong></span>
            <span>Phép <strong>{row.excused}</strong></span></span>
        </li>)}</ul>
        {!list.length && <p className="tp-empty">Không có học sinh cần chú ý.</p>}
      </>
    }}</Load>
  </>
}

/* ------------------------------------------------------------------ Shell */

function Shell({ identity, logout }: { identity: Identity; logout: () => void }) {
  const location = useLocation()
  const teaching = identity.workspaces.filter(item => item.role === 'teacher')
  const [selected, setSelected] = useState(() => readStorage(workspaceKey))
  const workspace = teaching.find(item => item.id === selected) ?? teaching[0]
  const api = '/api/v1/orgs/' + workspace.id
  const choose = (id: string) => { setSelected(id); writeStorage(workspaceKey, id) }
  return <div className="edu tp">
    <a className="skip" href="#tp-main">Đến nội dung</a>
    <header className="tp-top edu-glass-bar">
      <Brand />
      <details className="tp-account">
        <summary aria-label="Tài khoản"><span className="tp-avatar" aria-hidden="true">{identity.user.name[0]?.toUpperCase()}</span></summary>
        <div className="tp-menu edu-rise">
          <p><strong>{identity.user.name}</strong><small>{workspace.name}</small></p>
          {teaching.length > 1 && teaching.filter(item => item.id !== workspace.id).map(item =>
            <button type="button" key={item.id} onClick={() => choose(item.id)}>Chuyển sang {item.name}</button>)}
          <button type="button" onClick={logout}><LogOut size={16} aria-hidden="true" /> Đăng xuất</button>
        </div>
      </details>
    </header>
    <main className="tp-main" id="tp-main" key={workspace.id}>
      <div key={location.pathname} className="tp-route edu-page">
        <Routes location={location}>
          <Route index element={<TodayView api={api} name={identity.user.name} />} />
          <Route path="diem-danh/:sessionId" element={<MarkView api={api} />} />
          <Route path="tuan" element={<WeekView api={api} />} />
          <Route path="lop" element={<ClassesView api={api} />} />
          <Route path="lop/:classId" element={<ClassView api={api} />} />
          <Route path="*" element={<p className="tp-empty">Không tìm thấy trang. <Link to="/gv">Về hôm nay</Link></p>} />
        </Routes>
      </div>
    </main>
    <nav className="tp-nav edu-glass-bar" aria-label="Trang giáo viên">
      <NavLink to="/gv" end><House size={21} aria-hidden="true" />Hôm nay</NavLink>
      <NavLink to="/gv/tuan"><CalendarDays size={21} aria-hidden="true" />Tuần</NavLink>
      <NavLink to="/gv/lop"><UsersRound size={21} aria-hidden="true" />Lớp</NavLink>
    </nav>
  </div>
}

function Signed() {
  const [identity, setIdentity] = useState<Identity | null>()
  const [error, setError] = useState('')
  const refresh = () => request<{ data: Identity }>('/api/v1/me').then(response => {
    setError('')
    setIdentity(response.data)
  }, failure => {
    if (failure instanceof RequestError && failure.status === 401) setIdentity(null)
    else setError(errorText(failure))
  })
  useEffect(() => { refresh() }, [])
  async function logout() {
    await request('/api/auth/sign-out', 'POST').catch(() => undefined)
    setIdentity(null)
  }
  if (error) return <Gate title="Chưa mở được"><Problem message={error} retry={refresh} /></Gate>
  if (identity === undefined) return <Gate title="Giáo viên"><Loading /></Gate>
  if (identity === null) return <Login onDone={refresh} />
  if (identity.local) return <Gate title="Trang giáo viên">
    <p>ClassHub trên máy này không dùng tài khoản giáo viên. Trang giáo viên dùng trên bản web, khi giáo viên đăng nhập bằng link kích hoạt.</p>
    <a className="button" href={basePath + '/'}>Về trang quản trị</a>
  </Gate>
  if (!identity.workspaces.some(item => item.role === 'teacher')) {
    // Administrators who signed in here belong on the administration pages.
    if (identity.workspaces.length) return <Navigate to="/" replace />
    return <Gate title="Chưa có lớp">
      <p>Tài khoản {identity.user.email} chưa là giáo viên ở đơn vị nào.</p>
      <button type="button" className="text-button" onClick={logout}>Đăng xuất</button>
    </Gate>
  }
  return <Shell identity={identity} logout={logout} />
}

export function TeacherApp() {
  const [epoch, setEpoch] = useState(0)
  return <Routes>
    <Route path="kich-hoat" element={<Activate onDone={() => setEpoch(old => old + 1)} />} />
    <Route path="dat-lai-mat-khau" element={<ResetPassword onDone={() => setEpoch(old => old + 1)} />} />
    <Route path="*" element={<Signed key={epoch} />} />
  </Routes>
}
