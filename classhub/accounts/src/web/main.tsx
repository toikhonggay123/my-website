import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Link, Navigate, NavLink, Route, RouterProvider, Routes, useLocation, useNavigate } from 'react-router-dom'
import QRCode from 'qrcode'
import {
  Crown, Download, ExternalLink, GraduationCap, House, KeyRound, LayoutGrid, LogOut, MonitorSmartphone, Printer, ShieldCheck, Smartphone,
  Sparkles, Users, UtensilsCrossed,
} from 'lucide-react'
import '@fontsource/be-vietnam-pro/latin-400.css'
import '@fontsource/be-vietnam-pro/latin-700.css'
import '@fontsource/be-vietnam-pro/latin-800.css'
import '@fontsource/be-vietnam-pro/vietnamese-400.css'
import '@fontsource/be-vietnam-pro/vietnamese-700.css'
import '@fontsource/be-vietnam-pro/vietnamese-800.css'
import './account.css'
import '../../../src/web/edu.css'
import { ApiError, api, base, formatTime, message, roleName, type Me } from './api'
import { Admin } from './admin'
import { Problem, field, useForm } from './ui'

const stagger = (index: number) => ({ '--i': index }) as CSSProperties

export function Mark({ size = 40 }: { size?: number }) {
  return <img className="ac-mark" src={base + '/afyllx-mark-192.png'} width={size} height={size} alt="" aria-hidden="true" />
}
function Brand() {
  return <Link to="/" className="ac-brand"><Mark /><span><strong>AFYLLX Account</strong><small>Một tài khoản cho mọi sản phẩm</small></span></Link>
}
function Gate({ title, eyebrow, children }: { title: string; eyebrow?: string; children: ReactNode }) {
  return <div className="edu ac ac-gate">
    <header className="ac-top"><Brand /></header>
    <main className="ac-gate-main">
      <section className="ac-gate-card edu-card edu-page">
        {eyebrow && <p className="edu-eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {children}
      </section>
    </main>
  </div>
}
/**
 * Where to go back after sign-in: a path on this site, or an https page on afyllx.com or one of its subdomains
 * (edu.afyllx.com/classhub, /mealcheck…). Any other address is ignored so the link cannot send people elsewhere.
 */
function returnPath() {
  const next = new URLSearchParams(location.search).get('tiep')
  if (!next) return null
  if (next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\')) return next
  try {
    const url = new URL(next)
    const host = url.hostname.toLowerCase()
    return url.protocol === 'https:' && !url.username && !url.password && (host === 'afyllx.com' || host.endsWith('.afyllx.com'))
      ? url.href : null
  } catch { return null }
}

/* ------------------------------------------------------------------ Sign-in steps */

function Login({ done }: { done: () => void }) {
  const form = useForm(async data => {
    await api('/api/login', 'POST', { email: field(data, 'email'), password: field(data, 'password') })
    done()
  })
  return <Gate title="Đăng nhập" eyebrow="AFYLLX Account">
    <p className="edu-muted">Một tài khoản để vào ClassHub, MealCheck và các sản phẩm AFYLLX.</p>
    <form className="ac-form" onSubmit={form.submit}>
      <label>Email<input type="email" name="email" autoComplete="username" required maxLength={254} autoFocus /></label>
      <label>Mật khẩu<input type="password" name="password" autoComplete="current-password" required maxLength={128} /></label>
      <Problem>{form.error}</Problem>
      <button className="edu-primary edu-press" disabled={form.busy}>{form.busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
    </form>
    <p className="edu-muted ac-small"><KeyRound size={15} aria-hidden="true" /> Quên mật khẩu? Nhờ quản trị AFYLLX tạo link đặt lại.</p>
  </Gate>
}

function SecondFactor({ me, done, signOut }: { me: Pick<Me, 'account'>; done: () => void; signOut: () => void }) {
  const [recovery, setRecovery] = useState(false)
  const form = useForm(async data => {
    const response = await api<{ recovery?: boolean }>('/api/mfa/verify', 'POST', { code: field(data, 'code') })
    if (response.recovery) sessionStorage.setItem('ac-recovery-used', '1')
    done()
  })
  return <Gate title="Xác thực hai lớp" eyebrow={me.account.email}>
    <p className="edu-muted">{recovery ? 'Nhập một mã khôi phục bạn đã lưu. Mỗi mã chỉ dùng được một lần.'
      : 'Mở ứng dụng xác thực trên điện thoại và nhập mã 6 số của AFYLLX Account.'}</p>
    <form className="ac-form" onSubmit={form.submit} key={String(recovery)}>
      {recovery ? <label>Mã khôi phục<input name="code" autoComplete="off" placeholder="abcd-2345" required maxLength={20} autoFocus /></label>
        : <label>Mã 6 số<input name="code" className="ac-code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6}
          required autoFocus placeholder="••••••" /></label>}
      <Problem>{form.error}</Problem>
      <button className="edu-primary edu-press" disabled={form.busy}>{form.busy ? 'Đang kiểm tra…' : 'Xác nhận'}</button>
    </form>
    <div className="ac-links">
      <button type="button" className="text-button" onClick={() => setRecovery(!recovery)}>{recovery ? 'Dùng mã 6 số' : 'Mất điện thoại? Dùng mã khôi phục'}</button>
      <button type="button" className="text-button" onClick={signOut}>Đăng xuất</button>
    </div>
  </Gate>
}

export function RecoveryCodes({ codes, done, label = 'Tôi đã cất kỹ các mã này' }: { codes: string[]; done: () => void; label?: string }) {
  const [saved, setSaved] = useState(false)
  const download = () => {
    const blob = new Blob(['AFYLLX Account · Mã khôi phục\nMỗi mã dùng một lần khi không có điện thoại.\n\n' + codes.join('\n') + '\n'], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    Object.assign(document.createElement('a'), { href: url, download: 'afyllx-account-ma-khoi-phuc.txt' }).click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <div className="ac-recovery edu-rise">
    <p><strong>10 mã khôi phục.</strong> Dùng khi mất điện thoại có ứng dụng xác thực. Chỉ hiện một lần; hãy in hoặc tải về và cất ở nơi an toàn.</p>
    <ol className="ac-codes" aria-label="Mã khôi phục">{codes.map((code, index) => <li key={code} className="edu-rise" style={stagger(index)}><code>{code}</code></li>)}</ol>
    <div className="ac-row">
      <button type="button" className="edu-press" onClick={download}><Download size={16} aria-hidden="true" /> Tải về</button>
      <button type="button" className="edu-press" onClick={() => window.print()}><Printer size={16} aria-hidden="true" /> In</button>
    </div>
    <label className="ac-check"><input type="checkbox" checked={saved} onChange={event => setSaved(event.target.checked)} /> {label}</label>
    <button type="button" className="edu-primary edu-press" disabled={!saved} onClick={done}>Tiếp tục</button>
  </div>
}

export function Enroll({ email, done, cancel }: { email: string; done: () => void; cancel?: () => void }) {
  const [setup, setSetup] = useState<{ secret: string; uri: string; qr: string }>()
  const [codes, setCodes] = useState<string[]>()
  const [error, setError] = useState('')
  useEffect(() => {
    api<{ secret: string; uri: string }>('/api/mfa/enroll', 'POST', {})
      .then(async response => setSetup({ ...response, qr: await QRCode.toString(response.uri, { type: 'svg', margin: 1, width: 196, errorCorrectionLevel: 'M' }) }))
      .catch(failure => setError(message(failure)))
  }, [])
  const form = useForm(async data => {
    const response = await api<{ recoveryCodes: string[] }>('/api/mfa/confirm', 'POST', { code: field(data, 'code') })
    setCodes(response.recoveryCodes)
  })
  if (codes) return <RecoveryCodes codes={codes} done={done} />
  return <div className="ac-enroll">
    <ol className="ac-steps">
      <li className="edu-rise" style={stagger(0)}><Smartphone size={18} aria-hidden="true" /> Cài một ứng dụng xác thực: Google Authenticator, Microsoft Authenticator hoặc ứng dụng tương tự.</li>
      <li className="edu-rise" style={stagger(1)}><ShieldCheck size={18} aria-hidden="true" /> Quét mã QR, hoặc nhập khóa bên dưới, rồi nhập mã 6 số ứng dụng hiện ra.</li>
    </ol>
    <Problem>{error}</Problem>
    {setup ? <div className="ac-qr-box edu-rise" style={stagger(2)}>
      <div className="ac-qr" role="img" aria-label={'Mã QR thiết lập cho ' + email} dangerouslySetInnerHTML={{ __html: setup.qr }} />
      <div className="ac-secret">
        <span className="edu-muted">Khóa thiết lập</span>
        <code>{setup.secret.match(/.{1,4}/g)!.join(' ')}</code>
        <a className="ac-small" href={setup.uri}><ExternalLink size={14} aria-hidden="true" /> Mở bằng ứng dụng trên máy này</a>
      </div>
    </div> : !error && <span className="edu-skeleton ac-qr-skeleton" />}
    <form className="ac-form" onSubmit={form.submit}>
      <label>Mã 6 số từ ứng dụng<input name="code" className="ac-code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required placeholder="••••••" /></label>
      <Problem>{form.error}</Problem>
      <button className="edu-primary edu-press" disabled={form.busy || !setup}>{form.busy ? 'Đang kiểm tra…' : 'Bật xác thực hai lớp'}</button>
      {cancel && <button type="button" className="text-button" onClick={cancel}>Để sau</button>}
    </form>
  </div>
}

function SetPassword() {
  const location = useLocation()
  const navigate = useNavigate()
  const [code] = useState(() => /^#[0-9a-f]{64}$/.test(location.hash) ? location.hash.slice(1) : '')
  useEffect(() => { if (location.hash) navigate(location.pathname, { replace: true }) }, [])
  const form = useForm(async data => {
    const next = field(data, 'password')
    if (next !== field(data, 'confirm')) throw new Error('Hai lần nhập mật khẩu chưa khớp.')
    const { email } = await api<{ email: string }>('/api/password/set', 'POST', { code, password: next })
    await api('/api/login', 'POST', { email, password: next })
    navigate('/', { replace: true })
  })
  if (!code) return <Gate title="Link chưa đúng"><p>Link không đầy đủ hoặc đã được dùng. Hãy nhờ quản trị AFYLLX tạo link mới.</p>
    <Link className="button" to="/">Về trang đăng nhập</Link></Gate>
  return <Gate title="Đặt mật khẩu" eyebrow="AFYLLX Account">
    <p className="edu-muted">Mật khẩu dùng chung cho mọi sản phẩm AFYLLX. Sau khi đặt, các thiết bị đang đăng nhập tài khoản này sẽ phải đăng nhập lại.</p>
    <form className="ac-form" onSubmit={form.submit}>
      <label>Mật khẩu mới<input type="password" name="password" autoComplete="new-password" minLength={12} maxLength={128} required aria-describedby="ac-hint" /></label>
      <small id="ac-hint" className="edu-muted">Ít nhất 12 ký tự. Nên dùng một câu dễ nhớ.</small>
      <label>Nhập lại mật khẩu mới<input type="password" name="confirm" autoComplete="new-password" minLength={12} maxLength={128} required /></label>
      <Problem>{form.error}</Problem>
      <button className="edu-primary edu-press" disabled={form.busy}>{form.busy ? 'Đang lưu…' : 'Lưu và đăng nhập'}</button>
    </form>
  </Gate>
}

/* ------------------------------------------------------------------ Signed in */

function Overview({ me }: { me: Me }) {
  return <>
    <section aria-labelledby="ac-products">
      <h2 id="ac-products">Sản phẩm của bạn</h2>
      <ul className="ac-products">{me.products.map((product, index) => <li key={product.id} className="edu-rise" style={stagger(index + 1)}>
        <a className="ac-product edu-card edu-press" href={product.path}>
          <span className={'edu-icon-tile ' + (index % 2 ? 'is-teal' : 'is-primary')}>
            {product.id === 'classhub' ? <GraduationCap size={22} aria-hidden="true" /> : product.id === 'mealcheck'
              ? <UtensilsCrossed size={22} aria-hidden="true" /> : <House size={22} aria-hidden="true" />}</span>
          <span className="ac-product-text"><strong>{product.name}</strong><small>{product.description}</small></span>
          <span className="ac-pill">{product.access}</span>
        </a></li>)}</ul>
      {me.products.length <= 1 && <p className="edu-muted ac-small">Chưa được cấp quyền vào sản phẩm nào. Quyền theo từng trường sẽ được nối ở bước tiếp theo.</p>}
    </section>
    {me.memberships.length > 0 && <section aria-labelledby="ac-orgs"><h2 id="ac-orgs">Đơn vị</h2>
      <ul className="ac-list">{me.memberships.map(item => <li key={item.org_id}><strong>{item.name}</strong><span className="ac-pill">{item.role}</span></li>)}</ul></section>}
  </>
}

function Security({ me, refresh }: { me: Me; refresh: () => void }) {
  const [sessions, setSessions] = useState<{ id: string; created_at: number; last_seen_at: number; ip: string; user_agent: string; current: boolean }[]>()
  const [enrolling, setEnrolling] = useState(false)
  const [codes, setCodes] = useState<string[]>()
  const [notice, setNotice] = useState('')
  const load = () => api<typeof sessions>('/api/sessions').then(setSessions, () => setSessions([]))
  useEffect(() => { load() }, [])
  const change = useForm(async data => {
    if (field(data, 'next') !== field(data, 'confirm')) throw new Error('Hai lần nhập mật khẩu mới chưa khớp.')
    await api('/api/password/change', 'POST', { current: field(data, 'current'), next: field(data, 'next') })
    setNotice('Đã đổi mật khẩu. Các thiết bị khác đã được đăng xuất.')
    load()
  })
  const regenerate = useForm(async data => {
    const response = await api<{ recoveryCodes: string[] }>('/api/recovery-codes', 'POST', { password: field(data, 'password') })
    setCodes(response.recoveryCodes)
  })
  return <>
    {notice && <p className="ac-notice edu-rise" role="status">{notice}</p>}
    <section className="ac-panel edu-card edu-rise" style={stagger(1)} aria-labelledby="ac-mfa">
      <h2 id="ac-mfa"><ShieldCheck size={18} aria-hidden="true" /> Xác thực hai lớp</h2>
      {enrolling ? <Enroll email={me.account.email} done={() => { setEnrolling(false); setNotice('Đã bật xác thực hai lớp.'); refresh() }}
        cancel={() => setEnrolling(false)} />
        : codes ? <RecoveryCodes codes={codes} done={() => setCodes(undefined)} label="Tôi đã cất các mã mới; mã cũ không còn dùng được" />
        : <>
          <p>{me.account.mfa_enabled ? <span className="ac-status is-on">Đang bật</span> : <span className="ac-status">Chưa bật</span>}
            {me.account.mfa_enabled ? ' Mỗi lần đăng nhập cần thêm mã 6 số từ điện thoại.' : ' Tùy chọn. Hiện chỉ cần mật khẩu để đăng nhập.'}</p>
          <div className="ac-row">
            <button type="button" className="edu-press" onClick={() => setEnrolling(true)}>
              <Smartphone size={16} aria-hidden="true" /> {me.account.mfa_enabled ? 'Đổi điện thoại xác thực' : 'Bật xác thực hai lớp'}</button>
          </div>
          {me.account.mfa_enabled && <form className="ac-form ac-inline" onSubmit={regenerate.submit}>
            <label>Mật khẩu hiện tại để tạo lại mã khôi phục<input type="password" name="password" autoComplete="current-password" required /></label>
            <Problem>{regenerate.error}</Problem>
            <button className="edu-press" disabled={regenerate.busy}>Tạo lại 10 mã khôi phục</button>
          </form>}
        </>}
    </section>
    <section className="ac-panel edu-card edu-rise" style={stagger(2)} aria-labelledby="ac-password">
      <h2 id="ac-password"><KeyRound size={18} aria-hidden="true" /> Đổi mật khẩu</h2>
      <form className="ac-form" onSubmit={change.submit}>
        <label>Mật khẩu hiện tại<input type="password" name="current" autoComplete="current-password" required /></label>
        <label>Mật khẩu mới<input type="password" name="next" autoComplete="new-password" minLength={12} maxLength={128} required /></label>
        <label>Nhập lại mật khẩu mới<input type="password" name="confirm" autoComplete="new-password" minLength={12} maxLength={128} required /></label>
        <Problem>{change.error}</Problem>
        <button className="edu-primary edu-press" disabled={change.busy}>Đổi mật khẩu</button>
      </form>
    </section>
    <section className="ac-panel edu-card edu-rise" style={stagger(3)} aria-labelledby="ac-sessions">
      <h2 id="ac-sessions"><MonitorSmartphone size={18} aria-hidden="true" /> Thiết bị đang đăng nhập</h2>
      {!sessions ? <span className="edu-skeleton ac-line-skeleton" /> : <ul className="ac-list">{sessions.map(row => <li key={row.id}>
        <span><strong>{row.user_agent.replace(/\(.*?\)/g, '').slice(0, 60) || 'Thiết bị'}</strong>
          <small>{row.current ? 'Thiết bị này · ' : ''}Hoạt động {formatTime(row.last_seen_at)}{row.ip ? ' · ' + row.ip : ''}</small></span>
        {!row.current && <button type="button" className="text-button" onClick={async () => {
          await api('/api/sessions/' + row.id, 'DELETE').catch(() => undefined)
          load()
        }}>Đăng xuất</button>}
      </li>)}</ul>}
    </section>
  </>
}

function Shell({ me, refresh, signOut }: { me: Me; refresh: () => void; signOut: () => void }) {
  const role = me.account.platform_role
  const [recoveryUsed] = useState(() => sessionStorage.getItem('ac-recovery-used') === '1')
  return <div className="edu ac">
    <a className="skip" href="#ac-main">Đến nội dung</a>
    <header className="ac-top edu-glass-bar">
      <Brand />
      <button type="button" className="ac-signout edu-press" aria-label="Đăng xuất" onClick={signOut}><LogOut size={16} aria-hidden="true" /> <span>Đăng xuất</span></button>
    </header>
    {role === 'founder' && <p className="ac-founder-bar" role="note"><Crown size={15} aria-hidden="true" /> Bạn đang dùng quyền Founder · mọi thao tác đều được ghi nhật ký</p>}
    <main className="ac-main" id="ac-main">
      <header className="ac-hello edu-rise">
        <p className="ac-greeting"><Sparkles size={15} aria-hidden="true" /> Xin chào</p>
        <h1>{me.account.name}</h1>
        <p className="edu-muted">{me.account.email}</p>
        {role && <span className={'ac-role is-' + role}>{role === 'founder' && <Crown size={14} aria-hidden="true" />} {roleName[role]}</span>}
      </header>
      {recoveryUsed && <p className="ac-warning edu-rise" role="alert">Bạn vừa đăng nhập bằng mã khôi phục. Hãy vào Bảo mật để đổi điện thoại xác thực và tạo lại mã.</p>}
      <nav className="ac-tabs" aria-label="AFYLLX Account">
        <NavLink to="/" end><LayoutGrid size={16} aria-hidden="true" /> Tổng quan</NavLink>
        <NavLink to="/bao-mat"><ShieldCheck size={16} aria-hidden="true" /> Bảo mật</NavLink>
        {role && <NavLink to="/quan-tri"><Users size={16} aria-hidden="true" /> Quản trị</NavLink>}
      </nav>
      <Routes>
        <Route index element={<div className="edu-page ac-stack"><Overview me={me} /></div>} />
        <Route path="bao-mat" element={<div className="edu-page ac-stack"><Security me={me} refresh={refresh} /></div>} />
        {role && <Route path="quan-tri/*" element={<div className="edu-page ac-stack"><Admin me={me} /></div>} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </main>
  </div>
}

function App() {
  const navigate = useNavigate()
  const [me, setMe] = useState<Me | null>()
  const [error, setError] = useState('')
  const refresh = () => api<Me>('/api/me').then(next => {
    setError('')
    const back = next.state === 'full' ? returnPath() : null
    if (back) { location.assign(back); return }
    setMe(next)
  }, failure => {
    if (failure instanceof ApiError && failure.status === 401) setMe(null)
    else setError(message(failure))
  })
  useEffect(() => { refresh() }, [])
  async function signOut() {
    await api('/api/logout', 'POST', {}).catch(() => undefined)
    sessionStorage.removeItem('ac-recovery-used')
    setMe(null)
    navigate('/', { replace: true })
  }
  if (error) return <Gate title="Chưa mở được"><Problem>{error}</Problem><button type="button" onClick={refresh}>Thử lại</button></Gate>
  if (me === undefined) return <div className="edu ac"><div className="ac-boot" role="status"><Mark size={56} /><span className="sr-only">Đang mở…</span></div></div>
  if (me === null) return <Login done={refresh} />
  if (me.state === 'mfa') return <SecondFactor me={me} done={refresh} signOut={signOut} />
  if (me.state === 'enroll') return <Gate title="Bật xác thực hai lớp" eyebrow={me.account.email}>
    <p className="edu-muted">Tài khoản có vai trò hệ thống AFYLLX phải dùng thêm mã 6 số từ điện thoại mỗi lần đăng nhập.</p>
    <Enroll email={me.account.email} done={refresh} />
    <button type="button" className="text-button" onClick={signOut}>Đăng xuất</button>
  </Gate>
  return <Shell me={me} refresh={refresh} signOut={signOut} />
}

const router = createBrowserRouter([
  { path: '/dat-mat-khau', element: <SetPassword /> },
  { path: '*', element: <App /> },
], { basename: base || '/' })
createRoot(document.getElementById('root')!).render(<RouterProvider router={router} />)
