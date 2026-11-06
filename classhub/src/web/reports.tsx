import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AlertTriangle, ChevronRight, Download, Printer } from 'lucide-react'
import { ActionForm, Empty, Field, Header, LoadView, Notice, Panel, addDays, basePath, errorText, formatDay, localDay, useLoad, value } from './ui'
import { RemoteSelect, type WorkspaceProps } from './operations'
import { Reports } from './scheduling'
import './reports.css'

type Status = 'present' | 'late' | 'absent' | 'excused' | 'unmarked'
type Totals = { present: number; late: number; absent: number; excused: number }
type Rule = { absent: number; missed: number; late: number }
type ClassSummary = Totals & { id: string; name: string; due: number; finalized: number; rate: number | null; flagged: number }
type StudentSummary = Totals & { class_id: string; class_name: string; id: string; code: string; name: string; rate: number | null; flagged: boolean }
type Summary = { from: string; to: string; terms: { id: string; name: string; starts_on: string; ends_on: string }[]
  classes: ClassSummary[]; students: StudentSummary[]; rule: Rule }
type Register = { class: { id: string; name: string }; month: string; start: string; end: string
  sessions: { id: string; date: string; shift: 'morning' | 'afternoon' | null; starts_at: number; finalized: boolean }[]
  students: { enrollment_id: string; name: string; code: string; marks: Record<string, Status>; totals: Totals; flagged: boolean }[] }

const percent = new Intl.NumberFormat('vi-VN', { style: 'percent', maximumFractionDigits: 1 })
const codes: Record<Status, string> = { present: '', late: 'M', excused: 'P', absent: 'K', unmarked: '' }
const ruleText = (rule: Rule) => 'Từ ' + rule.absent + ' buổi vắng không phép, ' + rule.missed + ' buổi vắng tính cả có phép, hoặc '
  + rule.late + ' lần đi muộn.'

async function downloadCsv(path: string, name: string) {
  const response = await fetch(basePath + path)
  if (!response.ok) {
    const problem = await response.json().catch(() => null) as { error?: { message?: string } } | null
    throw new Error(problem?.error?.message ?? 'Không thể xuất báo cáo.')
  }
  const url = URL.createObjectURL(await response.blob())
  Object.assign(document.createElement('a'), { href: url, download: name }).click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function ExportButton({ path, name, label }: { path: string; name: string; label: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return <>
    <button type="button" disabled={busy} onClick={async () => {
      setBusy(true)
      setError('')
      try { await downloadCsv(path, name) } catch (failure) { setError(errorText(failure)) } finally { setBusy(false) }
    }}><Download size={17} aria-hidden="true" /> {busy ? 'Đang xuất…' : label}</button>
    <Notice error>{error}</Notice>
  </>
}

/* ------------------------------------------------------------------ Summary */

function SummaryView({ api, base }: WorkspaceProps) {
  const [params, setParams] = useSearchParams()
  const today = localDay()
  const from = params.get('from') ?? addDays(today, -29)
  const to = params.get('to') ?? today
  const query = new URLSearchParams({ from, to })
  const load = useLoad<{ data: Summary }>(api + '/reports/summary?' + query)
  const show = (next: { from: string; to: string }) => setParams({ muc: 'tong-hop', ...next })
  return <>
    <Header kicker="ClassCheck · Phân tích" title="Tổng hợp chuyên cần" description="Theo lớp và từng học sinh, chỉ tính buổi đã chốt." />
    <LoadView load={load}>{({ data }) => {
      const flagged = data.students.filter(row => row.flagged)
        .sort((a, b) => b.absent - a.absent || (b.absent + b.excused) - (a.absent + a.excused) || b.late - a.late)
      return <>
        <Panel title="Khoảng thời gian">
          <div className="segmented report-presets" role="group" aria-label="Chọn nhanh">
            {data.terms.map(term => {
              const end = term.ends_on < today ? term.ends_on : today < term.starts_on ? term.starts_on : today
              return <button type="button" key={term.id} aria-pressed={from === term.starts_on && to === end}
                onClick={() => show({ from: term.starts_on, to: end })}>{term.name}</button>
            })}
            <button type="button" aria-pressed={from === addDays(today, -29) && to === today} onClick={() => show({ from: addDays(today, -29), to: today })}>30 ngày qua</button>
            <button type="button" aria-pressed={from === today.slice(0, 7) + '-01' && to === today}
              onClick={() => show({ from: today.slice(0, 7) + '-01', to: today })}>Tháng này</button>
          </div>
          <ActionForm key={from + to} label="Xem" reset={false} action={async form => show({ from: value(form, 'from'), to: value(form, 'to') })}>
            <Field label="Từ ngày"><input type="date" name="from" defaultValue={from} required /></Field>
            <Field label="Đến ngày"><input type="date" name="to" defaultValue={to} required /></Field>
          </ActionForm>
        </Panel>
        <Panel title={'Theo lớp · ' + formatDay(data.from) + ' – ' + formatDay(data.to)}>
          {data.classes.length ? <div className="table-scroll" role="region" aria-label="Chuyên cần theo lớp" tabIndex={0}>
            <table className="report-table">
              <thead><tr><th scope="col">Lớp</th><th scope="col">Buổi đã chốt</th><th scope="col">Chuyên cần</th>
                <th scope="col">Không phép (K)</th><th scope="col">Có phép (P)</th><th scope="col">Đi muộn (M)</th><th scope="col">Cần chú ý</th></tr></thead>
              <tbody>{data.classes.map(row => <tr key={row.id}>
                <th scope="row"><Link to={base + '/bao-cao?' + new URLSearchParams({ muc: 'so-thang', class_id: row.id, thang: data.to.slice(0, 7) })}>
                  {row.name}</Link></th>
                <td className={row.finalized < row.due ? 'report-warn' : undefined}>{row.finalized}/{row.due}</td>
                <td><strong>{row.rate === null ? '—' : percent.format(row.rate)}</strong></td>
                <td>{row.absent}</td><td>{row.excused}</td><td>{row.late}</td>
                <td className={row.flagged ? 'report-warn' : undefined}>{row.flagged}</td>
              </tr>)}</tbody>
            </table>
          </div> : <Empty>Chưa có buổi học trong khoảng này.</Empty>}
          <p className="muted">Bấm tên lớp để mở sổ điểm danh tháng. Ô màu cam ở cột “Buổi đã chốt” nghĩa là còn buổi đã diễn ra chưa chốt.</p>
          <ExportButton path={api + '/reports/summary.csv?' + query} name={'tong-hop-chuyen-can-' + from + '-' + to + '.csv'}
            label="Xuất Excel (CSV) từng học sinh" />
        </Panel>
        <Panel title={'Học sinh cần chú ý (' + flagged.length + ')'}>
          <p className="muted">{ruleText(data.rule)}</p>
          {flagged.length ? <div className="list">{flagged.slice(0, 50).map(row => <Link className="row-link" key={row.class_id + row.id}
            to={base + '/bao-cao?' + new URLSearchParams({ from: data.from, to: data.to, student_id: row.id })}>
            <div><strong>{row.name}</strong><small>{row.class_name} · {row.code}</small></div>
            <span>K {row.absent} · P {row.excused} · M {row.late}</span><ChevronRight size={17} aria-hidden="true" />
          </Link>)}</div> : <Empty>Không có học sinh nào chạm ngưỡng trong khoảng này.</Empty>}
          {flagged.length > 50 && <p className="muted">Đang hiện 50 em đầu. Xuất Excel để xem đủ.</p>}
        </Panel>
      </>
    }}</LoadView>
  </>
}

/* ------------------------------------------------------------------ Monthly register */

function RegisterTable({ data }: { data: Register }) {
  const days = [...new Set(data.sessions.map(session => session.date))]
  const twoShifts = data.sessions.some(session => session.shift)
  return <div className="table-scroll register-scroll" role="region" aria-label={'Sổ điểm danh lớp ' + data.class.name} tabIndex={0}>
    <table className="register">
      <thead>
        <tr><th scope="col" rowSpan={2} className="register-index">STT</th><th scope="col" rowSpan={2} className="register-name">Họ và tên</th>
          {days.map(day => <th scope="colgroup" key={day} colSpan={data.sessions.filter(session => session.date === day).length}>
            {day.slice(8)}</th>)}
          <th scope="col" rowSpan={2}>M</th><th scope="col" rowSpan={2}>P</th><th scope="col" rowSpan={2}>K</th><th scope="col" rowSpan={2}>Vắng</th></tr>
        <tr>{data.sessions.map(session => <th scope="col" key={session.id} className={session.finalized ? undefined : 'register-open'}
          title={session.finalized ? undefined : 'Buổi chưa chốt'}>
          {session.shift ? (session.shift === 'morning' ? 'S' : 'C') : twoShifts ? '' : '•'}</th>)}</tr>
      </thead>
      <tbody>{data.students.map((student, index) => <tr key={student.enrollment_id} className={student.flagged ? 'register-flagged' : undefined}>
        <td className="register-index">{index + 1}</td>
        <th scope="row" className="register-name">{student.name}{student.flagged && <AlertTriangle size={13} aria-label=" cần chú ý" />}</th>
        {data.sessions.map(session => {
          const status = student.marks[session.id] ?? 'unmarked'
          return <td key={session.id} className={'register-cell register-' + (session.finalized ? status : 'open')}>
            {session.finalized ? codes[status] : '–'}</td>
        })}
        <td>{student.totals.late || ''}</td><td>{student.totals.excused || ''}</td><td>{student.totals.absent || ''}</td>
        <td><strong>{student.totals.excused + student.totals.absent || ''}</strong></td>
      </tr>)}</tbody>
    </table>
  </div>
}

function RegisterView({ api }: WorkspaceProps) {
  const [params, setParams] = useSearchParams()
  const classId = params.get('class_id') ?? ''
  const month = params.get('thang') ?? localDay().slice(0, 7)
  const query = new URLSearchParams({ class_id: classId, month })
  const load = useLoad<{ data: Register }>(classId ? api + '/reports/register?' + query : '')
  return <>
    <Header kicker="ClassCheck · Sổ điểm danh" title="Sổ điểm danh tháng"
      description="Mỗi cột là một buổi đã lên lịch. Để trống: có mặt · M: đi muộn · P: vắng có phép · K: vắng không phép · –: buổi chưa chốt." />
    <Panel title="Chọn lớp và tháng">
      <ActionForm key={classId + month} label="Xem sổ" reset={false} action={async form =>
        setParams({ muc: 'so-thang', class_id: value(form, 'class_id'), thang: value(form, 'thang') })}>
        <RemoteSelect<{ id: string; name: string }> url={api + '/classes'} name="class_id" label="Lớp" searchable
          defaultOption={classId ? { id: classId, name: load.value?.data.class.name ?? 'Lớp đang xem' } : undefined} toOption={row => row} />
        <Field label="Tháng"><input type="month" name="thang" defaultValue={month} required /></Field>
      </ActionForm>
    </Panel>
    {classId ? <LoadView load={load}>{({ data }) => <section className="panel register-panel">
      <div className="row-between register-heading">
        <h2>Lớp {data.class.name} · Tháng {data.month.slice(5)}/{data.month.slice(0, 4)}</h2>
        <div className="register-actions no-print">
          <ExportButton path={api + '/reports/register.csv?' + query} name={'so-diem-danh-' + data.class.name + '-' + data.month + '.csv'}
            label="Xuất Excel (CSV)" />
          <button type="button" onClick={() => window.print()}><Printer size={17} aria-hidden="true" /> In sổ</button>
        </div>
      </div>
      {data.sessions.length && data.students.length ? <RegisterTable data={data} />
        : <Empty>{data.students.length ? 'Tháng này lớp chưa có buổi học.' : 'Lớp chưa có học sinh trong tháng này.'}</Empty>}
      <p className="muted register-legend">Học sinh tô màu: {ruleText({ absent: 3, missed: 5, late: 5 })} Tính trong tháng đang xem.</p>
    </section>}</LoadView> : <Empty>Chọn lớp để xem sổ điểm danh.</Empty>}
  </>
}

/* ------------------------------------------------------------------ Page and dashboard panel */

const tabs = { 'chi-tiet': 'Chi tiết', 'tong-hop': 'Tổng hợp', 'so-thang': 'Sổ điểm danh tháng' } as const
export function ReportsPage(props: WorkspaceProps) {
  const [params] = useSearchParams()
  const requested = params.get('muc')
  const tab = requested && requested in tabs ? requested as keyof typeof tabs : 'chi-tiet'
  return <>
    <nav className="tabs no-print" aria-label="Loại báo cáo">
      {Object.entries(tabs).map(([id, label]) => <Link key={id} to={props.base + '/bao-cao' + (id === 'chi-tiet' ? '' : '?muc=' + id)}
        aria-current={tab === id ? 'page' : undefined} className={tab === id ? 'active' : undefined}>{label}</Link>)}
    </nav>
    {tab === 'chi-tiet' && <Reports {...props} />}
    {tab === 'tong-hop' && <SummaryView {...props} />}
    {tab === 'so-thang' && <RegisterView {...props} />}
  </>
}

export function AttentionPanel({ api, base }: { api: string; base: string }) {
  const load = useLoad<{ data: { from: string; to: string; total: number; rule: Rule; students: StudentSummary[] } }>(api + '/reports/alerts?days=30')
  const data = load.value?.data
  if (!data?.total) return null
  return <section className="panel dash-panel attention-panel" aria-labelledby="attention-title">
    <div className="dash-section-heading"><div><p className="eyebrow">30 ngày qua</p><h2 id="attention-title">Học sinh cần chú ý</h2></div>
      <Link className="dash-text-link" to={base + '/bao-cao?muc=tong-hop'}>Tổng hợp</Link></div>
    <p className="dash-caption">{ruleText(data.rule)}</p>
    <div className="list">{data.students.slice(0, 8).map(row => <Link className="row-link" key={row.class_id + row.id}
      to={base + '/bao-cao?' + new URLSearchParams({ from: data.from, to: data.to, student_id: row.id })}>
      <div><strong>{row.name}</strong><small>{row.class_name}</small></div>
      <span className="dash-warning">K {row.absent} · P {row.excused} · M {row.late}</span><ChevronRight size={17} aria-hidden="true" />
    </Link>)}</div>
    {data.total > 8 && <p className="dash-caption">Còn {data.total - 8} học sinh khác trong mục Tổng hợp.</p>}
  </section>
}
