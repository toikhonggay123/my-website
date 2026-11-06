import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarDays, ChevronLeft, ChevronRight, Info, Link2, Search } from 'lucide-react'
import { basePath, formatDay, localDay, studentTimetablePath, useLoad } from './ui'
import { dayNames, moveDate, periodsForWeek, shifts, studentTimetable, weekStart, type Period } from './student-timetable-data'
import './student-timetable.css'

// Public student timetable. A school that published its timetable in ClassHub is read live from the public
// API (no sign-in, no personal data). Without one, the page shows the timetable prepared in
// published-timetable.json, or the sample.

type LivePeriod = Period & { cancelled?: boolean }
type ClassOption = { id: string; grade: number; name: string }
type Live = { enabled: true; school: string; slug: string; today: string; monday: string; notices: { date: string; text: string }[]
  classes: ClassOption[]; timetable: null | { id: string; name: string; grade: number; published: boolean; periods: LivePeriod[] } }
type Remote = { enabled: false } | Live

const normalize = (text: string) => text.toLowerCase().replace(/đ/g, 'd').normalize('NFD').replace(/\p{M}/gu, '').replace(/^lop\s*/, '').replace(/[^a-z0-9]/g, '')
const clock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
function storage(key: string, value?: string) {
  try {
    if (value === undefined) return localStorage.getItem(key)
    localStorage.setItem(key, value)
  } catch { /* The URL still holds the selection. */ }
  return null
}

function PeriodList({ rows, current }: { rows: LivePeriod[]; current?: LivePeriod }) {
  const ordered = [...rows].sort((a, b) => a.start.localeCompare(b.start))
  return ordered.length ? Object.entries(shifts).map(([id, label]) => {
    const group = ordered.filter(row => row.shift === id)
    if (!group.length) return null
    const off = group.every(row => row.cancelled)
    return <div className="student-shift" key={id}>
      <h3>{label} <span>· {off ? 'Nghỉ' : group.length + ' tiết'}</span></h3>
      <ul>{group.map(row => <li key={row.number} className={row === current ? 'student-current' : row.cancelled ? 'student-cancelled' : undefined}>
        <strong className="period-number">Tiết {row.number}</strong>
        <span><strong>{row.subject}</strong>{row.room && <small>{row.room}</small>}{row.cancelled && <small className="student-off">Nghỉ</small>}</span>
        <time dateTime={row.start}>{row.start}–{row.end}</time>
      </li>)}</ul>
    </div>
  }) : <p className="student-empty">Không có tiết học ngày này.</p>
}

function nowLine(rows: LivePeriod[]) {
  const time = clock.format(new Date())
  const open = rows.filter(row => !row.cancelled && row.start).sort((a, b) => a.start.localeCompare(b.start))
  const current = open.find(row => row.start <= time && time < row.end)
  if (current) return { current, text: 'Đang học tiết ' + current.number + ' · ' + current.subject + ' · đến ' + current.end }
  const next = open.find(row => row.start > time)
  if (next) return { current: next, text: 'Tiết tiếp theo: tiết ' + next.number + ' · ' + next.subject + ' lúc ' + next.start }
  return { current: undefined, text: open.length ? 'Đã hết tiết hôm nay.' : '' }
}

export function StudentTimetable() {
  const [params, setParams] = useSearchParams()
  const slug = params.get('truong')?.trim().toLowerCase() || ''
  const savedKey = 'classhub:student-class' + (slug ? ':' + slug : '')
  const [remembered, setRemembered] = useState(() => storage(savedKey))
  const [day, setDay] = useState(localDay)
  const [view, setView] = useState<'day' | 'week'>('day')
  const [search, setSearch] = useState('')
  const [share, setShare] = useState('')
  const monday = weekStart(day)
  const requestedGrade = Number(params.get('khoi'))
  const asked = params.has('lop') ? params.get('lop')?.trim().toLowerCase() ?? '' : null
  const query = new URLSearchParams({ tuan: monday })
  if (slug) query.set('truong', slug)
  const pendingId = asked ?? (requestedGrade ? null : remembered)
  if (pendingId) query.set('lop', pendingId)
  const remote = useLoad<{ data: Remote }>('/api/v1/public/timetable?' + query)
  const [last, setLast] = useState<Remote>()
  useEffect(() => { if (remote.value) setLast(remote.value.data) }, [remote.value])
  const data = remote.value?.data ?? last
  const live = data?.enabled ? data : null
  const deciding = !data && !remote.error

  const classes: ClassOption[] = live ? live.classes : slug ? [] : studentTimetable.classes
  const gradeNumbers = [...new Set(classes.map(item => item.grade))]
  const browsingGrade = gradeNumbers.includes(requestedGrade) ? requestedGrade : null
  const id = asked ?? (browsingGrade ? null : remembered)
  const item = classes.find(row => row.id === id)
  const grade = item?.grade ?? browsingGrade ?? gradeNumbers[0]
  const today = localDay()
  const days = Array.from({ length: 7 }, (_, index) => moveDate(monday, index))
  const staticItem = !live && item ? studentTimetable.classes.find(row => row.id === item.id) : undefined
  const liveRows = live?.timetable && live.timetable.id === item?.id && live.monday === monday
    ? (live.timetable.published ? live.timetable.periods : null) : undefined
  const rows: LivePeriod[] | null | undefined = live ? liveRows : staticItem ? periodsForWeek(staticItem, monday) : null
  const dayRows = rows?.filter(row => row.date === day) ?? []
  const now = day === today && rows ? nowLine(dayRows) : null
  const term = normalize(search)
  const matches = classes.filter(row => term ? normalize(row.name).includes(term) : row.grade === grade)
  const notices = live?.notices ?? []

  function select(row: ClassOption) {
    setSearch('')
    setShare('')
    setRemembered(row.id)
    storage(savedKey, row.id)
    setParams(slug ? { truong: slug, lop: row.id } : { lop: row.id })
  }
  async function copy() {
    if (!item) return
    const link = new URL(basePath + studentTimetablePath, window.location.origin)
    if (live) link.searchParams.set('truong', live.slug)
    link.searchParams.set('lop', item.id)
    try {
      await navigator.clipboard.writeText(link.href)
      setShare('Đã sao chép link lớp ' + item.name + '.')
    } catch { setShare(link.href) }
  }

  return <div className="student-page">
    <a className="skip" href="#student-main">Đến thời khóa biểu</a>
    <header className="student-top">
      <div className="student-brand">
        <img src={basePath + '/afyllx-edu-mark.png'} width={36} height={26} alt="" />
        <span><strong>AFYLLX Edu</strong><small>Thời khóa biểu</small></span>
      </div>
    </header>
    <main id="student-main" className="student-main">
      <header className="student-title">
        <p className="eyebrow">Dành cho học sinh</p>
        <h1>Thời khóa biểu</h1>
        <p>{live ? live.school : deciding ? 'Đang tải…' : slug ? 'Chưa công bố'
          : studentTimetable.sample ? 'Lịch mẫu để thử tra cứu · Khối 6 đến khối 9' : studentTimetable.school}</p>
      </header>
      {deciding ? <p className="panel student-empty" role="status">Đang tải thời khóa biểu…</p>
        : !live && slug ? <p className="panel student-empty" role="status">
          {remote.error ?? 'Trường này chưa công bố thời khóa biểu cho học sinh. Hãy hỏi lại thầy cô link đúng.'}</p>
        : <>
          <section className="panel student-choose" aria-labelledby="choose-class">
            <div className="student-choose-head">
              <h2 id="choose-class">Chọn lớp của em</h2>
              <label className="student-search"><Search size={17} aria-hidden="true" /><span className="sr-only">Tìm lớp</span>
                <input type="search" placeholder="Tìm lớp, ví dụ 8A" value={search} onChange={event => setSearch(event.target.value)} />
              </label>
            </div>
            {!term && <div className="student-choices" role="group" aria-label="Chọn khối">
              {gradeNumbers.map(number => <button key={number} type="button" aria-pressed={number === grade}
                onClick={() => { if (number !== grade) setParams(slug ? { truong: slug, khoi: String(number) } : { khoi: String(number) }) }}>
                {number ? 'Khối ' + number : 'Lớp khác'}</button>)}
            </div>}
            <div className="student-choices student-classes" role="group" aria-label={term ? 'Kết quả tìm lớp' : 'Lớp thuộc khối ' + grade}>
              {matches.map(row => <button key={row.id} type="button" aria-pressed={item?.id === row.id}
                onClick={() => select(row)}>Lớp {row.name}</button>)}
              {!matches.length && <p className="student-empty">Chưa tìm thấy lớp phù hợp.</p>}
            </div>
          </section>
          {item ? <section className="panel student-calendar" aria-labelledby="class-schedule">
            <div className="student-calendar-head">
              <div><p className="eyebrow">{item.grade ? 'Khối ' + item.grade : 'Lớp'}</p><h2 id="class-schedule">Lịch lớp {item.name}</h2></div>
              <button type="button" onClick={copy}><Link2 size={17} aria-hidden="true" /> Sao chép link lớp</button>
            </div>
            {share && <p className="student-feedback" role="status">{share}</p>}
            {notices.length > 0 && <ul className="student-notices" aria-label="Thông báo">
              {notices.map((notice, index) => <li key={index}><Info size={16} aria-hidden="true" /> {notice.text}</li>)}
            </ul>}
            <div className="student-calendar-tools">
              <div className="student-choices" role="group" aria-label="Cách xem thời khóa biểu">
                <button type="button" aria-pressed={view === 'day'} onClick={() => setView('day')}>Theo ngày</button>
                <button type="button" aria-pressed={view === 'week'} onClick={() => setView('week')}>Theo tuần</button>
              </div>
              <div className="student-week-controls" role="group" aria-label="Chuyển tuần">
                <button type="button" aria-label="Tuần trước" onClick={() => setDay(moveDate(day, -7))}><ChevronLeft size={18} aria-hidden="true" /></button>
                <button type="button" onClick={() => { setDay(today); setView('day') }}>Hôm nay</button>
                <button type="button" aria-label="Tuần sau" onClick={() => setDay(moveDate(day, 7))}><ChevronRight size={18} aria-hidden="true" /></button>
              </div>
            </div>
            <p className="student-week"><CalendarDays size={17} aria-hidden="true" /> {formatDay(monday)} – {formatDay(days[6])}</p>
            {view === 'day' && <div className="student-days" role="group" aria-label="Chọn ngày trong tuần">
              {days.map((date, index) => <button key={date} type="button" aria-label={dayNames[index] + ' ' + formatDay(date)}
                aria-current={date === today ? 'date' : undefined} aria-pressed={date === day} onClick={() => setDay(date)}>
                <span>{index === 6 ? 'CN' : 'T' + (index + 2)}</span><strong>{date.slice(-2)}</strong>
              </button>)}
            </div>}
            {now?.text && view === 'day' && <p className="student-now" role="status">{now.text}</p>}
            <p className="student-count" role="status">{rows === undefined ? 'Đang tải…' : rows === null ? 'Tuần này chưa có thời khóa biểu được công bố.' :
              view === 'day' ? dayNames[days.indexOf(day)] + ', ' + formatDay(day) + ' · ' + dayRows.filter(row => !row.cancelled).length + ' tiết'
                : rows.filter(row => !row.cancelled).length + ' tiết trong tuần'}</p>
            {rows && (view === 'day' ? <PeriodList rows={dayRows} current={now?.current} /> : <div className="student-week-list">
              {days.map((date, index) => <section key={date} className="student-week-day">
                <h3>{dayNames[index]} · {formatDay(date)}</h3><PeriodList rows={rows.filter(row => row.date === date)} />
              </section>)}
            </div>)}
          </section> : <p className="panel student-empty" role="status">
            {params.has('lop') ? 'Link này không khớp với lớp hiện có. Chọn lại lớp ở trên.' : 'Chọn lớp để xem số tiết, môn học, giờ học và phòng.'}
          </p>}
        </>}
    </main>
  </div>
}
