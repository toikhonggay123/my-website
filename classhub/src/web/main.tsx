import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Link, Navigate, NavLink, Route, RouterProvider, Routes, useNavigate, useParams } from 'react-router-dom'
import {
  BookOpen, CalendarDays, ChartNoAxesColumn, ChevronRight, GraduationCap, Grid3x3, House,
  Layers3, LogOut, Menu, Settings, UsersRound,
} from 'lucide-react'
// Three weights cover the UI: CSS 500 renders with 400, 600–650 with 700, 740–820 with 800.
import '@fontsource/be-vietnam-pro/latin-400.css'
import '@fontsource/be-vietnam-pro/latin-700.css'
import '@fontsource/be-vietnam-pro/latin-800.css'
import '@fontsource/be-vietnam-pro/vietnamese-400.css'
import '@fontsource/be-vietnam-pro/vietnamese-700.css'
import '@fontsource/be-vietnam-pro/vietnamese-800.css'
import './styles.css'
import {
  ActionForm, Field, Header, Notice, basePath, errorText, legacyStudentTimetablePath, request, roles, send, studentTimetablePath, value,
  type Workspace,
} from './ui'
import { Classes, ClassWorkspace, Courses, Staff, Students, TypeField, WorkspaceSettings } from './operations'
import { Attendance, Calendar } from './scheduling'
import { ReportsPage } from './reports'
import { Dashboard } from './dashboard'
import { SchoolTimetable } from './school'

type User = { name: string; email: string }
type Identity = { user: User; workspaces: Workspace[]; local: boolean }
// mode: shown only for school workspaces ('school') or only for course-based ones ('course').
const navigation = [
  { path: '', label: 'Hôm nay', icon: House, role: 'all' },
  { path: '/lich', label: 'Lịch học', icon: CalendarDays, role: 'all' },
  { path: '/lop', label: 'Lớp học', icon: Layers3, role: 'all' },
  { path: '/tkb', label: 'Thời khóa biểu', icon: Grid3x3, role: 'owner', mode: 'school' },
  { path: '/khoa-hoc', label: 'Khóa học', icon: BookOpen, role: 'admin', mode: 'course' },
  { path: '/hoc-vien', label: 'Học viên', icon: GraduationCap, role: 'owner' },
  { path: '/nhan-su', label: 'Nhân sự', icon: UsersRound, role: 'admin' },
  { path: '/bao-cao', label: 'Báo cáo', icon: ChartNoAxesColumn, role: 'admin' },
  { path: '/thiet-lap', label: 'Thiết lập', icon: Settings, role: 'owner' },
]

function Brand() {
  return <div className="brand"><span className="brand-icon"><img src={basePath + '/afyllx-edu-mark.png'} alt="" width={37} height={25} /></span>
    <span><strong>AFYLLX Edu</strong><small>ClassHub</small></span>
  </div>
}
function Gate({ children }: { children: React.ReactNode }) {
  return <div className="gate"><div className="gate-intro"><Brand /><div>
    <p className="eyebrow">Vận hành lớp học</p><h1>Quản lý lớp học và chuyên cần.</h1>
    <p>Tổ chức lịch dạy, quản lý học viên và theo dõi chuyên cần với ClassCheck.</p>
  </div><span className="gate-foot">AFYLLX Edu / ClassHub</span></div><main className="gate-main">{children}</main></div>
}

function Login({ onLogin }: { onLogin: (identity: Identity, code: string) => void }) {
  const [activate, setActivate] = useState(false)
  return <Gate><div className="gate-form">
    <p className="eyebrow">Cổng truy cập</p><h2>{activate ? 'Kích hoạt tài khoản' : 'Đăng nhập'}</h2>
    <p className="muted">{activate ? 'Dùng mã mời và email đã được cấp.' : 'Mở không gian làm việc của bạn.'}</p>
    <ActionForm key={String(activate)} label={activate ? 'Kích hoạt và đăng nhập' : 'Đăng nhập'} grid={false}
      action={async data => {
        const email = value(data, 'email').trim().toLowerCase()
        const password = value(data, 'password')
        const code = value(data, 'code').trim()
        if (activate) await send('/api/v1/activate', { code, email, password, name: value(data, 'name') })
        await request('/api/auth/sign-in/email', 'POST', { email, password, rememberMe: false })
        const response = await request<{ data: Identity }>('/api/v1/me')
        onLogin(response.data, code)
      }}>
      {activate && <Field label="Họ và tên"><input name="name" autoComplete="name" maxLength={100} required /></Field>}
      <Field label="Email"><input type="email" name="email" autoComplete="username" maxLength={254} required /></Field>
      <Field label="Mật khẩu"><input type="password" name="password" autoComplete={activate ? 'new-password' : 'current-password'}
        minLength={activate ? 12 : undefined} maxLength={128} required /></Field>
      {activate && <Field label="Mã mời"><input name="code" autoComplete="off" pattern="[0-9a-f]{64}" required /></Field>}
    </ActionForm>
    <button className="text-button" onClick={() => setActivate(!activate)}>
      {activate ? 'Quay lại đăng nhập' : 'Tôi có mã mời và cần tạo tài khoản'}
    </button>
    {basePath && <p><Link to="/thu">Về bản dùng thử</Link></p>}
  </div></Gate>
}

function WorkspacePicker({ identity, code, refresh, logout }: {
  identity: Identity; code: string; refresh: () => Promise<Identity>; logout: () => Promise<void>
}) {
  const navigate = useNavigate()
  const [owner, setOwner] = useState(false)
  const [exitError, setExitError] = useState('')
  if (identity.local && identity.workspaces.length === 1) {
    return <Navigate to={'/w/' + identity.workspaces[0].id} replace />
  }
  return <Gate><div className="gate-form">
    <p className="eyebrow">Không gian làm việc</p><h2>Chào {identity.user.name}</h2>
    {identity.workspaces.map(w => <Link className="workspace-option" key={w.id} to={'/w/' + w.id}>{w.name}<ChevronRight size={18} aria-hidden="true" /></Link>)}
    {identity.local ? (
      identity.workspaces.length === 0 && <Notice error>Chưa có đơn vị đang hoạt động. Hãy kiểm tra thiết lập ClassHub local.</Notice>
    ) : <>
    <h3>Dùng mã mời</h3>
    <ActionForm grid={false} label={owner ? 'Tạo không gian' : 'Tham gia đơn vị'} action={async data => {
      const response = await send<{ orgId: string }>('/api/v1/accept-invitation', {
        code: value(data, 'code').trim(),
        ...(owner ? { organization: { name: value(data, 'organization'), type: value(data, 'type') }, branch: value(data, 'branch') } : {}),
      })
      await refresh()
      navigate('/w/' + response.orgId)
    }}>
      <Field label="Mã mời"><input name="code" defaultValue={code} pattern="[0-9a-f]{64}" autoComplete="off" required /></Field>
      <label className="check"><input type="checkbox" checked={owner} onChange={event => setOwner(event.target.checked)} /> Mã mời tạo đơn vị mới</label>
      {owner && <>
        <Field label="Tên đơn vị"><input name="organization" maxLength={120} required /></Field>
        <TypeField />
        <Field label="Tên cơ sở đầu tiên"><input name="branch" maxLength={100} placeholder="Cơ sở chính" /></Field>
      </>}
    </ActionForm>
    <Notice error>{exitError}</Notice>
    <button className="text-button" onClick={() => logout().catch(error => setExitError(errorText(error)))}>Đăng xuất</button>
    </>}
  </div></Gate>
}

function WorkspaceView({ identity, logout, refresh }: { identity: Identity; logout: () => Promise<void>; refresh: () => Promise<Identity> }) {
  const { id } = useParams()
  const workspace = identity.workspaces.find(item => item.id === id)
  if (!workspace) return <Navigate to="/" replace />
  return <Shell key={workspace.id} workspace={workspace} identity={identity} logout={logout} refresh={refresh} />
}

function Shell({ workspace, identity, logout, refresh, demo = false }: {
  workspace: Workspace; identity: Identity; logout?: () => Promise<void>; refresh: () => Promise<Identity>; demo?: boolean
}) {
  const base = demo ? '/thu' : '/w/' + workspace.id
  const api = '/api/v1' + (demo ? '/demo' : '') + '/orgs/' + workspace.id
  const owner = workspace.role === 'owner'
  const admin = workspace.role !== 'teacher'
  const props = { workspace, base, api }
  const [error, setError] = useState('')
  const [more, setMore] = useState(false)
  const school = workspace.type === 'school'
  const menu = navigation
    .filter(item => item.role === 'all' || (item.role === 'owner' ? owner : admin))
    .filter(item => !item.mode || item.mode === (school ? 'school' : 'course'))
    .map(item => school && item.path === '/hoc-vien' ? { ...item, label: 'Học sinh' } : item)
  const workspaceLink = demo ? '/truy-cap' : (!identity.local || identity.workspaces.length > 1) ? '/' : ''
  const workspaceLinkLabel = demo ? 'Không gian riêng' : 'Đổi đơn vị'
  const links = (items: typeof navigation, short = false) => items.map(({ path, label, icon: Icon }) =>
    <NavLink key={path} to={base + path} end={!path} onClick={() => setMore(false)}>
      <Icon size={19} aria-hidden="true" />{short && path === '/lop' ? 'Lớp' : short && path === '/lich' ? 'Lịch' : label}
    </NavLink>)
  return <div className="shell">
    <a className="skip" href="#main">Đến nội dung</a>
    <aside className="sidebar">
      <Brand />
      <div className="workspace-label"><small>KHÔNG GIAN</small><strong>{workspace.name}</strong></div>
      <nav aria-label="Menu chính">
        <small className="nav-group">Hằng ngày</small>{links(menu.filter(item => item.role === 'all'))}
        {admin && <><small className="nav-group">Hồ sơ & theo dõi</small>{links(menu.filter(item => ['/tkb', '/khoa-hoc', '/hoc-vien', '/bao-cao'].includes(item.path)))}
          <small className="nav-group">Quản trị</small>{links(menu.filter(item => ['/nhan-su', '/thiet-lap'].includes(item.path)))}</>}
      </nav>
      {workspaceLink && <Link className="switch" to={workspaceLink}>{workspaceLinkLabel} <ChevronRight size={16} aria-hidden="true" /></Link>}
    </aside>
    <div className="shell-body">
      <div className="topbar"><Link className="crumb" to={base}>ClassHub</Link>
        <Link className="topbar-student" to={studentTimetablePath}><CalendarDays size={16} aria-hidden="true" /> Lịch học sinh</Link>
        <span className="user">
        <span className="avatar" aria-hidden="true">{identity.user.name[0]?.toUpperCase()}</span>
        <span className="identity"><strong>{identity.user.name}</strong><small>{demo ? 'Bản dùng thử' : identity.local ? 'Trên máy này' : roles[workspace.role]}</small></span>
        {!identity.local && logout && <button aria-label="Đăng xuất" title="Đăng xuất" onClick={() => logout().catch(error => setError(errorText(error)))}><LogOut size={18} aria-hidden="true" /></button>}
      </span></div>
      <main id="main" className="content">
        {demo && <p className="demo-note">Dữ liệu mẫu · Thay đổi chỉ lưu trong không gian thử của trình duyệt này trong 24 giờ.</p>}
        <Notice error>{error}</Notice>
        <Routes>
          <Route index element={<Dashboard {...props} />} />
          <Route path="lop" element={<Classes {...props} />} />
          <Route path="lop/:classId/*" element={<ClassWorkspace {...props} />} />
          {admin && <Route path="khoa-hoc" element={<Courses {...props} />} />}
          {owner && school && <Route path="tkb" element={<SchoolTimetable {...props} />} />}
          {owner && <Route path="hoc-vien" element={<Students {...props} />} />}
          {admin && <Route path="nhan-su" element={<Staff {...props} local={demo || identity.local} />} />}
          <Route path="lich" element={<Calendar {...props} />} />
          <Route path="buoi/:sessionId" element={<Attendance {...props} />} />
          {admin && <Route path="bao-cao" element={<ReportsPage {...props} />} />}
          {owner && <Route path="thiet-lap" element={<WorkspaceSettings {...props} refresh={refresh} />} />}
          <Route path="*" element={<><Header kicker="ClassHub" title="Không tìm thấy trang" /><Link to={base}>Về tổng quan</Link></>} />
        </Routes>
      </main>
    </div>
    <nav className="mobile-nav" aria-label="Điều hướng trên điện thoại">
      {links(menu.filter(item => item.role === 'all'), true)}
      <button type="button" aria-expanded={more} aria-controls="mobile-more" onClick={() => setMore(open => !open)}>
        <Menu size={19} aria-hidden="true" /> Thêm
      </button>
      <div id="mobile-more" className="mobile-more" hidden={!more}>
        {links(menu.filter(item => item.role !== 'all'))}
        <Link to={studentTimetablePath}>Lịch học sinh</Link>
        {workspaceLink && <Link to={workspaceLink} onClick={() => setMore(false)}>{workspaceLinkLabel}</Link>}
      </div>
    </nav>
  </div>
}

function BootError({ error }: { error: string }) {
  return <main className="boot">
    <Notice error>{error}</Notice>
    <button onClick={() => location.reload()}>Thử lại</button>
  </main>
}

function DemoWorkspace() {
  const [identity, setIdentity] = useState<Identity>()
  const [error, setError] = useState('')
  async function refresh() {
    const open = () => send<Identity>('/api/v1/demo/session', {})
    const next = await (navigator.locks ? navigator.locks.request('afyllx-classhub-demo', open) : open())
    setIdentity(next)
    return next
  }
  useEffect(() => {
    refresh().catch(error => setError(errorText(error)))
  }, [])
  if (error) return <BootError error={error} />
  if (!identity) return <main className="boot" role="status">Đang mở ClassHub…</main>
  return <Shell key={identity.workspaces[0].id} workspace={identity.workspaces[0]} identity={identity} refresh={refresh} demo />
}

function App() {
  const navigate = useNavigate()
  const [identity, setIdentity] = useState<Identity | null | undefined>()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  async function refresh() {
    const { data } = await request<{ data: Identity }>('/api/v1/me')
    setIdentity(data)
    return data
  }
  useEffect(() => {
    refresh().catch(error => {
      if (error.status !== 401) setError(errorText(error))
      setIdentity(null)
    })
  }, [])
  if (identity === undefined) return <main className="boot" role="status">Đang mở ClassHub…</main>
  if (error) return <BootError error={error} />
  if (!identity) {
    const path = location.pathname.slice(basePath.length).replace(/\/+$/, '')
    if (basePath && path !== '/truy-cap' && !path.startsWith('/w/')) return <Navigate to="/thu" replace />
    return <Login onLogin={(next, invite) => {
        setError('')
        setIdentity(next)
        setCode(invite)
        if (invite || !next.workspaces[0]) navigate('/')
        else if (!location.pathname.startsWith(basePath + '/w/')) navigate('/w/' + next.workspaces[0].id)
      }} />
  }
  async function logout() {
    await request('/api/auth/sign-out', 'POST')
    setIdentity(null)
    setCode('')
    navigate('/')
  }
  return <Routes>
    <Route path="/" element={<WorkspacePicker identity={identity} code={code} refresh={refresh} logout={logout} />} />
    <Route path="/w/:id/*" element={<WorkspaceView identity={identity} refresh={refresh} logout={logout} />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
}
const router = createBrowserRouter([
  ...[studentTimetablePath, legacyStudentTimetablePath].map(path =>
    ({ path, lazy: async () => ({ Component: (await import('./student-timetable')).StudentTimetable }) })),
  { path: '/gv/*', lazy: async () => ({ Component: (await import('./teacher')).TeacherApp }) },
  ...(basePath ? [{ path: '/thu/*', element: <DemoWorkspace /> }] : []),
  { path: '*', element: <App /> },
], { basename: basePath || '/' })
createRoot(document.getElementById('root')!).render(<RouterProvider router={router} />)
