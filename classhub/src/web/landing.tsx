import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { Backpack, ChevronRight, GraduationCap, Lock, Sparkles, X } from 'lucide-react'
import { basePath, errorText, request, send, signIn, studentTimetablePath, useLoad, value } from './ui'
import { changeSchoolHref } from './school-choice'
import './edu.css'
import './landing.css'

// The ClassHub front door on the web: two large entrances (staff and teachers, students) and the
// administration sign-in tucked behind a lock in the top-right corner.

export type Identity = { user: { name: string; email: string }; workspaces: { id: string; role: string }[]; local: boolean }
type PublicSchool = { enabled: false } | { enabled: true; school: string; slug: string; classes: { id: string; name: string }[] }

function read(key: string) { try { return localStorage.getItem(key) } catch { return null } }

function AdminSheet({ close, onLogin }: { close: () => void; onLogin: (identity: Identity, code: string) => void }) {
  const [activate, setActivate] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const first = useRef<HTMLInputElement>(null)
  useEffect(() => {
    first.current?.focus()
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [activate])
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setBusy(true)
    setError('')
    try {
      const email = value(data, 'email').trim().toLowerCase()
      const password = value(data, 'password')
      const code = value(data, 'code').trim()
      if (activate) await send('/api/v1/activate', { code, email, password, name: value(data, 'name') })
      await signIn(email, password, false)
      const response = await request<{ data: Identity }>('/api/v1/me')
      onLogin(response.data, code)
    } catch (failure) { setError(errorText(failure)) } finally { setBusy(false) }
  }
  return <div className="edu-backdrop" onClick={event => { if (event.target === event.currentTarget) close() }}>
    <div className="edu-sheet landing-sheet" role="dialog" aria-modal="true" aria-labelledby="admin-title">
      <div className="edu-sheet-grip" aria-hidden="true" />
      <div className="landing-sheet-head">
        <span className="landing-lock-badge" aria-hidden="true"><Lock size={18} /></span>
        <div><p className="edu-eyebrow">Quản trị</p><h2 id="admin-title">{activate ? 'Kích hoạt tài khoản' : 'Đăng nhập'}</h2></div>
        <button type="button" className="landing-close" aria-label="Đóng" onClick={close}><X size={20} aria-hidden="true" /></button>
      </div>
      <p className="edu-muted">{activate ? 'Dùng mã mời và email đã được cấp.' : 'Dành cho chủ đơn vị và quản trị cơ sở.'}</p>
      <form className="landing-form" onSubmit={submit} key={String(activate)}>
        {activate && <label>Họ và tên<input ref={first} name="name" autoComplete="name" maxLength={100} required /></label>}
        <label>Email<input ref={activate ? undefined : first} type="email" name="email" autoComplete="username" maxLength={254} required /></label>
        <label>Mật khẩu<input type="password" name="password" autoComplete={activate ? 'new-password' : 'current-password'}
          minLength={activate ? 12 : undefined} maxLength={128} required /></label>
        {activate && <label>Mã mời<input name="code" autoComplete="off" pattern="[0-9a-f]{64}" required /></label>}
        {error && <p className="landing-error" role="alert">{error}</p>}
        <button className="edu-primary edu-press" disabled={busy}>{busy ? 'Đang xử lý…' : activate ? 'Kích hoạt và đăng nhập' : 'Đăng nhập'}</button>
      </form>
      <button type="button" className="text-button" onClick={() => { setActivate(!activate); setError('') }}>
        {activate ? 'Quay lại đăng nhập' : 'Tôi có mã mời và cần tạo tài khoản'}
      </button>
    </div>
  </div>
}

export function Landing({ admin, openAdmin, closeAdmin, onLogin }: {
  admin: boolean; openAdmin: () => void; closeAdmin: () => void; onLogin: (identity: Identity, code: string) => void
}) {
  const load = useLoad<{ data: PublicSchool }>('/api/v1/public/timetable')
  const school = load.value?.data.enabled ? load.value.data : null
  const remembered = read('classhub:student-class' + (school ? ':' + school.slug : ''))
  const rememberedName = school?.classes.find(item => item.id === remembered)?.name ?? remembered?.toUpperCase()
  const studentLink = studentTimetablePath + (school ? '?truong=' + school.slug + (remembered ? '&lop=' + remembered : '')
    : remembered ? '?lop=' + remembered : '')
  const lockRef = useRef<HTMLButtonElement>(null)
  return <div className="edu landing">
    <div className="landing-blobs" aria-hidden="true">
      <i style={{ '--dx': '40px', '--dy': '30px' } as CSSProperties} /><i style={{ '--dx': '-36px', '--dy': '24px' } as CSSProperties} /><i />
    </div>
    <header className="landing-top">
      <div className="landing-brand">
        <span className="landing-mark"><img src={basePath + '/afyllx-edu-mark.png'} width={34} height={23} alt="" /></span>
        <span><strong>AFYLLX Edu</strong><small>ClassHub</small></span>
      </div>
      <button ref={lockRef} type="button" className="landing-lock edu-press" aria-label="Đăng nhập quản trị" title="Đăng nhập quản trị"
        aria-haspopup="dialog" aria-expanded={admin} onClick={openAdmin}><Lock size={18} aria-hidden="true" /></button>
    </header>
    <main className="landing-main">
      <section className="landing-hero edu-rise">
        <p className="edu-eyebrow"><Sparkles size={13} aria-hidden="true" /> Chào mừng</p>
        <h1>{school?.school ?? 'Lớp học, lịch học và chuyên cần'}</h1>
        <p className="edu-muted">Bạn là ai? Chọn lối vào phù hợp.</p>
      </section>
      <nav className="landing-doors" aria-label="Lối vào">
        <Link to="/gv" className="landing-door edu-card edu-press edu-rise" style={{ '--i': 1 } as CSSProperties}>
          <span className="edu-icon-tile is-primary"><GraduationCap size={26} aria-hidden="true" /></span>
          <span className="landing-door-text"><strong>Cán bộ, giáo viên</strong><small>Điểm danh, lịch dạy, lớp của tôi</small></span>
          <ChevronRight className="landing-arrow" size={22} aria-hidden="true" />
        </Link>
        <Link to={studentLink} className="landing-door edu-card edu-press edu-rise" style={{ '--i': 2 } as CSSProperties}>
          <span className="edu-icon-tile is-teal"><Backpack size={26} aria-hidden="true" /></span>
          <span className="landing-door-text"><strong>Học sinh</strong>
            <small>{rememberedName ? 'Mở thời khóa biểu lớp ' + rememberedName : 'Thời khóa biểu, thông báo của lớp'}</small></span>
          <ChevronRight className="landing-arrow" size={22} aria-hidden="true" />
        </Link>
      </nav>
      <footer className="landing-foot edu-rise" style={{ '--i': 3 } as CSSProperties}>
        {basePath && <Link to="/thu">Xem bản dùng thử</Link>}
        {basePath && <a href={changeSchoolHref(basePath)}>Đổi trường</a>}
        <span>AFYLLX Edu · ClassHub</span>
      </footer>
    </main>
    {admin && <AdminSheet close={() => { closeAdmin(); lockRef.current?.focus() }} onLogin={onLogin} />}
  </div>
}
