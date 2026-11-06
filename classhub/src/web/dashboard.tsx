import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDownRight, ArrowUpRight, CalendarDays, ChartNoAxesColumn, ChevronDown, ChevronRight,
  ClipboardCheck, GraduationCap, Layers3,
} from 'lucide-react'
import type { ActivityCounts, ActivityDay, AttendanceCounts, DashboardAnalytics } from '../server/dashboard'
import type { WorkspaceProps } from './operations'
import { lessonStatus, type Lesson } from './scheduling'
import { Badge, Empty, Notice, Pager, formatClock, formatDay, localDay, useLoad } from './ui'
import './dashboard.css'
import { AttentionPanel } from './reports'

type DashboardLesson = Pick<Lesson, 'id' | 'class_name' | 'lesson_date' | 'starts_at' | 'ends_at' | 'attendance_state' | 'status' | 'room'>
type Overview = {
  date: string
  stats: Record<'today_sessions' | 'pending' | 'active_classes' | 'enrolled_students', number>
  todaySessions: DashboardLesson[]; pendingSessions: DashboardLesson[]; pendingPage: number; pendingHasMore: boolean
  unassigned: { id: string; name: string }[]
}
const periods = [7, 14, 30] as const
const number = new Intl.NumberFormat('vi-VN')
const percent = new Intl.NumberFormat('vi-VN', { style: 'percent', maximumFractionDigits: 1 })
const weekday = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', timeZone: 'UTC' })
const stages = [
  { key: 'done', label: 'Đã chốt', color: 'var(--dash-done)' },
  { key: 'pending', label: 'Chờ chốt', color: 'var(--dash-pending)' },
  { key: 'planned', label: 'Đang hoặc sắp học', color: 'var(--dash-planned)' },
] as const
const attendanceStages = [
  { key: 'present', label: 'Có mặt', color: 'var(--dash-present)' },
  { key: 'late', label: 'Đi muộn', color: 'var(--dash-pending)' },
  { key: 'absent', label: 'Vắng', color: 'var(--dash-absent)' },
  { key: 'excused', label: 'Có phép', color: 'var(--dash-excused)' },
] as const
const totalSessions = (data: ActivityCounts) => data.done + data.pending + data.planned
function attendanceRate(data: AttendanceCounts) {
  const counted = data.present + data.late + data.absent
  return counted ? percent.format((data.present + data.late) / counted) : '—'
}

function useDashboardData<T>(path: string) {
  const load = useLoad<{ data: T }>(path)
  const [last, setLast] = useState<T>()
  useEffect(() => {
    if (load.value) setLast(load.value.data)
  }, [load.value])
  return { data: load.value?.data ?? last, pending: !load.value && !load.error, error: load.error, refresh: load.refresh }
}

function DashboardError({ message, retry }: { message: string; retry: () => void }) {
  return <div className="dash-error">
    <Notice error>{message}</Notice><button type="button" onClick={retry}>Thử tải lại</button>
  </div>
}

function SectionHeading({ label, title, children }: { label: string; title: string; children?: ReactNode }) {
  return <div className="dash-section-heading">
    <div><p className="eyebrow">{label}</p><h2>{title}</h2></div>
    {children}
  </div>
}

function ActivityChart({ days }: { days: ActivityDay[] }) {
  const peak = Math.max(...days.map(totalSessions))
  const step = Math.max(1, Math.ceil(peak / 3))
  const labelStep = days.length <= 7 ? 1 : days.length <= 14 ? 3 : 6
  const range = days[0].date + ':' + days.length
  return <>
    <div className="dash-activity-chart" aria-hidden="true">
      <div className="dash-axis">{[3, 2, 1, 0].map(level => <span key={level}>{number.format(level * step)}</span>)}</div>
      <div className="dash-chart-area">
        <div className="dash-gridlines"><i /><i /><i /><i /></div>
        <div key={range} className="dash-columns" style={{ gridTemplateColumns: 'repeat(' + days.length + ', minmax(0, 1fr))' }}>
          {days.map((day, index) => {
            const count = totalSessions(day)
            return <div key={day.date} className="dash-column"
              title={formatDay(day.date) + ' · ' + day.done + ' đã chốt · ' + day.pending + ' chờ chốt · ' + day.planned + ' đang hoặc sắp học'}>
              <div className="dash-stack" style={{
                height: count / (3 * step) * 100 + '%',
                '--dash-delay': Math.min(index, 6) * 24 + 'ms',
              } as CSSProperties}>
                <div className="dash-stack-fill">
                  {stages.map(({ key, color }) => day[key] > 0 && <span key={key} style={{ flexGrow: day[key], background: color }} />)}
                </div>
              </div>
              {(index === days.length - 1 || (index % labelStep === 0 && index < days.length - labelStep)) &&
                <small>{formatDay(day.date).slice(0, 5)}</small>}
            </div>
          })}
        </div>
      </div>
    </div>
    <ul className="dash-legend" aria-label="Trạng thái buổi học">
      {stages.map(stage => <li key={stage.key}><i style={{ background: stage.color }} />{stage.label}</li>)}
    </ul>
    {peak === 0 ? <p className="dash-caption">Chưa có buổi học trong khoảng đã chọn.</p> :
      <details className="dash-exact">
        <summary>Dữ liệu từng ngày <ChevronDown size={15} aria-hidden="true" /></summary>
        <div className="table-scroll" role="region" aria-label="Số buổi theo từng ngày" tabIndex={0}>
          <table>
            <thead><tr><th scope="col">Ngày</th>{stages.map(stage => <th scope="col" key={stage.key}>{stage.label}</th>)}</tr></thead>
            <tbody key={range}>{days.map(day => <tr key={day.date}><th scope="row">{formatDay(day.date)}</th>
              {stages.map(stage => <td key={stage.key}>{number.format(day[stage.key])}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </details>}
  </>
}

function AttendanceChart({ counts }: { counts: AttendanceCounts }) {
  const total = attendanceStages.reduce((sum, { key }) => sum + counts[key], 0)
  let start = 0
  const slices = attendanceStages.flatMap(({ key, color }) => {
    if (!counts[key]) return []
    const end = start + counts[key] / total * 100
    const segment = color + ' ' + start + '% ' + end + '%'
    start = end
    return [segment]
  })
  return <>
    <div className="dash-attendance-chart">
      <div className="dash-donut">
        <div className="dash-donut-track" aria-hidden="true" style={total ? { background: 'conic-gradient(' + slices.join(', ') + ')' } : undefined} />
        <div className="dash-donut-label"><strong>{attendanceRate(counts)}</strong><span>Tỷ lệ chuyên cần</span></div>
      </div>
      <ul className="dash-legend dash-attendance-legend" aria-label="Kết quả điểm danh">
        {attendanceStages.map(({ key, label, color }) => <li key={key}>
          <i style={{ background: color }} /><span>{label}</span><strong>{total ? number.format(counts[key]) : '—'}</strong>
        </li>)}
      </ul>
    </div>
    <p className="dash-caption">{total ? number.format(total) + ' lượt đã chốt · Tỷ lệ chuyên cần tính cả lượt đi muộn.' :
      'Chưa có lượt điểm danh đã chốt trong khoảng đã chọn.'}</p>
  </>
}

function ClassTable({ data, base, onPage }: { data: DashboardAnalytics; base: string; onPage: (page: number) => void }) {
  return <section className="panel dash-panel dash-enter dash-scroll dash-class-table">
    <SectionHeading label={formatDay(data.from) + ' – ' + formatDay(data.to)} title="Thống kê lớp học">
      <Link className="dash-text-link" to={base + '/lop'}>Danh sách lớp <ArrowUpRight size={15} aria-hidden="true" /></Link>
    </SectionHeading>
    {data.classes.length ? <>
      <div className="table-scroll" role="region" aria-label="Thống kê lớp học" tabIndex={0}>
        <table className="dash-class-grid">
          <thead><tr><th scope="col">Lớp học</th><th scope="col">Số buổi</th><th scope="col">Đã chốt</th>
            <th scope="col">Chờ chốt</th><th scope="col">Chuyên cần</th></tr></thead>
          <tbody key={data.from + ':' + data.classPage}>{data.classes.map(row => {
            const total = totalSessions(row)
            return <tr key={row.id}>
              <th scope="row"><Link className="dash-class-link" to={base + '/lop/' + row.id}>
                {row.name}<small>{row.code}</small></Link></th>
              <td>{number.format(total)}</td>
              <td><div className="dash-completion">
                <strong>{number.format(row.done)}</strong>
                <span className="dash-progress" aria-hidden="true">
                  <i style={{ width: (total ? row.done / total * 100 : 0) + '%' }} />
                </span>
              </div></td>
              <td><span className={row.pending ? 'dash-warning' : 'dash-zero'}>{number.format(row.pending)}</span></td>
              <td><strong>{attendanceRate(row)}</strong></td>
            </tr>
          })}</tbody>
        </table>
      </div>
      <Pager page={data.classPage} hasMore={data.classHasMore} change={onPage} />
    </> : <Empty>Chưa có lớp hoạt động hoặc có buổi học trong khoảng này.</Empty>}
  </section>
}

export function Dashboard({ workspace, api, base }: WorkspaceProps) {
  const surface = useRef<HTMLDivElement>(null)
  const [pendingPage, setPendingPage] = useState(1)
  const [days, setDays] = useState<(typeof periods)[number]>(7)
  const [classPage, setClassPage] = useState(1)
  const overview = useDashboardData<Overview>(api + '/dashboard?pending_page=' + pendingPage)
  const waitForDirectory = workspace.shared_directory && !overview.data && overview.pending
  const analytics = useDashboardData<DashboardAnalytics>(waitForDirectory ? '' :
    api + '/dashboard/analytics?days=' + days + '&class_page=' + classPage)
  const snapshot = analytics.data
  const hasClassTable = Boolean(snapshot)
  const ops = overview.data
  const day = ops?.date ?? localDay()
  const singlePending = ops?.stats.pending === 1 ? ops.pendingSessions[0] : undefined
  const metricCards = [
    { key: 'today_sessions', label: 'Buổi học hôm nay', icon: CalendarDays, href: '#dash-today', hint: 'Lịch trong ngày' },
    { key: 'pending', label: 'Buổi chờ chốt', icon: ClipboardCheck,
      to: singlePending ? base + '/buoi/' + singlePending.id : undefined,
      href: singlePending ? undefined : '#dash-pending', hint: singlePending ? 'Mở buổi chờ chốt' : 'Buổi đã qua giờ' },
    { key: 'active_classes', label: 'Lớp đang học', icon: Layers3, to: base + '/lop', hint: 'Các lớp hoạt động' },
    { key: 'enrolled_students', label: 'Học viên ghi danh', icon: GraduationCap,
      to: workspace.role === 'owner' ? base + '/hoc-vien' : undefined, hint: 'Học viên đang học' },
  ] as const
  useLayoutEffect(() => {
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const panel = entry.target as HTMLElement
        panel.dataset.dashScroll = 'seen'
        observer.unobserve(panel)
      }
    }, { rootMargin: '0px 0px -18px 0px' })
    for (const panel of surface.current?.querySelectorAll<HTMLElement>('.dash-scroll') ?? []) {
      if (panel.dataset.dashScroll === 'seen') continue
      if (panel.getBoundingClientRect().top < window.innerHeight - 18) {
        panel.dataset.dashScroll = 'seen'
      } else {
        panel.dataset.dashScroll = 'waiting'
        observer.observe(panel)
      }
    }
    return () => observer.disconnect()
  }, [hasClassTable])

  return <div className="dashboard-view" ref={surface}>
    <header className="dash-hero dash-enter">
      <div className="dash-orbit" aria-hidden="true"><i /><i /><i /></div>
      <div className="dash-hero-copy">
        <p className="eyebrow">AFYLLX Edu <span aria-hidden="true">/</span> ClassHub</p>
        <h1>Hôm nay</h1>
        <p>{workspace.name}</p>
      </div>
      <div className="dash-hero-side">
        <p className="dash-date"><CalendarDays size={16} aria-hidden="true" />
          <span><span className="dash-weekday">{weekday.format(new Date(day))} · </span><time dateTime={day}>{formatDay(day)}</time></span>
        </p>
        <div className="dash-hero-actions">
          <Link className="button dash-hero-primary" to={base + '/lich'}>Mở lịch học <ArrowUpRight size={16} aria-hidden="true" /></Link>
          {workspace.role !== 'teacher' && <Link className="button dash-hero-secondary" to={base + '/bao-cao'}>
            Báo cáo chi tiết <ChartNoAxesColumn size={16} aria-hidden="true" />
          </Link>}
        </div>
      </div>
    </header>

    {overview.error && <DashboardError message={overview.error} retry={overview.refresh} />}
    <section className="dash-metrics" aria-label="Số liệu hôm nay" aria-busy={!ops && overview.pending}>
      {metricCards.map(({ key, label, icon: Icon, hint, ...target }) => {
        const to = 'to' in target ? target.to : undefined
        const href = 'href' in target ? target.href : undefined
        const content = <>
          <div className="dash-metric-top"><span className="dash-metric-icon"><Icon size={20} aria-hidden="true" /></span>
            {(href || to) && (href ? <ArrowDownRight size={16} aria-hidden="true" /> : <ArrowUpRight size={16} aria-hidden="true" />)}</div>
          <strong key={ops?.stats[key] ?? 'empty'}>{ops ? number.format(ops.stats[key]) : '—'}</strong>
          <span>{label}</span><small>{hint}</small>
        </>
        const className = 'panel dash-metric dash-enter' + (key === 'pending' && ops?.stats.pending ? ' dash-metric-attention' : '')
        return href ? <a className={className} href={href} key={key}>{content}</a> :
          to ? <Link className={className} to={to} key={key}>{content}</Link> : <div className={className} key={key}>{content}</div>
      })}
    </section>

    <div className="dash-work-grid">
      <section id="dash-pending" className="panel dash-panel dash-enter dash-scroll" aria-busy={overview.pending}>
        <SectionHeading label="Ưu tiên" title="Cần xử lý">
          {ops && <span className="dash-warning">{number.format(ops.stats.pending)} buổi chờ chốt</span>}
        </SectionHeading>
        {ops ? <>
          {ops.pendingSessions.length ? <div className="list dash-session-list">{ops.pendingSessions.map(lesson =>
            <Link className="row-link dashboard-lesson" to={base + '/buoi/' + lesson.id} key={lesson.id}>
              <div><strong>{lesson.class_name}</strong><small>{formatDay(lesson.lesson_date)} · {formatClock(lesson.starts_at)}{lesson.room ? ' · ' + lesson.room : ''}</small></div>
              <span className="dashboard-action">{lesson.attendance_state === 'draft' ? 'Tiếp tục điểm danh' : 'Mở để chốt'}</span>
              <ChevronRight size={17} aria-hidden="true" />
            </Link>)}</div> : <Empty>{ops.stats.pending ? 'Không còn buổi nào trên trang này.' : 'Đã xử lý hết các buổi qua giờ.'}</Empty>}
          <Pager page={ops.pendingPage} hasMore={ops.pendingHasMore} change={setPendingPage} />
          {workspace.role !== 'teacher' && ops.unassigned.map(item => <Link className="warning-link" key={item.id} to={base + '/lop/' + item.id + '/giao-vien'}>
            {item.name} cần phân công giáo viên
          </Link>)}
        </> : <p className="dash-caption">{overview.pending ? 'Đang tải các buổi cần xử lý…' : 'Chưa tải được danh sách.'}</p>}
      </section>
      <section id="dash-today" className="panel dash-panel dash-enter dash-scroll" aria-busy={overview.pending}>
        <SectionHeading label={formatDay(day)} title={workspace.role === 'teacher' ? 'Lịch dạy của bạn' : 'Lịch hôm nay'}>
          <Link className="dash-text-link" to={base + '/lich'}>Xem lịch <ArrowUpRight size={15} aria-hidden="true" /></Link>
        </SectionHeading>
        {ops ? ops.todaySessions.length ? <div className="list dash-session-list">{ops.todaySessions.map(lesson =>
          <Link className="row-link dashboard-lesson" to={base + '/buoi/' + lesson.id} key={lesson.id}>
            <div><strong>{lesson.class_name}</strong><small>{formatClock(lesson.starts_at)}–{formatClock(lesson.ends_at)}{lesson.room ? ' · ' + lesson.room : ''}</small></div>
            <Badge status={lessonStatus(lesson)} /><ChevronRight size={17} aria-hidden="true" />
          </Link>)}</div> : <Empty>Hôm nay chưa có buổi học.</Empty> :
          <p className="dash-caption">{overview.pending ? 'Đang tải lịch hôm nay…' : 'Chưa tải được lịch.'}</p>}
      </section>
    </div>

    {workspace.role !== 'teacher' && <AttentionPanel api={api} base={base} />}

    <div className="dash-data" aria-busy={analytics.pending}>
      <div className="dash-data-heading dash-enter">
        <div><p className="eyebrow">Số liệu vận hành</p><h2>Tổng quan hoạt động</h2>
          <p className="dash-caption" role="status">{analytics.pending ? 'Đang tải số liệu ' + days + ' ngày…' :
            snapshot ? formatDay(snapshot.from) + ' – ' + formatDay(snapshot.to) : 'Chọn khoảng thời gian để xem số liệu.'}</p>
        </div>
        <div className="dash-periods" role="group" aria-label="Khoảng thống kê">
          {periods.map(period => <button type="button" key={period} aria-pressed={days === period}
            onClick={() => { setDays(period); setClassPage(1) }}>{period} ngày</button>)}
        </div>
      </div>
      {analytics.error && <DashboardError message={analytics.error} retry={analytics.refresh} />}
      <div className="dash-chart-grid">
        <section className="panel dash-panel dash-enter dash-scroll">
          <SectionHeading label="Tiến độ điểm danh" title="Buổi học theo ngày" />
          {snapshot ? <ActivityChart days={snapshot.daily} /> :
            <div className="dash-chart-placeholder" aria-hidden="true" />}
        </section>
        <section className="panel dash-panel dash-enter dash-scroll">
          <SectionHeading label="Kết quả đã chốt" title="Chuyên cần" />
          {snapshot ? <AttendanceChart key={snapshot.from + snapshot.to} counts={snapshot.attendance} /> :
            <div className="dash-chart-placeholder" aria-hidden="true" />}
        </section>
      </div>
    </div>
    {snapshot && <ClassTable data={snapshot} base={base} onPage={setClassPage} />}
  </div>
}
