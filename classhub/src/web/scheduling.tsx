import { useEffect, useState } from 'react'
import { Link, useBlocker, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, CheckCheck, Download } from 'lucide-react'
import {
  ActionForm, Badge, Empty, Field, Header, LoadView, Notice, Pager, Panel, addDays, basePath,
  errorText, formatClock, formatDay, localDay, send, statuses, useLoad, value, type Page,
} from './ui'
import { RemoteSelect, type Assignment, type ClassRow, type WorkspaceProps } from './operations'

export type Lesson = {
  id: string; class_id: string; class_name: string; teacher_id: string; teacher_name: string
  lesson_date: string; starts_at: number; ends_at: number; room: string; version: number
  status: 'scheduled' | 'completed' | 'cancelled'; attendance_state: 'unmarked' | 'draft' | 'finalized'
}
type Rule = {
  id: string; weekday: number; every_weeks: number; starts_on: string; ends_on: string
  starts_at: string; ends_at: string; room: string; teacher_name: string
}
const weekdays = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật']
type Mode = 'day' | 'week' | 'month' | 'list'
const modes: Record<Mode, string> = { day: 'Ngày', week: 'Tuần', month: 'Tháng', list: 'Danh sách' }
const option = (row: Assignment) => row.ended_at ? null : { id: row.user_id, name: row.name }
const asClock = (data: FormData) => ({
  teacher_id: value(data, 'teacher_id'), starts_at: value(data, 'starts_at'), ends_at: value(data, 'ends_at'), room: value(data, 'room'),
})

function LessonFields({ classApi, room = '', lesson }: { classApi: string; room?: string; lesson?: Lesson }) {
  return <>
    <RemoteSelect<Assignment> url={classApi + '/teachers'} name="teacher_id" label="Giáo viên phụ trách" toOption={option}
      defaultOption={lesson ? { id: lesson.teacher_id, name: lesson.teacher_name } : undefined} />
    <Field label="Giờ bắt đầu"><input type="time" name="starts_at" defaultValue={lesson ? formatClock(lesson.starts_at) : '18:00'} required /></Field>
    <Field label="Giờ kết thúc"><input type="time" name="ends_at" defaultValue={lesson ? formatClock(lesson.ends_at) : '19:30'} required /></Field>
    <Field label="Phòng học"><input name="room" maxLength={80} defaultValue={lesson?.room ?? room} /></Field>
  </>
}

export function Timetable({ item, classApi }: WorkspaceProps & { item: ClassRow; classApi: string }) {
  const [page, setPage] = useState(1)
  const [feedback, setFeedback] = useState('')
  const load = useLoad<Page<Rule>>(classApi + '/timetable?page=' + page)
  const from = item.starts_on > localDay() ? item.starts_on : localDay()
  const generatedEnd = addDays(from, 27)
  return <>
    <Notice>{feedback}</Notice>
    <details className="panel new-record"><summary>Thêm lịch lặp</summary>
      <ActionForm label="Tạo quy tắc" onSaved={() => { setFeedback('Đã lưu quy tắc. Chọn khoảng ngày bên dưới để tạo buổi học.'); load.refresh() }}
        action={data => send(classApi + '/timetable', {
          ...asClock(data), weekday: Number(value(data, 'weekday')), every_weeks: Number(value(data, 'every_weeks')),
          starts_on: value(data, 'starts_on'), ends_on: value(data, 'ends_on'),
        })}>
        <Field label="Ngày trong tuần"><select name="weekday">{weekdays.map((day, index) => <option key={day} value={index + 1}>{day}</option>)}</select></Field>
        <Field label="Lặp sau số tuần"><input type="number" name="every_weeks" min={1} max={4} defaultValue={1} required /></Field>
        <Field label="Hiệu lực từ"><input type="date" name="starts_on" min={item.starts_on} max={item.ends_on} defaultValue={from} required /></Field>
        <Field label="Hiệu lực đến"><input type="date" name="ends_on" min={item.starts_on} max={item.ends_on} defaultValue={item.ends_on} required /></Field>
        <LessonFields classApi={classApi} room={item.room} />
      </ActionForm>
    </details>
    <details className="panel new-record"><summary>Thêm buổi học riêng</summary>
      <ActionForm label="Tạo buổi học" onSaved={() => {
        setFeedback('Đã tạo buổi học. Lịch đã được cập nhật.')
        window.dispatchEvent(new Event('classhub:schedule'))
      }} action={data => send(classApi + '/sessions', { ...asClock(data), lesson_date: value(data, 'lesson_date') })}>
        <Field label="Ngày học"><input name="lesson_date" type="date" min={item.starts_on} max={item.ends_on} defaultValue={from} required /></Field>
        <LessonFields classApi={classApi} room={item.room} />
      </ActionForm>
    </details>
    <Panel title="Quy tắc lịch lặp">
      <LoadView load={load}>{({ data, pagination }) => <>
        {!data.length && <Empty>Chưa có quy tắc lịch lặp.</Empty>}
        {data.map(row => <details className="detail-row" key={row.id}>
          <summary><strong>{weekdays[row.weekday - 1]} · {row.starts_at}–{row.ends_at}</strong><span>{row.teacher_name} · Mỗi {row.every_weeks} tuần</span></summary>
          <p className="muted">Hiệu lực {formatDay(row.starts_on)} – {formatDay(row.ends_on)}. Mỗi lượt tạo tối đa 90 ngày.</p>
          <ActionForm label="Tạo các buổi học" action={async data => {
            const response = await send<{ created: number }>(classApi + '/timetable/' + row.id + '/generate',
              { from: value(data, 'from'), to: value(data, 'to') })
            setFeedback('Đã tạo ' + response.created + ' buổi mới trong khoảng đã chọn.')
            window.dispatchEvent(new Event('classhub:schedule'))
          }}>
            <Field label="Tạo từ ngày"><input name="from" type="date" defaultValue={row.starts_on > from ? row.starts_on : from} required /></Field>
            <Field label="Tạo đến ngày"><input name="to" type="date" defaultValue={row.ends_on < generatedEnd ? row.ends_on : generatedEnd} required /></Field>
          </ActionForm>
        </details>)}
        <Pager {...pagination} change={setPage} />
      </>}</LoadView>
    </Panel>
  </>
}

function calendarRange(date: string, mode: Mode) {
  if (mode === 'day') return { from: date, to: date }
  if (mode === 'week') {
    const monday = addDays(date, 1 - (new Date(date).getUTCDay() || 7))
    return { from: monday, to: addDays(monday, 6) }
  }
  if (mode === 'month') {
    const first = date.slice(0, 7) + '-01'
    const next = new Date(first)
    next.setUTCMonth(next.getUTCMonth() + 1)
    return { from: first, to: addDays(next.toISOString().slice(0, 10), -1) }
  }
  return { from: date, to: addDays(date, 30) }
}
function LessonLink({ lesson, base, compact = false }: { lesson: Lesson; base: string; compact?: boolean }) {
  return <Link to={base + '/buoi/' + lesson.id} className={compact ? 'calendar-event' : 'row-link'}>
    <div><strong>{lesson.class_name}</strong>
      <small>{compact ? '' : formatDay(lesson.lesson_date) + ' · '}{formatClock(lesson.starts_at)}–{formatClock(lesson.ends_at)}</small>
      {!compact && <small>{lesson.teacher_name}{lesson.room ? ' · ' + lesson.room : ''}</small>}</div>
    <Badge status={lesson.status === 'cancelled' ? 'cancelled' : lesson.attendance_state} />
  </Link>
}
export function Calendar({ api, base, classId }: WorkspaceProps & { classId?: string }) {
  const [mode, setMode] = useState<Mode>('list')
  const [date, setDate] = useState(localDay)
  const [page, setPage] = useState(1)
  const { from, to } = calendarRange(date, mode)
  const params = new URLSearchParams({ from, to, page: String(page) })
  if (classId) params.set('class_id', classId)
  const load = useLoad<Page<Lesson>>(api + '/sessions?' + params)
  useEffect(() => {
    const reload = () => load.refresh()
    window.addEventListener('classhub:schedule', reload)
    return () => window.removeEventListener('classhub:schedule', reload)
  }, [])
  const grid = mode === 'week' || mode === 'month'
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1
  const shift = (new Date(from).getUTCDay() + 6) % 7
  return <>
    {!classId && <Header kicker="Không gian giảng dạy" title="Lịch học" description="Buổi học theo giờ Việt Nam. Chọn buổi để mở ClassCheck." />}
    <Panel title={classId ? 'Lịch buổi học của lớp' : 'Lịch buổi học'}>
      <div className="toolbar">
        <Field label="Ngày xem"><input type="date" value={date} min="2000-01-01" max="2099-11-30"
          onChange={event => { if (event.target.value && event.target.validity.valid) { setDate(event.target.value); setPage(1) } }} /></Field>
        <div className="segmented" aria-label="Chế độ lịch">{Object.entries(modes).map(([id, label]) =>
          <button key={id} aria-pressed={mode === id} onClick={() => { setMode(id as Mode); setPage(1) }}>{label}</button>)}</div>
      </div>
      <p className="range"><CalendarDays size={17} aria-hidden="true" /> {formatDay(from)}{to !== from ? ' – ' + formatDay(to) : ''}</p>
      <LoadView load={load}>{({ data, pagination }) => <>
        {grid ? <div className="calendar-grid">
          {weekdays.map(day => <strong className="calendar-label" key={day}>{day}</strong>)}
          {Array.from({ length: shift }, (_, index) => <div className="calendar-blank" key={'blank' + index} />)}
          {Array.from({ length: days }, (_, index) => {
            const day = addDays(from, index)
            const lessons = data.filter(lesson => lesson.lesson_date === day)
            return <div className={'calendar-day' + (lessons.length ? ' has-lesson' : '')} key={day}>
              <span>{formatDay(day).slice(0, 5)}</span>
              {lessons.map(lesson => <LessonLink key={lesson.id} lesson={lesson} base={base} compact />)}
            </div>
          })}
        </div> : <div className="list">{data.map(lesson => <LessonLink key={lesson.id} lesson={lesson} base={base} />)}</div>}
        {!data.length && <Empty>Không có buổi học trong khoảng này.</Empty>}
        <Pager {...pagination} change={setPage} />
      </>}</LoadView>
    </Panel>
  </>
}

const attendanceStatuses = ['present', 'late', 'absent', 'excused', 'unmarked'] as const
type Status = (typeof attendanceStatuses)[number]
type Entry = { enrollment_id: string; name: string; code: string; status: Status; note: string }
type Sheet = { session: Lesson; roster: Entry[]; canEdit: boolean }
type AuditRow = { id: string; event: string; occurred_at: number; actor: string; details: string }
const eventLabel: Record<string, string> = {
  'attendance.records_updated': 'Cập nhật học viên', 'attendance.finalized': 'Chốt điểm danh',
  'attendance.reopened': 'Mở lại để sửa', 'attendance.saved': 'Lưu nháp',
}
function AttendanceHistory({ endpoint, roster }: { endpoint: string; roster: Entry[] }) {
  const [page, setPage] = useState(1)
  const load = useLoad<Page<AuditRow>>(endpoint + '/history?page=' + page)
  return <LoadView load={load}>{({ data, pagination }) => <>
    {!data.length && <Empty>Chưa có hoạt động điểm danh.</Empty>}
    <ul className="history">{data.map(item => {
      const details = JSON.parse(item.details) as { reason?: string; changes?: { enrollmentId: string; from: string; to: string; noteChanged: boolean }[] }
      return <li key={item.id}><strong>{eventLabel[item.event]}</strong> · {item.actor} · {formatClock(item.occurred_at)}
        {details.reason && <p>Lý do: {details.reason}</p>}
        {details.changes?.map(change => <p key={change.enrollmentId}>
          {roster.find(row => row.enrollment_id === change.enrollmentId)?.name ?? 'Học viên'} · {statuses[change.from]} → {statuses[change.to]}
          {change.noteChanged ? ' · Có thay đổi ghi chú' : ''}
        </p>)}
      </li>
    })}</ul><Pager {...pagination} change={setPage} />
  </>}</LoadView>
}

function SheetEditor({ sheet, endpoint, api, admin, reload, saved }: {
  sheet: Sheet; endpoint: string; api: string; admin: boolean; reload: () => void; saved: (message: string) => void
}) {
  const { session, roster, canEdit } = sheet
  const [entries, setEntries] = useState(roster)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState(false)
  const dirty = entries.some((entry, index) => entry.note !== roster[index].note || entry.status !== roster[index].status)
  const blocker = useBlocker(dirty)
  useEffect(() => {
    if (blocker.state === 'blocked') {
      if (window.confirm('Rời trang và bỏ các thay đổi điểm danh chưa lưu?')) blocker.proceed()
      else blocker.reset()
    }
  }, [blocker])
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  const change = (id: string, fields: Partial<Entry>) => setEntries(old => old.map(row => row.enrollment_id === id ? { ...row, ...fields } : row))
  const unmarked = entries.filter(row => row.status === 'unmarked').length
  async function persist(finalize: boolean) {
    if (finalize && !window.confirm('Chốt điểm danh cho buổi học này? Quản trị viên có thể mở lại để sửa.')) return
    setBusy(true)
    setError('')
    try {
      await send(endpoint + (finalize ? '/finalize' : ''), {
        version: session.version,
        entries: entries.map(({ enrollment_id, status, note }) => ({ enrollment_id, status, note })),
      }, finalize ? 'POST' : 'PUT')
      saved(finalize ? 'Đã chốt điểm danh.' : 'Đã lưu điểm danh nháp.')
    } catch (error) { setError(errorText(error)) }
    finally { setBusy(false) }
  }
  return <>
    <div className="attendance-bar panel">
      <div><strong>{entries.length} học viên</strong><small>{unmarked} chưa đánh dấu{dirty ? ' · Có thay đổi chưa lưu' : ''}</small></div>
      {canEdit && entries.length > 0 && <button disabled={busy || unmarked === 0} onClick={() =>
        setEntries(items => items.map(row => row.status === 'unmarked' ? { ...row, status: 'present' } : row))}>
        <CheckCheck size={18} aria-hidden="true" /> Đánh dấu còn lại có mặt
      </button>}
    </div>
    {session.status === 'cancelled' && <p className="panel">Buổi học đã hủy.</p>}
    {!canEdit && session.status === 'scheduled' && <p className="panel muted">Điểm danh mở khi buổi học bắt đầu.</p>}
    <Notice error>{error}</Notice>
    {session.status !== 'cancelled' && <Panel title="Danh sách điểm danh">
      {!entries.length && <Empty>Chưa có học viên đủ điều kiện cho buổi này.</Empty>}
      <fieldset disabled={busy} className="attendance-grid">
        {entries.map(row => <div key={row.enrollment_id} className="attendance-row">
          <div><strong>{row.name}</strong><small>{row.code}</small></div>
          {canEdit ? <>
            <label className="field"><span className="sr-only">Trạng thái của {row.name}</span>
              <select value={row.status} onChange={event => change(row.enrollment_id, { status: event.target.value as Status })}>
                {attendanceStatuses.map(id => <option value={id} key={id}>{statuses[id]}</option>)}
              </select>
            </label>
            <label className="field"><span className="sr-only">Ghi chú cho {row.name}</span><input maxLength={400} value={row.note}
              placeholder="Ghi chú (tùy chọn)" onChange={event => change(row.enrollment_id, { note: event.target.value })} /></label>
          </> : <><Badge status={row.status} /><span className="muted">{row.note}</span></>}
        </div>)}
      </fieldset>
      {canEdit && entries.length > 0 && <div className="attendance-actions">
        <button disabled={busy} onClick={() => persist(false)}>{busy ? 'Đang lưu…' : 'Lưu nháp'}</button>
        <button className="primary" disabled={busy || unmarked > 0} onClick={() => persist(true)}>Chốt điểm danh</button>
      </div>}
      {error && <button onClick={() => {
        if (!dirty || window.confirm('Tải lại và bỏ các thay đổi chưa lưu?')) reload()
      }}>Tải lại dữ liệu</button>}
    </Panel>}
    {admin && session.attendance_state === 'finalized' && <Panel title="Điều chỉnh điểm danh">
      <ActionForm label="Mở lại để sửa" onSaved={() => saved('Đã mở lại buổi điểm danh.')}
        action={data => send(endpoint + '/reopen', { version: session.version, reason: value(data, 'reason') })}>
        <Field label="Lý do mở lại"><input name="reason" maxLength={400} required /></Field>
      </ActionForm>
    </Panel>}
    {admin && session.status === 'scheduled' && session.attendance_state === 'unmarked' && <details className="panel new-record">
      <summary>Đổi lịch hoặc hủy buổi</summary>
      <ActionForm label="Đổi lịch" onSaved={() => saved('Đã cập nhật buổi học.')} action={data => send(api + '/sessions/' + session.id, {
        ...asClock(data), version: session.version, action: 'reschedule', lesson_date: value(data, 'lesson_date'),
      }, 'PATCH')}>
        <Field label="Ngày học"><input name="lesson_date" type="date" defaultValue={session.lesson_date} required /></Field>
        <LessonFields classApi={api + '/classes/' + session.class_id} lesson={session} />
      </ActionForm>
      <ActionForm label="Hủy buổi học" onSaved={() => saved('Đã hủy buổi học.')} action={() =>
        window.confirm('Hủy buổi học này?')
          ? send(api + '/sessions/' + session.id, { version: session.version, action: 'cancel' }, 'PATCH')
          : Promise.reject(new Error('Đã giữ buổi học.'))}><p className="muted">Lịch vẫn hiển thị buổi đã hủy để đối chiếu.</p></ActionForm>
    </details>}
    {admin && <details className="panel new-record" onToggle={event => setHistory(event.currentTarget.open)}>
      <summary>Lịch sử điểm danh</summary>
      {history && <AttendanceHistory endpoint={endpoint} roster={roster} />}
    </details>}
  </>
}
export function Attendance({ api, base, workspace }: WorkspaceProps) {
  const { sessionId } = useParams()
  const endpoint = api + '/sessions/' + sessionId + '/attendance'
  const load = useLoad<{ data: Sheet }>(endpoint)
  const [feedback, setFeedback] = useState('')
  const saved = (message: string) => { setFeedback(message); load.refresh() }
  return <>
    <Link className="back" to={base + '/lich'}><ArrowLeft size={16} aria-hidden="true" /> Lịch học</Link>
    <Notice>{feedback}</Notice>
    <LoadView load={load}>{({ data }) => <>
      <Header kicker="ClassCheck · Điểm danh" title={data.session.class_name} description={
        formatDay(data.session.lesson_date) + ' · ' + formatClock(data.session.starts_at) + '–' + formatClock(data.session.ends_at) +
        ' · ' + data.session.teacher_name + (data.session.room ? ' · ' + data.session.room : '')}>
        <Badge status={data.session.status === 'cancelled' ? 'cancelled' : data.session.attendance_state} />
      </Header>
      <SheetEditor key={data.session.id + ':' + data.session.version} sheet={data} endpoint={endpoint} api={api}
        admin={workspace.role !== 'teacher'} reload={load.refresh} saved={saved} />
    </>}</LoadView>
  </>
}

type ReportRow = { lesson_date: string; class_name: string; student_code: string; student_name: string; status: Status }
type Summary = Record<Status | 'total', number>
type Report = Page<ReportRow> & { summary: Summary }
type FilterOption = { id: string; name: string }
type ReportStaff = { user_id: string; name: string; role: string }

export function Reports({ api, workspace }: WorkspaceProps) {
  const [params, setParams] = useSearchParams()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const today = localDay()
  const filters = new URLSearchParams(params)
  if (!filters.has('from')) filters.set('from', addDays(today, -30))
  if (!filters.has('to')) filters.set('to', today)
  const load = useLoad<Report>(api + '/reports/attendance?' + filters)
  const selectOption = (row: FilterOption) => row
  async function download() {
    setBusy(true)
    setError('')
    try {
      const response = await fetch(basePath + api + '/reports/attendance.csv?' + filters)
      if (!response.ok) {
        const problem = await response.json().catch(() => null) as { error?: { message?: string } } | null
        throw new Error(problem?.error?.message ?? 'Không thể xuất báo cáo.')
      }
      const url = URL.createObjectURL(await response.blob())
      const link = Object.assign(document.createElement('a'), { href: url, download: 'classhub-attendance.csv' })
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) { setError(errorText(error)) }
    finally { setBusy(false) }
  }
  return <>
    <Header kicker="ClassCheck · Phân tích" title="Báo cáo chuyên cần" description="Dữ liệu từ các buổi đã chốt điểm danh." />
    <Notice error>{error}</Notice>
    <Panel title="Bộ lọc">
      <ActionForm label="Áp dụng bộ lọc" reset={false} action={async data => {
        const next = new URLSearchParams()
        for (const [key, raw] of data.entries()) if (raw) next.set(key, String(raw))
        setParams(next)
      }}>
        <Field label="Từ ngày"><input type="date" name="from" defaultValue={filters.get('from') ?? today} required /></Field>
        <Field label="Đến ngày"><input type="date" name="to" defaultValue={filters.get('to') ?? today} required /></Field>
        <details className="advanced-filters" open={['class_id', 'branch_id', 'teacher_id', 'student_id'].some(key => filters.has(key)) || undefined}>
          <summary>Bộ lọc nâng cao</summary>
          <div className="form-grid">
        <RemoteSelect<FilterOption> url={api + '/classes'} name="class_id" label="Lớp" required={false}
          defaultOption={filters.get('class_id') ? { id: filters.get('class_id')!, name: 'Lớp đang lọc' } : undefined} searchable toOption={selectOption} />
        <RemoteSelect<FilterOption> url={api + '/branches'} name="branch_id" label="Cơ sở" required={false}
          defaultOption={filters.get('branch_id') ? { id: filters.get('branch_id')!, name: 'Cơ sở đang lọc' } : undefined} toOption={selectOption} />
        <RemoteSelect<ReportStaff> url={api + '/staff' + (workspace.role === 'owner' ? '?all=1' : '')} name="teacher_id" label="Giáo viên" required={false}
          defaultOption={filters.get('teacher_id') ? { id: filters.get('teacher_id')!, name: 'Giáo viên đang lọc' } : undefined}
          searchable toOption={row => row.role === 'teacher' ? { id: row.user_id, name: row.name } : null} />
        {workspace.role === 'owner' && <RemoteSelect<FilterOption> url={api + '/students'} name="student_id" label="Học viên" required={false}
          defaultOption={filters.get('student_id') ? { id: filters.get('student_id')!, name: 'Học viên đang lọc' } : undefined}
          searchable toOption={selectOption} />}
          </div>
        </details>
      </ActionForm>
    </Panel>
    <LoadView load={load}>{({ data, summary, pagination }) => {
      const denominator = summary.present + summary.late + summary.absent
      const rate = denominator ? new Intl.NumberFormat('vi-VN', { style: 'percent', maximumFractionDigits: 1 })
        .format((summary.present + summary.late) / denominator) : '—'
      return <Panel title="Kết quả đã chốt">
        <div className="report-summary">
          <div><strong>{rate}</strong><span>Tỷ lệ chuyên cần</span></div>
          {attendanceStatuses.map(status => <div key={status}><strong>{summary[status]}</strong><span>{statuses[status]}</span></div>)}
        </div>
        <p className="muted">Tỷ lệ = (Có mặt + Đi muộn) / (Có mặt + Đi muộn + Vắng).</p>
        <button onClick={download} disabled={busy}><Download size={17} aria-hidden="true" /> {busy ? 'Đang xuất…' : 'Xuất CSV theo bộ lọc'}</button>
        {data.length ? <div className="table-scroll" tabIndex={0} role="region" aria-label="Chi tiết chuyên cần"><table>
          <thead><tr><th scope="col">Ngày</th><th scope="col">Lớp</th><th scope="col">Mã</th><th scope="col">Học viên</th><th scope="col">Trạng thái</th></tr></thead>
          <tbody>{data.map((row, index) => <tr key={index}><td>{formatDay(row.lesson_date)}</td><td>{row.class_name}</td>
            <td>{row.student_code}</td><td>{row.student_name}</td><td><Badge status={row.status} /></td></tr>)}</tbody>
        </table></div> : <Empty>Chưa có điểm danh đã chốt trong bộ lọc.</Empty>}
        <Pager {...pagination} change={page => {
          filters.set('page', String(page))
          setParams(filters)
        }} />
      </Panel>
    }}</LoadView>
  </>
}
