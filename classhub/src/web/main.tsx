import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Link, Navigate, NavLink, Route, RouterProvider, Routes, useNavigate, useParams } from 'react-router-dom'
import {
  BookOpen, CalendarDays, ChartNoAxesColumn, ChevronRight, ClipboardCheck, GraduationCap, House,
  Layers3, LogOut, Settings, UsersRound,
} from 'lucide-react'
import '@fontsource-variable/plus-jakarta-sans'
import './styles.css'
import {
  ActionForm, Badge, Empty, Field, Header, LoadView, Notice, Panel, basePath, errorText, formatClock, formatDay,
  request, roles, send, useLoad, value, type Workspace,
} from './ui'
import { Classes, ClassWorkspace, Courses, Staff, Students, TypeField, WorkspaceSettings } from './operations'
import { Attendance, Calendar, Reports, type Lesson } from './scheduling'

type User = { name: string; email: string }
type Identity = { user: User; workspaces: Workspace[]; local: boolean }
const navigation = [
  { path: '', label: 'Tổng quan', icon: House, role: 'all' },
  { path: '/lop', label: 'Lớp học', icon: Layers3, role: 'all' },
  { path: '/khoa-hoc', label: 'Khóa học', icon: BookOpen, role: 'admin' },
  { path: '/hoc-vien', label: 'Học viên', icon: GraduationCap, role: 'owner' },
  { path: '/nhan-su', label: 'Nhân sự', icon: UsersRound, role: 'admin' },
  { path: '/lich', label: 'Lịch học', icon: CalendarDays, role: 'all' },
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

function Dashboard({ workspace, api, base }: { workspace: Workspace; api: string; base: string }) {
  type Data = {
    stats: Record<string, number>; sessions: Lesson[]; unassigned: { id: string; name: string }[]; date: string
  }
  const load = useLoad<{ data: Data }>(api + '/dashboard')
  return <>
    <Header kicker="Không gian vận hành" title="Tổng quan" description={workspace.name} />
    <LoadView load={load}>{({ data }) => <>
      <div className="dashboard-band">
        <div><p className="eyebrow">Nhịp vận hành · {formatDay(data.date)}</p>
          <h2>{workspace.role === 'teacher' ? 'Lịch dạy của bạn' : 'Hoạt động hôm nay'}</h2>
          <p>{data.stats.today_sessions} buổi hôm nay · {data.stats.pending} buổi đã qua giờ và chờ chốt</p></div>
        <Link className="button light" to={base + '/lich'}>Mở lịch học <ChevronRight size={16} aria-hidden="true" /></Link>
      </div>
      <div className="stats">
        {[
          { key: 'active_classes', label: 'Lớp đang học', Icon: Layers3 },
          { key: 'enrolled_students', label: 'Học viên đang ghi danh', Icon: GraduationCap },
          { key: workspace.role === 'teacher' ? 'today_sessions' : 'teachers',
            label: workspace.role === 'teacher' ? 'Buổi dạy hôm nay' : 'Giáo viên được phân công', Icon: UsersRound },
          { key: 'pending', label: 'Buổi cần chốt điểm danh', Icon: ClipboardCheck },
        ].map(({ key, label, Icon }) => <div className="stat panel" key={key}>
          <Icon size={20} aria-hidden="true" /><strong>{data.stats[key]}</strong><span>{label}</span>
        </div>)}
      </div>
      <div className="dashboard-grid">
        <Panel title={workspace.role === 'teacher' ? 'Buổi dạy sắp tới' : 'Buổi học sắp tới'}>
          {data.sessions.length ? <div className="list">{data.sessions.map(lesson =>
            <Link className="row-link" to={base + '/buoi/' + lesson.id} key={lesson.id}>
              <div><strong>{lesson.class_name}</strong><small>{formatDay(lesson.lesson_date)} · {formatClock(lesson.starts_at)}</small></div>
              <Badge status={lesson.attendance_state} /><ChevronRight size={18} aria-hidden="true" />
            </Link>)}</div> : <Empty>Chưa có buổi học sắp tới.</Empty>}
        </Panel>
        <Panel title="Thao tác nhanh">
          <div className="list">
            <Link className="row-link" to={base + '/lop'}><Layers3 size={18} aria-hidden="true" /> {workspace.role === 'teacher' ? 'Lớp được phân công' : 'Quản lý lớp'} <ChevronRight size={18} aria-hidden="true" /></Link>
            <Link className="row-link" to={base + '/lich'}><CalendarDays size={18} aria-hidden="true" /> Xem lịch <ChevronRight size={18} aria-hidden="true" /></Link>
            {workspace.role !== 'teacher' && <Link className="row-link" to={base + '/bao-cao'}><ChartNoAxesColumn size={18} aria-hidden="true" /> Báo cáo chuyên cần <ChevronRight size={18} aria-hidden="true" /></Link>}
          </div>
          {data.unassigned.map(item => <Link className="warning-link" key={item.id} to={base + '/lop/' + item.id}>
            {item.name} cần phân công giáo viên
          </Link>)}
        </Panel>
      </div>
    </>}</LoadView>
  </>
}
function WorkspaceView({ identity, logout, refresh }: { identity: Identity; logout: () => Promise<void>; refresh: () => Promise<Identity> }) {
  const { id } = useParams()
  const workspace = identity.workspaces.find(item => item.id === id)
  if (!workspace) return <Navigate to="/" replace />
  return <Shell key={workspace.id} workspace={workspace} identity={identity} logout={logout} refresh={refresh} />
}

function Shell({ workspace, identity, logout, refresh }: {
  workspace: Workspace; identity: Identity; logout: () => Promise<void>; refresh: () => Promise<Identity>
}) {
  const base = '/w/' + workspace.id
  const api = '/api/v1/orgs/' + workspace.id
  const owner = workspace.role === 'owner'
  const admin = workspace.role !== 'teacher'
  const props = { workspace, base, api }
  const [error, setError] = useState('')
  return <div className="shell">
    <a className="skip" href="#main">Đến nội dung</a>
    <aside className="sidebar">
      <Brand />
      <div className="workspace-label"><small>KHÔNG GIAN</small><strong>{workspace.name}</strong></div>
      <nav aria-label="Menu chính">
        {navigation.filter(item => item.role === 'all' || (item.role === 'owner' ? owner : admin)).map(({ path, label, icon: Icon }) =>
          <NavLink key={path} to={base + path} end={!path}><Icon size={19} aria-hidden="true" />{label}</NavLink>)}
      </nav>
      {(!identity.local || identity.workspaces.length > 1) && <Link className="switch" to="/">Đổi đơn vị <ChevronRight size={16} aria-hidden="true" /></Link>}
    </aside>
    <div className="shell-body">
      <div className="topbar"><Link className="crumb" to={base}>ClassHub</Link><span className="user">
        <span className="avatar" aria-hidden="true">{identity.user.name[0]?.toUpperCase()}</span>
        <span className="identity"><strong>{identity.user.name}</strong><small>{identity.local ? 'Trên máy này' : roles[workspace.role]}</small></span>
        {!identity.local && <button aria-label="Đăng xuất" title="Đăng xuất" onClick={() => logout().catch(error => setError(errorText(error)))}><LogOut size={18} aria-hidden="true" /></button>}
      </span></div>
      <main id="main" className="content">
        <Notice error>{error}</Notice>
        <Routes>
          <Route index element={<Dashboard {...props} />} />
          <Route path="lop" element={<Classes {...props} />} />
          <Route path="lop/:classId/*" element={<ClassWorkspace {...props} />} />
          {admin && <Route path="khoa-hoc" element={<Courses {...props} />} />}
          {owner && <Route path="hoc-vien" element={<Students {...props} />} />}
          {admin && <Route path="nhan-su" element={<Staff {...props} local={identity.local} />} />}
          <Route path="lich" element={<Calendar {...props} />} />
          <Route path="buoi/:sessionId" element={<Attendance {...props} />} />
          {admin && <Route path="bao-cao" element={<Reports {...props} />} />}
          {owner && <Route path="thiet-lap" element={<WorkspaceSettings {...props} refresh={refresh} />} />}
          <Route path="*" element={<><Header kicker="ClassHub" title="Không tìm thấy trang" /><Link to={base}>Về tổng quan</Link></>} />
        </Routes>
      </main>
    </div>
  </div>
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
  if (error) return <main className="boot">
    <Notice error>{error}</Notice>
    <button onClick={() => location.reload()}>Thử lại</button>
  </main>
  if (!identity) return <Login onLogin={(next, invite) => {
      setError('')
      setIdentity(next)
      setCode(invite)
      if (invite || !next.workspaces[0]) navigate('/')
      else if (!location.pathname.startsWith(basePath + '/w/')) navigate('/w/' + next.workspaces[0].id)
    }} />
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
const router = createBrowserRouter([{ path: '*', element: <App /> }], { basename: basePath || '/' })
createRoot(document.getElementById('root')!).render(<RouterProvider router={router} />)
