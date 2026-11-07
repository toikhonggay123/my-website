import { useEffect, useState, type CSSProperties } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import { Building2, ClipboardList, Copy, Crown, Lock, RotateCcw, ShieldOff, Unlock, UserPlus, Users } from 'lucide-react'
import { api, base, formatTime, message, roleName, type Me } from './api'
import { Problem, field, useForm } from './ui'

type Row = { id: string; email: string; name: string; status: 'active' | 'disabled'; platform_role: Me['account']['platform_role']
  last_login_at: number | null; mfa_enabled: number; has_password: number }
type Org = { id: string; name: string; kind: string; status: string; created_at: number; members: number }
type Event = { id: string; action: string; target_id: string; details: string; ip: string; occurred_at: number; actor_name: string | null; actor_email: string | null }
const stagger = (index: number) => ({ '--i': index }) as CSSProperties
const linkFor = (code: string) => location.origin + base + '/dat-mat-khau#' + code
const actions: Record<string, string> = {
  'login.password': 'Đăng nhập (mật khẩu)', 'login.second_factor': 'Qua bước hai lớp', 'login.failed': 'Đăng nhập sai',
  'login.second_factor_failed': 'Sai mã hai lớp', 'mfa.enabled': 'Bật xác thực hai lớp', 'mfa.recovery_codes_regenerated': 'Tạo lại mã khôi phục',
  'mfa.reset_by_founder': 'Founder đặt lại hai lớp', 'password.changed': 'Đổi mật khẩu', 'password.reset': 'Đặt lại mật khẩu',
  'account.activated': 'Kích hoạt tài khoản', 'account.created': 'Tạo tài khoản', 'account.updated': 'Sửa tài khoản',
  'link.created': 'Tạo link một lần', 'organization.created': 'Tạo đơn vị', 'session.revoked': 'Đăng xuất thiết bị',
  'account.bootstrapped': 'Tạo Founder đầu tiên',
}

function OneTimeLink({ code, expiresAt }: { code: string; expiresAt: number }) {
  const [copied, setCopied] = useState(false)
  const link = linkFor(code)
  return <div className="ac-link-box edu-rise" role="status">
    <p>Link dùng một lần, hết hạn {formatTime(expiresAt)}. Gửi riêng cho đúng người.</p>
    <label className="ac-form"><span className="sr-only">Link một lần</span><input readOnly value={link} aria-label="Link một lần" onFocus={event => event.target.select()} /></label>
    <button type="button" className="edu-press" onClick={() => navigator.clipboard?.writeText(link).then(() => setCopied(true), () => undefined)}>
      <Copy size={15} aria-hidden="true" /> {copied ? 'Đã sao chép' : 'Sao chép link'}</button>
  </div>
}

function AccountRow({ row, me, reload, index }: { row: Row; me: Me; reload: () => void; index: number }) {
  const actor = me.account.platform_role!
  const self = row.id === me.account.id
  const manage = actor === 'founder' || !row.platform_role
  const [link, setLink] = useState<{ code: string; expiresAt: number }>()
  const [error, setError] = useState('')
  async function run(task: () => Promise<unknown>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return
    setError('')
    try { await task(); reload() } catch (failure) { setError(message(failure)) }
  }
  return <li className="ac-account edu-rise" style={stagger(Math.min(index, 10))}>
    <details>
      <summary>
        <span className={'ac-avatar' + (row.platform_role === 'founder' ? ' is-founder' : '')} aria-hidden="true">{row.name[0]?.toUpperCase()}</span>
        <span className="ac-account-main"><strong>{row.name}{self ? ' (bạn)' : ''}</strong><small>{row.email}</small></span>
        {row.platform_role && <span className={'ac-role is-' + row.platform_role}>{row.platform_role === 'founder' && <Crown size={12} aria-hidden="true" />} {roleName[row.platform_role]}</span>}
        {row.status === 'disabled' && <span className="ac-pill is-off">Đã khóa</span>}
        {!row.has_password && <span className="ac-pill">Chưa kích hoạt</span>}
      </summary>
      <div className="ac-account-body">
        <p className="edu-muted ac-small">Hai lớp: {row.mfa_enabled ? 'đang bật' : 'chưa bật'} · Đăng nhập gần nhất: {row.last_login_at ? formatTime(row.last_login_at) : 'chưa'}</p>
        <Problem>{error}</Problem>
        {actor === 'founder' && !self && <label className="ac-form ac-inline">Vai trò hệ thống
          <select value={row.platform_role ?? ''} onChange={event => run(() => api('/api/admin/accounts/' + row.id, 'PATCH',
            { platform_role: event.target.value || null }), 'Đổi vai trò hệ thống của ' + row.name + '? Tài khoản sẽ phải đăng nhập lại.')}>
            <option value="">Không có</option><option value="support">Hỗ trợ</option>
            <option value="platform_admin">Quản trị hệ thống</option><option value="founder">AFYLLX Account Founder</option>
          </select></label>}
        {manage && !self && <div className="ac-row">
          <button type="button" className="edu-press" onClick={() => run(async () => setLink(await api('/api/admin/accounts/' + row.id + '/link', 'POST', {})))}>
            <RotateCcw size={15} aria-hidden="true" /> {row.has_password ? 'Link đặt lại mật khẩu' : 'Link kích hoạt mới'}</button>
          {actor !== 'support' && <button type="button" className="edu-press" onClick={() => run(() => api('/api/admin/accounts/' + row.id, 'PATCH',
            { status: row.status === 'active' ? 'disabled' : 'active' }), row.status === 'active' ? 'Khóa ' + row.name + '? Mọi thiết bị sẽ bị đăng xuất.' : undefined)}>
            {row.status === 'active' ? <><Lock size={15} aria-hidden="true" /> Khóa tài khoản</> : <><Unlock size={15} aria-hidden="true" /> Mở khóa</>}</button>}
          {actor === 'founder' && Boolean(row.mfa_enabled) && <button type="button" className="edu-press" onClick={() => run(() =>
            api('/api/admin/accounts/' + row.id + '/second-factor/reset', 'POST', {}), 'Tắt xác thực hai lớp của ' + row.name + '? Họ sẽ phải thiết lập lại.')}>
            <ShieldOff size={15} aria-hidden="true" /> Đặt lại hai lớp</button>}
        </div>}
        {link && <OneTimeLink {...link} />}
      </div>
    </details>
  </li>
}

function Accounts({ me, changed }: { me: Me; changed: () => void }) {
  const actor = me.account.platform_role!
  const [q, setQ] = useState('')
  const [list, setList] = useState<Row[]>()
  const [created, setCreated] = useState<{ code: string; expiresAt: number }>()
  const load = () => { changed(); return api<Row[]>('/api/admin/accounts?' + new URLSearchParams({ q })).then(setList, () => setList([])) }
  useEffect(() => { load() }, [q])
  const form = useForm(async data => {
    const response = await api<{ code: string; expiresAt: number }>('/api/admin/accounts', 'POST', {
      email: field(data, 'email'), name: field(data, 'name'), platform_role: field(data, 'platform_role') || null,
    })
    setCreated(response)
    load()
  })
  return <>
    {actor !== 'support' && <section className="ac-panel edu-card edu-rise" aria-labelledby="ac-new">
      <h2 id="ac-new"><UserPlus size={18} aria-hidden="true" /> Tạo tài khoản</h2>
      <form className="ac-form ac-grid" onSubmit={form.submit} key={created?.code}>
        <label>Họ và tên<input name="name" required maxLength={100} /></label>
        <label>Email<input type="email" name="email" required maxLength={254} /></label>
        {actor === 'founder' && <label>Vai trò hệ thống<select name="platform_role" defaultValue="">
          <option value="">Không có (người dùng sản phẩm)</option><option value="support">Hỗ trợ</option>
          <option value="platform_admin">Quản trị hệ thống</option><option value="founder">AFYLLX Account Founder</option></select></label>}
        <Problem>{form.error}</Problem>
        <button className="edu-primary edu-press" disabled={form.busy}>Tạo và lấy link kích hoạt</button>
      </form>
      {created && <OneTimeLink {...created} />}
    </section>}
    <section className="ac-panel edu-card edu-rise" style={stagger(1)} aria-labelledby="ac-accounts">
      <h2 id="ac-accounts"><Users size={18} aria-hidden="true" /> Tài khoản</h2>
      <label className="ac-form"><span className="sr-only">Tìm tài khoản</span>
        <input type="search" placeholder="Tìm theo tên hoặc email" value={q} onChange={event => setQ(event.target.value)} /></label>
      {!list ? <span className="edu-skeleton ac-line-skeleton" /> : <ul className="ac-accounts">
        {list.map((row, index) => <AccountRow key={row.id} row={row} me={me} reload={load} index={index} />)}</ul>}
    </section>
  </>
}

function Organizations({ me, changed }: { me: Me; changed: () => void }) {
  const [list, setList] = useState<Org[]>()
  const load = () => { changed(); return api<Org[]>('/api/admin/organizations').then(setList, () => setList([])) }
  useEffect(() => { load() }, [])
  const form = useForm(async data => {
    await api('/api/admin/organizations', 'POST', { name: field(data, 'name'), kind: field(data, 'kind') })
    load()
  })
  return <section className="ac-panel edu-card edu-rise" aria-labelledby="ac-orgs-admin">
    <h2 id="ac-orgs-admin"><Building2 size={18} aria-hidden="true" /> Đơn vị</h2>
    <p className="edu-muted ac-small">Danh sách trường, trung tâm dùng sản phẩm AFYLLX. Việc nối với từng sản phẩm (ClassHub, MealCheck) làm ở bước tiếp theo.</p>
    {me.account.platform_role !== 'support' && <form className="ac-form ac-grid" onSubmit={form.submit}>
      <label>Tên đơn vị<input name="name" required maxLength={120} /></label>
      <label>Loại<select name="kind" defaultValue="school"><option value="school">Trường học</option><option value="center">Trung tâm</option><option value="other">Khác</option></select></label>
      <Problem>{form.error}</Problem>
      <button className="edu-press" disabled={form.busy}>Thêm đơn vị</button>
    </form>}
    {!list ? <span className="edu-skeleton ac-line-skeleton" /> : list.length ? <ul className="ac-list">{list.map(org => <li key={org.id}>
      <span><strong>{org.name}</strong><small>{org.kind === 'school' ? 'Trường học' : org.kind === 'center' ? 'Trung tâm' : 'Khác'} · {org.members} thành viên</small></span>
      <span className="ac-pill">{org.status === 'active' ? 'Hoạt động' : 'Tạm dừng'}</span></li>)}</ul> : <p className="edu-muted">Chưa có đơn vị.</p>}
  </section>
}

function Audit() {
  const [page, setPage] = useState(1)
  const [data, setData] = useState<{ data: Event[]; pagination: { page: number; hasMore: boolean } }>()
  useEffect(() => {
    fetch(base + '/api/admin/audit?page=' + page, { credentials: 'same-origin', cache: 'no-store' })
      .then(response => response.json() as Promise<{ data: Event[]; pagination: { page: number; hasMore: boolean } }>).then(setData, () => undefined)
  }, [page])
  return <section className="ac-panel edu-card edu-rise" aria-labelledby="ac-audit">
    <h2 id="ac-audit"><ClipboardList size={18} aria-hidden="true" /> Nhật ký</h2>
    {!data ? <span className="edu-skeleton ac-line-skeleton" /> : <ul className="ac-list ac-audit">{data.data.map(event => <li key={event.id}>
      <span><strong>{actions[event.action] ?? event.action}</strong>
        <small>{formatTime(event.occurred_at)} · {event.actor_name ?? 'Không rõ'}{event.action === 'login.failed' ? ' · ' + event.target_id : ''}{event.ip ? ' · ' + event.ip : ''}</small></span>
    </li>)}</ul>}
    {data && (page > 1 || data.pagination.hasMore) && <div className="ac-row">
      <button type="button" disabled={page === 1} onClick={() => setPage(page - 1)}>Trước</button>
      <span className="edu-muted">Trang {page}</span>
      <button type="button" disabled={!data.pagination.hasMore} onClick={() => setPage(page + 1)}>Sau</button>
    </div>}
  </section>
}

export function Admin({ me }: { me: Me }) {
  const [summary, setSummary] = useState<{ accounts: number; platform: number; organizations: number; failed_today: number }>()
  const loadSummary = () => { api<typeof summary>('/api/admin/summary').then(setSummary, () => undefined) }
  useEffect(loadSummary, [])
  const tiles = summary ? [['Tài khoản', summary.accounts], ['Vai trò hệ thống', summary.platform], ['Đơn vị', summary.organizations],
    ['Đăng nhập sai 24 giờ', summary.failed_today]] as const : []
  return <>
    <div className="ac-tiles">{tiles.map(([label, value], index) => <div key={label} className="ac-tile edu-card edu-rise" style={stagger(index)}>
      <strong>{value}</strong><span>{label}</span></div>)}</div>
    <nav className="ac-subtabs" aria-label="Quản trị">
      <NavLink to="/quan-tri" end>Tài khoản</NavLink>
      <NavLink to="/quan-tri/don-vi">Đơn vị</NavLink>
      {me.account.platform_role !== 'support' && <NavLink to="/quan-tri/nhat-ky">Nhật ký</NavLink>}
    </nav>
    <Routes>
      <Route index element={<Accounts me={me} changed={loadSummary} />} />
      <Route path="don-vi" element={<Organizations me={me} changed={loadSummary} />} />
      <Route path="nhat-ky" element={<Audit />} />
    </Routes>
  </>
}
