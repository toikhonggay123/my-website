import { useEffect, useState, type CSSProperties } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, BellRing, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Link2, MapPin, Moon, Search, Smartphone, Sun, X,
} from 'lucide-react'
import { basePath, formatDay, localDay, studentTimetablePath, useLoad } from './ui'
import { dayNames, moveDate, periodsForWeek, shifts, studentTimetable, weekStart, type Period } from './student-timetable-data'
import './edu.css'
import './student-timetable.css'

// Student page. A school that published its timetable is read live from the public API (no sign-in, no
// personal data); otherwise the page shows published-timetable.json or the sample. First visit: pick the
// class once. Later visits open straight on the class, on the period happening now, or on the next school
// day once today's periods are over.

type LivePeriod = Period & { cancelled?: boolean }
type ClassOption = { id: string; grade: number; name: string }
type Live = { enabled: true; school: string; slug: string; today: string; monday: string; notices: { date: string; text: string }[]
  classes: ClassOption[]; timetable: null | { id: string; name: string; grade: number; published: boolean; periods: LivePeriod[] } }
type Remote = { enabled: false } | Live

const normalize = (text: string) => text.toLowerCase().replace(/đ/g, 'd').normalize('NFD').replace(/\p{M}/gu, '').replace(/^lop\s*/, '').replace(/[^a-z0-9]/g, '')
const clockFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
const hintKey = 'classhub:hs:home-hint'
function storage(key: string, value?: string) {
  try {
    if (value === undefined) return localStorage.getItem(key)
    localStorage.setItem(key, value)
  } catch { /* The URL still holds the selection. */ }
  return null
}
function useClock() {
  const [now, setNow] = useState(() => clockFormat.format(new Date()))
  useEffect(() => {
    const timer = setInterval(() => setNow(clockFormat.format(new Date())), 30_000)
    return () => clearInterval(timer)
  }, [])
  return now
}
const relativeDay = (date: string, today: string) => date === today ? 'Hôm nay' : date === moveDate(today, 1) ? 'Ngày mai'
  : dayNames[(new Date(date + 'T00:00:00Z').getUTCDay() + 6) % 7] + (date > moveDate(weekStart(today), 6) ? ' tuần sau' : '')

/* ------------------------------------------------------------------ Class picker */

function Picker({ classes, school, current, choose, cancel, slug }: {
  classes: ClassOption[]; school: string; current?: ClassOption; choose: (row: ClassOption) => void; cancel?: () => void; slug: string
}) {
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const grades = [...new Set(classes.map(item => item.grade))]
  const requested = Number(params.get('khoi'))
  const grade = grades.includes(requested) ? requested : current?.grade ?? grades[0]
  const term = normalize(search)
  const matches = classes.filter(row => term ? normalize(row.name).includes(term) : row.grade === grade)
  return <section className="st-picker edu-page" aria-labelledby="choose-class">
    {cancel && <button type="button" className="st-back" onClick={cancel}><ArrowLeft size={17} aria-hidden="true" /> Lớp {current?.name}</button>}
    <p className="edu-eyebrow">{school}</p>
    <h1 id="choose-class">Em học lớp nào?</h1>
    <label className="st-search"><Search size={18} aria-hidden="true" /><span className="sr-only">Tìm lớp</span>
      <input type="search" placeholder="Tìm lớp, ví dụ 8A" value={search} onChange={event => setSearch(event.target.value)} /></label>
    {!term && <div className="st-grades" role="group" aria-label="Chọn khối">
      {grades.map(number => <button key={number} type="button" className="edu-press" aria-pressed={number === grade}
        onClick={() => setParams(slug ? { truong: slug, khoi: String(number) } : { khoi: String(number) })}>
        {number ? 'Khối ' + number : 'Lớp khác'}</button>)}
    </div>}
    <div key={term + grade} className="st-classes" role="group" aria-label={term ? 'Kết quả tìm lớp' : 'Lớp thuộc khối ' + grade}>
      {matches.map((row, index) => <button key={row.id} type="button" className="edu-card edu-press edu-rise" style={{ '--i': index } as CSSProperties}
        aria-pressed={current?.id === row.id} onClick={() => choose(row)}>Lớp {row.name}</button>)}
      {!matches.length && <p className="st-empty">Chưa tìm thấy lớp phù hợp.</p>}
    </div>
    <p className="edu-muted st-note">Máy này sẽ nhớ lớp cho lần sau.</p>
  </section>
}

/* ------------------------------------------------------------------ Day view */

function Hero({ rows, day, today, now, cancelledDay, closedText }: {
  rows: LivePeriod[]; day: string; today: string; now: string; cancelledDay: boolean; closedText?: string
}) {
  const open = rows.filter(row => !row.cancelled && row.start).sort((a, b) => a.start.localeCompare(b.start))
  if (closedText || cancelledDay || !open.length) {
    return <div className="st-hero st-hero-rest edu-rise">
      <Moon size={22} aria-hidden="true" />
      <p className="st-hero-kicker">{relativeDay(day, today)}</p>
      <p className="st-hero-title">{closedText ? 'Nghỉ học' : cancelledDay ? 'Lớp nghỉ' : 'Không có tiết'}</p>
      {closedText && <p className="st-hero-sub">{closedText}</p>}
    </div>
  }
  if (day === today) {
    const current = open.find(row => row.start <= now && now < row.end)
    if (current) {
      const progress = Math.min(100, Math.max(0, (minutes(now) - minutes(current.start)) / Math.max(1, minutes(current.end) - minutes(current.start)) * 100))
      return <div className="st-hero st-hero-now edu-rise" aria-live="polite">
        <p className="st-hero-kicker"><span className="st-live edu-live-dot" aria-hidden="true" /> Đang học · đến {current.end}</p>
        <p className="st-hero-title">Tiết {current.number} · {current.subject}</p>
        {current.room && <p className="st-hero-sub"><MapPin size={15} aria-hidden="true" /> {current.room}</p>}
        <div className="st-progress" role="progressbar" aria-label="Thời gian đã học của tiết" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
          <i style={{ width: progress + '%' }} /></div>
      </div>
    }
    const next = open.find(row => row.start > now)
    if (next) return <div className="st-hero st-hero-next edu-rise">
      <p className="st-hero-kicker"><Clock3 size={15} aria-hidden="true" /> {open[0] === next ? 'Tiết đầu hôm nay' : 'Tiết tiếp theo'} lúc {next.start}</p>
      <p className="st-hero-title">Tiết {next.number} · {next.subject}</p>
      {next.room && <p className="st-hero-sub"><MapPin size={15} aria-hidden="true" /> {next.room}</p>}
    </div>
  }
  const morning = open.filter(row => row.shift === 'morning').length
  const afternoon = open.length - morning
  return <div className="st-hero st-hero-next edu-rise">
    <p className="st-hero-kicker"><Sun size={15} aria-hidden="true" /> {relativeDay(day, today)} · bắt đầu {open[0].start}</p>
    <p className="st-hero-title">{[morning ? morning + ' tiết sáng' : '', afternoon ? afternoon + ' tiết chiều' : ''].filter(Boolean).join(', ')}</p>
    <p className="st-hero-sub">{[...new Set(open.map(row => row.subject))].slice(0, 5).join(' · ')}</p>
  </div>
}

function PeriodList({ rows, live, now }: { rows: LivePeriod[]; live: boolean; now: string }) {
  const ordered = [...rows].sort((a, b) => a.start.localeCompare(b.start))
  if (!ordered.length) return <p className="st-empty">Không có tiết học ngày này.</p>
  return <>{Object.entries(shifts).map(([id, label]) => {
    const group = ordered.filter(row => row.shift === id)
    if (!group.length) return null
    const off = group.every(row => row.cancelled)
    return <section className="st-shift" key={id}>
      <h3>{label} <span>· {off ? 'Nghỉ' : group.length + ' tiết'}</span></h3>
      <ol>{group.map((row, index) => {
        const state = row.cancelled ? 'off' : !live ? '' : row.end <= now ? 'done' : row.start <= now ? 'now' : ''
        return <li key={row.number} className={'st-period edu-rise' + (state ? ' is-' + state : '')} style={{ '--i': index } as CSSProperties}>
          <span className="st-period-number">Tiết {row.number}</span>
          <span className="st-period-main"><strong>{row.subject}</strong>
            <time dateTime={row.start}>{row.start}–{row.end}</time>{row.room && <small>{row.room}</small>}</span>
          {state === 'now' && <span className="st-tag is-now">Đang học</span>}
          {state === 'done' && <span className="st-tag is-done"><Check size={13} aria-hidden="true" /> Xong</span>}
          {state === 'off' && <span className="st-tag is-off">Nghỉ</span>}
        </li>
      })}</ol>
    </section>
  })}</>
}

function HomeHint() {
  const [open, setOpen] = useState(() => !storage(hintKey) && !window.matchMedia?.('(display-mode: standalone)').matches)
  if (!open) return null
  const apple = /iphone|ipad|ipod/i.test(navigator.userAgent)
  return <aside className="st-hint edu-card edu-rise" style={{ '--i': 4 } as CSSProperties}>
    <Smartphone size={20} aria-hidden="true" />
    <p><strong>Mở nhanh như ứng dụng</strong><span>{apple ? 'Bấm Chia sẻ rồi chọn "Thêm vào MH chính".' : 'Bấm menu ⋮ của trình duyệt rồi chọn "Thêm vào màn hình chính".'}</span></p>
    <button type="button" aria-label="Ẩn gợi ý" onClick={() => { storage(hintKey, '1'); setOpen(false) }}><X size={16} aria-hidden="true" /></button>
  </aside>
}

/* ------------------------------------------------------------------ Page */

export function StudentTimetable() {
  const [params, setParams] = useSearchParams()
  const slug = params.get('truong')?.trim().toLowerCase() || ''
  const savedKey = 'classhub:student-class' + (slug ? ':' + slug : '')
  const today = localDay()
  const now = useClock()
  const [remembered, setRemembered] = useState(() => storage(savedKey))
  const requestedDay = /^\d{4}-\d{2}-\d{2}$/.test(params.get('ngay') ?? '') ? params.get('ngay')! : null
  const [day, setDay] = useState(requestedDay ?? today)
  const [manual, setManual] = useState(Boolean(requestedDay))
  const [view, setView] = useState<'day' | 'week'>('day')
  const [picking, setPicking] = useState(false)
  const [share, setShare] = useState('')
  const monday = weekStart(day)
  const asked = params.has('lop') ? params.get('lop')?.trim().toLowerCase() ?? '' : null
  const browsing = params.has('khoi')
  const id = asked ?? (browsing ? null : remembered)
  const query = new URLSearchParams({ tuan: monday })
  if (slug) query.set('truong', slug)
  if (id) query.set('lop', id)
  const remote = useLoad<{ data: Remote }>('/api/v1/public/timetable?' + query)
  const [last, setLast] = useState<Remote>()
  useEffect(() => { if (remote.value) setLast(remote.value.data) }, [remote.value])
  const data = remote.value?.data ?? last
  const live = data?.enabled ? data : null
  const deciding = !data && !remote.error
  const classes: ClassOption[] = live ? live.classes : slug ? [] : studentTimetable.classes
  const item = classes.find(row => row.id === id)
  const staticItem = !live && item ? studentTimetable.classes.find(row => row.id === item.id) : undefined
  const rows: LivePeriod[] | null | undefined = live
    ? (live.timetable && live.timetable.id === item?.id && live.monday === monday ? (live.timetable.published ? live.timetable.periods : null) : undefined)
    : staticItem ? periodsForWeek(staticItem, monday) : null
  const days = Array.from({ length: 7 }, (_, index) => moveDate(monday, index))
  const dayRows = rows?.filter(row => row.date === day) ?? []
  const notices = live?.notices ?? []
  const closure = notices.find(notice => notice.date === day && notice.text.includes('nghỉ học'))
  const school = live?.school ?? (studentTimetable.sample ? 'Lịch mẫu · Khối 6 đến 9' : studentTimetable.school)

  // Once today's periods are over (or on a day off), move to the next school day, once, unless the
  // student already picked a day themselves.
  useEffect(() => {
    if (manual || !rows || day !== today) return
    const open = (date: string) => rows.some(row => row.date === date && !row.cancelled)
    const finished = !rows.some(row => row.date === today && !row.cancelled && row.end > now)
    if (!finished) return
    const next = days.find(date => date > today && open(date))
    setManual(true)
    if (next) setDay(next)
    else if (weekdayIndex(today) >= 4) setDay(moveDate(monday, 7))
  }, [rows, day])

  function choose(row: ClassOption) {
    setShare('')
    setRemembered(row.id)
    storage(savedKey, row.id)
    setPicking(false)
    setParams(slug ? { truong: slug, lop: row.id } : { lop: row.id })
  }
  function pick(date: string) { setManual(true); setDay(date) }
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

  const header = <header className="st-top edu-glass-bar">
    <Link className="st-brand" to="/" aria-label="AFYLLX Edu ClassHub">
      <span className="st-mark"><img src={basePath + '/afyllx-edu-mark.png'} width={30} height={20} alt="" /></span>
      <span><strong>{item && !picking ? 'Lớp ' + item.name : 'Thời khóa biểu'}</strong><small>{school}</small></span>
    </Link>
    {item && !picking && <button type="button" className="st-switch edu-press" onClick={() => setPicking(true)}>Đổi lớp</button>}
  </header>

  return <div className="edu st">
    <a className="skip" href="#student-main">Đến thời khóa biểu</a>
    {header}
    <main id="student-main" className="st-main">
      {deciding ? <div className="st-loading" role="status"><span className="edu-skeleton" /><span className="edu-skeleton" /><span className="sr-only">Đang tải thời khóa biểu…</span></div>
        : !live && slug ? <p className="st-empty edu-card" role="status">
          {remote.error ?? 'Trường này chưa công bố thời khóa biểu cho học sinh. Hãy hỏi lại thầy cô link đúng.'}</p>
        : !item || picking ? <>
          {params.has('lop') && !item && <p className="st-empty" role="status">Link này không khớp với lớp hiện có. Chọn lại lớp bên dưới.</p>}
          <Picker classes={classes} school={school} current={item} choose={choose} slug={slug} cancel={item ? () => setPicking(false) : undefined} />
        </> : <div className="edu-page st-class" key={item.id}>
          <h1 className="sr-only">Lịch lớp {item.name}</h1>
          {notices.length > 0 && <ul className="st-notices" aria-label="Thông báo">
            {notices.map((notice, index) => <li key={index} className="edu-rise" style={{ '--i': index } as CSSProperties}>
              <BellRing size={17} aria-hidden="true" /> <span>{notice.text}</span></li>)}
          </ul>}
          {rows === undefined ? <span className="edu-skeleton st-hero-skeleton" role="status" aria-label="Đang tải" />
            : rows === null ? <div className="st-hero st-hero-rest edu-rise"><CalendarDays size={22} aria-hidden="true" />
              <p className="st-hero-title">Tuần này chưa có thời khóa biểu</p><p className="st-hero-sub">Nhà trường chưa công bố lịch cho tuần {formatDay(monday)}.</p></div>
            : view === 'day' && <Hero key={day} rows={dayRows} day={day} today={today} now={now}
              cancelledDay={dayRows.length > 0 && dayRows.every(row => row.cancelled)} closedText={closure?.text.split('·').at(-1)?.trim()} />}

          <div className="st-toolbar">
            <div className="st-week-nav" role="group" aria-label="Chuyển tuần">
              <button type="button" className="edu-press" aria-label="Tuần trước" onClick={() => pick(moveDate(day, -7))}><ChevronLeft size={18} aria-hidden="true" /></button>
              <span><CalendarDays size={15} aria-hidden="true" /> {formatDay(monday).slice(0, 5)} – {formatDay(days[6])}</span>
              <button type="button" className="edu-press" aria-label="Tuần sau" onClick={() => pick(moveDate(day, 7))}><ChevronRight size={18} aria-hidden="true" /></button>
            </div>
            <div className="st-views" role="group" aria-label="Cách xem">
              <button type="button" aria-pressed={view === 'day'} onClick={() => setView('day')}>Theo ngày</button>
              <button type="button" aria-pressed={view === 'week'} onClick={() => setView('week')}>Cả tuần</button>
            </div>
          </div>
          {day !== today && <button type="button" className="text-button st-today" onClick={() => { pick(today) }}>Về hôm nay</button>}

          {view === 'day' ? <>
            <div className="st-days" role="group" aria-label="Chọn ngày trong tuần">
              {days.map((date, index) => <button key={date} type="button" className="edu-press"
                aria-label={dayNames[index] + ' ' + formatDay(date)} aria-current={date === today ? 'date' : undefined}
                aria-pressed={date === day} onClick={() => pick(date)}>
                <span>{index === 6 ? 'CN' : 'T' + (index + 2)}</span><strong>{date.slice(-2)}</strong>
                {rows?.some(row => row.date === date && !row.cancelled) && <i aria-hidden="true" />}
              </button>)}
            </div>
            <p className="st-count" role="status">{rows === undefined ? 'Đang tải…' : rows === null ? 'Tuần này chưa có thời khóa biểu được công bố.'
              : dayNames[days.indexOf(day)] + ', ' + formatDay(day) + ' · ' + dayRows.filter(row => !row.cancelled).length + ' tiết'}</p>
            {rows && <div key={day} className="edu-page"><PeriodList rows={dayRows} live={day === today} now={now} /></div>}
          </> : <>
            <p className="st-count" role="status">{rows ? rows.filter(row => !row.cancelled).length + ' tiết trong tuần' : rows === null ? 'Tuần này chưa có thời khóa biểu được công bố.' : 'Đang tải…'}</p>
            {rows && <div className="st-week">{days.map((date, index) => {
              const list = rows.filter(row => row.date === date)
              if (!list.length && index > 4) return null
              return <section key={date} className={'st-week-day edu-card edu-rise' + (date === today ? ' is-today' : '')} style={{ '--i': index } as CSSProperties}>
                <h2>{dayNames[index]} <small>{formatDay(date)}</small></h2>
                <PeriodList rows={list} live={date === today} now={now} />
              </section>
            })}</div>}
          </>}

          <div className="st-share">
            <button type="button" className="text-button" onClick={copy}><Link2 size={16} aria-hidden="true" /> Sao chép link lớp</button>
            {share && <p className="st-feedback" role="status">{share}</p>}
          </div>
          <HomeHint />
        </div>}
    </main>
  </div>
}

function weekdayIndex(date: string) { return (new Date(date + 'T00:00:00Z').getUTCDay() + 6) % 7 }
