import { useEffect, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AlertTriangle, ClipboardPaste, RefreshCw, Send, Trash2 } from 'lucide-react'
import {
  ActionForm, Cancelled, Empty, Field, Header, LoadView, Notice, Panel, addDays, basePath, confirmOrCancel, errorText,
  formatDay, send, studentTimetablePath, useLoad, value,
} from './ui'
import type { WorkspaceProps } from './operations'
import './school.css'

type Shift = 'morning' | 'afternoon'
type Term = { id: string; name: string; starts_on: string; ends_on: string }
type Subject = { id: string; name: string; short_name: string; archived: number }
type Bell = { shift: Shift; period: number; starts_at: string; ends_at: string }
type Closure = { closed_on: string; reason: string }
type Setup = { today: string; terms: Term[]; subjects: Subject[]; bells: Bell[]; closures: Closure[]; default_bells: Bell[]
  public_slug: string | null }
type SchoolClass = { id: string; code: string; name: string; status: string; room: string; grade: string | null
  homeroom_id: string | null; homeroom_name: string | null }
type Teacher = { id: string; name: string }
type Assignment = { class_id: string; subject_id: string; user_id: string; teacher_name: string }
type VersionRow = { id: string; status: 'draft' | 'published' | 'archived'; effective_from: string | null
  updated_at: number; published_at: number | null; published_by: string | null; classes: number }
type SlotRow = { class_id: string; weekday: number; shift: Shift; period: number; subject_id: string; room: string
  teacher_id: string | null; teacher_name: string | null }
type Clash = { teacher_name: string; weekday: number; shift: Shift; period: number; classes: string[] }
type Sheet = { slots: SlotRow[]; clashes: Clash[]; unassigned: { class_name: string; subject_name: string }[] }
type SyncSummary = { created: number; updated: number; cancelled: number; failures: { class_name: string; message: string }[] }

const shiftLabel: Record<Shift, string> = { morning: 'Sáng', afternoon: 'Chiều' }
const weekdays = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']
const schoolDays = [1, 2, 3, 4, 5, 6]
const cellKey = (weekday: number, shift: Shift, period: number) => weekday + ':' + shift + ':' + period
const classOrder = new Intl.Collator('vi', { numeric: true })
const byName = <T extends { name: string }>(list: T[]) => [...list].sort((a, b) => classOrder.compare(a.name, b.name))
const sortBells = (list: Bell[]) => [...list].sort((a, b) => (a.shift === b.shift ? 0 : a.shift === 'morning' ? -1 : 1) || a.period - b.period)
const normalize = (text: string) => text.toLowerCase().replace(/đ/g, 'd').normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]/g, '')
const clock = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' })
function addMinutes(time: string, minutes: number) {
  const total = Math.min(23 * 60 + 59, Number(time.slice(0, 2)) * 60 + Number(time.slice(3)) + minutes)
  return String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0')
}
async function quietly(action: () => Promise<unknown>, fail: (message: string) => void) {
  try { await action() } catch (error) { if (!(error instanceof Cancelled)) fail(errorText(error)) }
}

function SyncResult({ sync }: { sync?: SyncSummary }) {
  if (!sync) return null
  return <div className="school-sync" role="status">
    <p>Buổi điểm danh: tạo mới {sync.created} · cập nhật {sync.updated} · hủy {sync.cancelled}.</p>
    {sync.failures.length > 0 && <ul className="school-issues">
      {sync.failures.map((failure, index) => <li key={index}><strong>{failure.class_name}</strong>: {failure.message}</li>)}
    </ul>}
  </div>
}

/* ------------------------------------------------------------------ Settings */

function suggestedTerm(terms: Term[], today: string): Term {
  const last = terms.at(-1)
  if (last) {
    const starts = addDays(last.ends_on, 1)
    const year = Number(starts.slice(0, 4)) + (starts.slice(5) > '05-31' ? 1 : 0)
    return { id: '', name: '', starts_on: starts, ends_on: year + '-05-31' }
  }
  const year = Number(today.slice(0, 4)) - (Number(today.slice(5, 7)) < 8 ? 1 : 0)
  return { id: '', name: 'Học kỳ I ' + year + '–' + (year + 1), starts_on: year + '-09-05', ends_on: (year + 1) + '-01-17' }
}
const termForm = (data: FormData) => ({ name: value(data, 'name'), starts_on: value(data, 'starts_on'), ends_on: value(data, 'ends_on') })
function TermFields({ term }: { term: Term }) {
  return <>
    <Field label="Tên học kỳ"><input name="name" defaultValue={term.name} maxLength={80} required placeholder="Học kỳ II 2026–2027" /></Field>
    <Field label="Từ ngày"><input type="date" name="starts_on" defaultValue={term.starts_on} required /></Field>
    <Field label="Đến ngày"><input type="date" name="ends_on" defaultValue={term.ends_on} required /></Field>
  </>
}
function TermsPanel({ api, setup, saved }: { api: string; setup: Setup; saved: (message: string) => void }) {
  return <Panel title="Học kỳ">
    {setup.terms.length ? <div className="list">{setup.terms.map(term => <details className="detail-row" key={term.id}>
      <summary><strong>{term.name}</strong><span>{formatDay(term.starts_on)} – {formatDay(term.ends_on)}</span></summary>
      <ActionForm reset={false} action={data => send(api + '/school/terms/' + term.id, termForm(data), 'PATCH')}
        onSaved={() => saved('Đã lưu học kỳ.')}><TermFields term={term} /></ActionForm>
    </details>)}</div> : <p className="muted">Thời khóa biểu và buổi điểm danh gắn với học kỳ. Hãy thêm học kỳ đang học.</p>}
    <h3 className="school-subhead">Thêm học kỳ</h3>
    <ActionForm key={setup.terms.length} label="Thêm học kỳ" action={data => send(api + '/school/terms', termForm(data))}
      onSaved={() => saved('Đã thêm học kỳ.')}><TermFields term={suggestedTerm(setup.terms, setup.today)} /></ActionForm>
  </Panel>
}

const subjectForm = (data: FormData) => ({ name: value(data, 'name'), short_name: value(data, 'short_name') })
function SubjectFields({ subject }: { subject?: Subject }) {
  return <>
    <Field label="Tên môn"><input name="name" defaultValue={subject?.name} maxLength={80} required /></Field>
    <Field label="Tên ngắn trên thời khóa biểu"><input name="short_name" defaultValue={subject?.short_name} maxLength={20} /></Field>
  </>
}
function SubjectsPanel({ api, setup, saved }: { api: string; setup: Setup; saved: (message: string) => void }) {
  return <Panel title="Môn học">
    {!setup.subjects.length && <ActionForm grid={false} label="Thêm bộ môn THCS" action={() => send(api + '/school/subjects/defaults', {})}
      onSaved={() => saved('Đã thêm các môn THCS. Có thể sửa tên hoặc ẩn môn không dùng.')}>
      <p className="muted">Thêm nhanh 15 môn theo chương trình THCS, gồm cả Chào cờ và Sinh hoạt lớp.</p>
    </ActionForm>}
    {setup.subjects.length > 0 && <div className="list">{setup.subjects.map(subject => <details className="detail-row" key={subject.id}>
      <summary><strong>{subject.name}</strong><span>{subject.short_name}</span>{Boolean(subject.archived) && <span className="badge">Đã ẩn</span>}</summary>
      <ActionForm reset={false} onSaved={() => saved('Đã lưu môn học.')}
        action={data => send(api + '/school/subjects/' + subject.id, { ...subjectForm(data), archived: data.has('archived') }, 'PATCH')}>
        <SubjectFields subject={subject} />
        <label className="check"><input type="checkbox" name="archived" defaultChecked={Boolean(subject.archived)} /> Ẩn khỏi thời khóa biểu mới</label>
      </ActionForm>
    </details>)}</div>}
    <h3 className="school-subhead">Thêm môn</h3>
    <ActionForm label="Thêm môn" action={data => send(api + '/school/subjects', subjectForm(data))} onSaved={() => saved('Đã thêm môn học.')}>
      <SubjectFields />
    </ActionForm>
  </Panel>
}

function BellsPanel({ api, setup, saved }: { api: string; setup: Setup; saved: (message: string) => void }) {
  const [rows, setRows] = useState(sortBells(setup.bells.length ? setup.bells : setup.default_bells))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const update = (target: Bell, field: 'starts_at' | 'ends_at', time: string) =>
    setRows(old => old.map(row => row === target ? { ...row, [field]: time } : row))
  function add(shift: Shift) {
    setRows(old => {
      const last = old.filter(row => row.shift === shift).at(-1)
      const starts = last ? addMinutes(last.ends_at, 5) : shift === 'morning' ? '07:00' : '13:30'
      return sortBells([...old, { shift, period: (last?.period ?? 0) + 1, starts_at: starts, ends_at: addMinutes(starts, 45) }])
    })
  }
  async function save() {
    setBusy(true)
    setError('')
    try {
      await send(api + '/school/bells', { periods: rows }, 'PUT')
      saved('Đã lưu khung giờ tiết. Buổi điểm danh mới dùng giờ này.')
    } catch (failure) { setError(errorText(failure)) }
    finally { setBusy(false) }
  }
  return <Panel title="Khung giờ tiết">
    <p className="muted">{setup.bells.length ? 'Buổi điểm danh bắt đầu từ tiết đầu và kết thúc ở tiết cuối của lớp trong buổi đó.'
      : 'Chưa lưu khung giờ. Bảng dưới là gợi ý phổ biến, hãy chỉnh theo giờ của trường rồi lưu.'}</p>
    <div className="school-bells">{(['morning', 'afternoon'] as const).map(shift => {
      const list = rows.filter(row => row.shift === shift)
      return <section key={shift}>
        <h3>Buổi {shiftLabel[shift].toLowerCase()}</h3>
        {list.map(row => <div className="school-bell" key={row.shift + row.period}>
          <strong>Tiết {row.period}</strong>
          <label><span className="sr-only">Tiết {row.period} {shiftLabel[shift].toLowerCase()} bắt đầu</span>
            <input type="time" value={row.starts_at} required onChange={event => update(row, 'starts_at', event.target.value)} /></label>
          <span aria-hidden="true">–</span>
          <label><span className="sr-only">Tiết {row.period} {shiftLabel[shift].toLowerCase()} kết thúc</span>
            <input type="time" value={row.ends_at} required onChange={event => update(row, 'ends_at', event.target.value)} /></label>
          {row === list.at(-1) && <button type="button" className="icon-button" aria-label={'Bỏ tiết ' + row.period + ' buổi ' + shiftLabel[shift].toLowerCase()}
            onClick={() => setRows(old => old.filter(item => item !== row))}><Trash2 size={16} aria-hidden="true" /></button>}
        </div>)}
        {list.length < 10 && <button type="button" className="text-button" onClick={() => add(shift)}>+ Thêm tiết</button>}
      </section>
    })}</div>
    <Notice error>{error}</Notice>
    <button type="button" className="primary" disabled={busy || !rows.length} onClick={save}>{busy ? 'Đang lưu…' : 'Lưu khung giờ'}</button>
  </Panel>
}

function ClosuresPanel({ api, setup, saved }: { api: string; setup: Setup; saved: (message: string) => void }) {
  const [sync, setSync] = useState<SyncSummary>()
  const [error, setError] = useState('')
  return <Panel title="Ngày nghỉ">
    <p className="muted">Ngày nghỉ không có buổi điểm danh. Buổi chưa diễn ra trong ngày đó sẽ được hủy.</p>
    <Notice error>{error}</Notice>
    <SyncResult sync={sync} />
    {setup.closures.length ? <ul className="school-closures">{setup.closures.map(item => <li key={item.closed_on}>
      <span><strong>{formatDay(item.closed_on)}</strong> · {item.reason}</span>
      <button type="button" className="text-button" onClick={() => quietly(async () => {
        confirmOrCancel('Bỏ ngày nghỉ ' + formatDay(item.closed_on) + '? Buổi điểm danh của ngày này sẽ được tạo lại.')
        const response = await send<{ sync: SyncSummary }>(api + '/school/closures/' + item.closed_on, {}, 'DELETE')
        setSync(response.sync)
        saved('Đã bỏ ngày nghỉ.')
      }, setError)}>Bỏ</button>
    </li>)}</ul> : <p className="muted">Chưa có ngày nghỉ sắp tới.</p>}
    <h3 className="school-subhead">Thêm ngày nghỉ</h3>
    <ActionForm label="Thêm ngày nghỉ" action={async data => {
      const response = await send<{ sync: SyncSummary }>(api + '/school/closures', { closed_on: value(data, 'closed_on'), reason: value(data, 'reason') })
      setSync(response.sync)
    }} onSaved={() => saved('Đã lưu ngày nghỉ.')}>
      <Field label="Ngày"><input type="date" name="closed_on" defaultValue={setup.today} required /></Field>
      <Field label="Lý do"><input name="reason" maxLength={120} required placeholder="Nghỉ lễ, thi học kỳ…" /></Field>
    </ActionForm>
  </Panel>
}

function suggestedSlug(name: string) {
  const slug = name.toLowerCase().replace(/đ/g, 'd').normalize('NFD').replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '')
  return slug.length >= 3 ? slug : 'truong-cua-toi'
}
function PublicPanel({ api, setup, schoolName, saved }: { api: string; setup: Setup; schoolName: string; saved: (message: string) => void }) {
  const link = setup.public_slug ? location.origin + basePath + studentTimetablePath + '?truong=' + setup.public_slug : ''
  const [error, setError] = useState('')
  return <Panel title="Trang học sinh">
    <p className="muted">Học sinh và phụ huynh xem thời khóa biểu đã công bố, ngày nghỉ và buổi bị hủy mà không cần đăng nhập.
      Trang không hiện tên giáo viên, danh sách học sinh hay kết quả điểm danh.</p>
    {link ? <>
      <p className="school-ok">Đang công bố tại:</p>
      <Field label="Link cho học sinh"><input readOnly value={link} onFocus={event => event.target.select()} /></Field>
      <div className="school-actions">
        <button type="button" onClick={() => navigator.clipboard?.writeText(link).then(() => saved('Đã sao chép link trang học sinh.'), () => undefined)}>Sao chép link</button>
        <a className="button" href={link} target="_blank" rel="noreferrer">Mở trang</a>
        <button type="button" className="text-button school-danger" onClick={() => quietly(async () => {
          confirmOrCancel('Ngừng công bố? Link hiện tại sẽ không còn hiện thời khóa biểu.')
          await send(api + '/school/public', { slug: null }, 'PATCH')
          saved('Đã ngừng công bố trang học sinh.')
        }, setError)}>Ngừng công bố</button>
      </div>
      <Notice error>{error}</Notice>
    </> : <ActionForm label="Công bố trang học sinh" action={data => send(api + '/school/public', { slug: value(data, 'slug').trim().toLowerCase() }, 'PATCH')}
      onSaved={() => saved('Đã công bố trang học sinh.')}>
      <Field label="Tên ngắn trong link"><input name="slug" defaultValue={suggestedSlug(schoolName)} required minLength={3} maxLength={40}
        pattern="[a-z0-9](?:[a-z0-9\-]{1,38}[a-z0-9])" title="Chữ thường không dấu, số và dấu gạch ngang" /></Field>
      <p className="muted">Chữ thường không dấu, số và dấu gạch ngang, ví dụ thcs-anh-duong.</p>
    </ActionForm>}
  </Panel>
}

export function SchoolSettings({ api, schoolName }: { api: string; schoolName: string }) {
  const load = useLoad<{ data: Setup }>(api + '/school/setup')
  const [feedback, setFeedback] = useState('')
  const [epoch, setEpoch] = useState(0)
  const saved = (message: string) => { setFeedback(message); setEpoch(old => old + 1); load.refresh() }
  return <LoadView load={load}>{({ data }) => <div className="school-settings">
    <Notice>{feedback}</Notice>
    <TermsPanel api={api} setup={data} saved={saved} />
    <SubjectsPanel api={api} setup={data} saved={saved} />
    <BellsPanel key={'bells' + epoch} api={api} setup={data} saved={saved} />
    <ClosuresPanel api={api} setup={data} saved={saved} />
    <PublicPanel api={api} setup={data} schoolName={schoolName} saved={saved} />
  </div>}</LoadView>
}

/* ------------------------------------------------------------------ Timetable page */

function ClassPicker({ classes, value: selected, onChange }: { classes: SchoolClass[]; value: string; onChange: (id: string) => void }) {
  return <div className="segmented school-classes" role="group" aria-label="Chọn lớp">
    {classes.map(item => <button type="button" key={item.id} aria-pressed={item.id === selected} onClick={() => onChange(item.id)}>{item.name}</button>)}
  </div>
}

function Assignments({ api, term, classes, teachers, subjects, refreshClasses }: {
  api: string; term: Term; classes: SchoolClass[]; teachers: Teacher[]; subjects: Subject[]; refreshClasses: () => void
}) {
  const url = api + '/school/terms/' + term.id + '/assignments'
  const load = useLoad<{ data: Assignment[] }>(url)
  const [classId, setClassId] = useState(classes[0].id)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const item = classes.find(row => row.id === classId) ?? classes[0]
  async function save(path: string, data: unknown, message: string, after: () => void) {
    setStatus('')
    setError('')
    try {
      await send(path, data, 'PUT')
      setStatus(message)
    } catch (failure) { setError(errorText(failure)) }
    after()
  }
  const active = subjects.filter(subject => !subject.archived)
  return <Panel title="Phân công giảng dạy">
    <p className="muted">Giáo viên chủ nhiệm phụ trách buổi điểm danh của lớp. Giáo viên bộ môn áp dụng cho {term.name}.</p>
    {!teachers.length && <Notice error>Chưa có giáo viên đang hoạt động. Hãy thêm giáo viên ở mục Nhân sự.</Notice>}
    <ClassPicker classes={classes} value={item.id} onChange={id => { setClassId(id); setStatus(''); setError('') }} />
    <Notice>{status}</Notice>
    <Notice error>{error}</Notice>
    <Field label={'Giáo viên chủ nhiệm lớp ' + item.name}>
      <select key={item.id + (item.homeroom_id ?? '')} defaultValue={item.homeroom_id ?? ''} onChange={event =>
        save(api + '/school/classes/' + item.id + '/homeroom', { user_id: event.target.value },
          'Đã lưu giáo viên chủ nhiệm lớp ' + item.name + '.', refreshClasses)}>
        <option value="" disabled>Chọn giáo viên</option>
        {teachers.map(teacher => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
      </select>
    </Field>
    <LoadView load={load}>{({ data }) => <div className="table-scroll" role="region" aria-label={'Giáo viên bộ môn lớp ' + item.name} tabIndex={0}>
      <table className="school-assignments">
        <thead><tr><th scope="col">Môn</th><th scope="col">Giáo viên dạy lớp {item.name}</th></tr></thead>
        <tbody>{active.map(subject => {
          const current = data.find(row => row.class_id === item.id && row.subject_id === subject.id)
          return <tr key={subject.id}><th scope="row">{subject.name}</th><td>
            <select aria-label={'Giáo viên dạy ' + subject.name + ' lớp ' + item.name}
              key={item.id + subject.id + (current?.user_id ?? '')} defaultValue={current?.user_id ?? ''}
              onChange={event => save(url, { class_id: item.id, subject_id: subject.id, user_id: event.target.value || null },
                'Đã lưu giáo viên ' + subject.name + ' lớp ' + item.name + '.', load.refresh)}>
              <option value="">Chưa phân công</option>
              {teachers.map(teacher => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
            </select>
          </td></tr>
        })}</tbody>
      </table>
    </div>}</LoadView>
  </Panel>
}

function parsePaste(text: string, bells: Bell[], subjects: Subject[]) {
  const lookup = new Map<string, string>()
  for (const subject of subjects) {
    lookup.set(normalize(subject.name), subject.id)
    if (subject.short_name) lookup.set(normalize(subject.short_name), subject.id)
  }
  const lines = text.replace(/\r/g, '').split('\n')
  while (lines.length && !lines.at(-1)!.trim()) lines.pop()
  if (lines.length > bells.length) throw new Error('Có ' + lines.length + ' dòng nhưng khung giờ chỉ có ' + bells.length + ' tiết.')
  const cells = new Map<string, string>()
  const unknown = new Set<string>()
  lines.forEach((line, row) => line.split('\t').slice(0, schoolDays.length).forEach((raw, column) => {
    const name = raw.trim()
    if (!name) return
    const id = lookup.get(normalize(name))
    if (!id) unknown.add(name)
    else cells.set(cellKey(column + 1, bells[row].shift, bells[row].period), id)
  }))
  if (unknown.size) throw new Error('Không nhận ra môn: ' + [...unknown].slice(0, 6).join(', ') + '. Kiểm tra tên ở mục Thiết lập → Môn học.')
  return cells
}

function ClassGrid({ api, draftId, item, slots, subjects, bells, teacherFor, clashCells, onSaved, onDirty }: {
  api: string; draftId: string; item: SchoolClass; slots: SlotRow[]; subjects: Subject[]; bells: Bell[]
  teacherFor: (subjectId: string) => string | undefined; clashCells: Set<string>; onSaved: (message: string) => void
  onDirty: (dirty: boolean) => void
}) {
  const initial = new Map(slots.filter(slot => slot.class_id === item.id).map(slot => [cellKey(slot.weekday, slot.shift, slot.period), slot.subject_id]))
  const [cells, setCells] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [paste, setPaste] = useState('')
  const dirty = cells.size !== initial.size || [...cells].some(([key, subject]) => initial.get(key) !== subject)
  useEffect(() => { onDirty(dirty) }, [dirty])
  useEffect(() => () => onDirty(false), [])
  const usable = subjects.filter(subject => !subject.archived || [...cells.values()].includes(subject.id))
  function set(key: string, subject: string) {
    setCells(old => {
      const next = new Map(old)
      if (subject) next.set(key, subject)
      else next.delete(key)
      return next
    })
  }
  async function save() {
    setBusy(true)
    setError('')
    try {
      await send(api + '/school/timetable/' + draftId + '/classes/' + item.id, { slots: [...cells].map(([key, subject_id]) => {
        const [weekday, shift, period] = key.split(':')
        return { weekday: Number(weekday), shift, period: Number(period), subject_id, room: '' }
      }) }, 'PUT')
      onSaved('Đã lưu thời khóa biểu lớp ' + item.name + '.')
    } catch (failure) { setError(errorText(failure)) }
    finally { setBusy(false) }
  }
  return <>
    <div className="table-scroll" role="region" aria-label={'Thời khóa biểu lớp ' + item.name} tabIndex={0}>
      <table className="tkb-grid">
        <thead><tr><th scope="col">Tiết</th>{schoolDays.map(day => <th scope="col" key={day}>{weekdays[day - 1]}</th>)}</tr></thead>
        <tbody>{bells.map((bell, index) => <tr key={bell.shift + bell.period}
          className={index > 0 && bells[index - 1].shift !== bell.shift ? 'tkb-shift-start' : undefined}>
          <th scope="row"><span>{shiftLabel[bell.shift]} · Tiết {bell.period}</span><small>{bell.starts_at}–{bell.ends_at}</small></th>
          {schoolDays.map(day => {
            const key = cellKey(day, bell.shift, bell.period)
            const subject = cells.get(key)
            const teacher = subject ? teacherFor(subject) : undefined
            return <td key={day} className={clashCells.has(key) ? 'tkb-clash' : undefined}>
              <select aria-label={weekdays[day - 1] + ', ' + shiftLabel[bell.shift].toLowerCase() + ' tiết ' + bell.period}
                value={subject ?? ''} disabled={busy} onChange={event => set(key, event.target.value)}>
                <option value="">—</option>
                {usable.map(row => <option key={row.id} value={row.id}>{row.short_name || row.name}</option>)}
              </select>
              {subject && <small className={teacher ? undefined : 'tkb-missing'}>{teacher ?? 'Chưa phân công'}</small>}
            </td>
          })}
        </tr>)}</tbody>
      </table>
    </div>
    <Notice error>{error}</Notice>
    <div className="school-actions">
      <button type="button" className="primary" disabled={busy || !dirty} onClick={save}>{busy ? 'Đang lưu…' : 'Lưu thời khóa biểu lớp ' + item.name}</button>
      {dirty && <button type="button" disabled={busy} onClick={() => setCells(initial)}>Hoàn tác</button>}
      <span className="muted">{cells.size} tiết trong tuần{dirty ? ' · Có thay đổi chưa lưu' : ''}</span>
    </div>
    <details className="school-paste">
      <summary><ClipboardPaste size={16} aria-hidden="true" /> Dán từ Excel</summary>
      <p className="muted">Chọn vùng môn học trong Excel, không lấy dòng tiêu đề và cột tiết. Mỗi dòng là một tiết theo thứ tự trong bảng
        (tiết sáng rồi tiết chiều), mỗi cột là một ngày từ Thứ Hai đến Thứ Bảy. Ô trống là không có tiết.</p>
      <Field label="Dữ liệu dán"><textarea rows={6} value={paste} onChange={event => setPaste(event.target.value)} /></Field>
      <button type="button" disabled={!paste.trim()} onClick={() => {
        setError('')
        try {
          setCells(parsePaste(paste, bells, subjects.filter(subject => !subject.archived)))
          setPaste('')
        } catch (failure) { setError(errorText(failure)) }
      }}>Đưa vào bảng</button>
    </details>
  </>
}

function IssueList({ sheet, classes }: { sheet: Sheet; classes: SchoolClass[] }) {
  const missingHomeroom = classes.filter(item => !item.homeroom_id && sheet.slots.some(slot => slot.class_id === item.id))
  if (!sheet.clashes.length && !sheet.unassigned.length && !missingHomeroom.length) {
    return <p className="school-ok">Không có giáo viên bị trùng tiết. Mọi môn đã có giáo viên.</p>
  }
  return <ul className="school-issues">
    {sheet.clashes.map((clash, index) => <li key={'c' + index} className="school-issue-block">
      <AlertTriangle size={16} aria-hidden="true" /><span><strong>{clash.teacher_name}</strong> trùng tiết {weekdays[clash.weekday - 1]},
        {' ' + shiftLabel[clash.shift].toLowerCase()} tiết {clash.period}: {clash.classes.join(', ')}</span>
    </li>)}
    {missingHomeroom.map(item => <li key={'h' + item.id}>Lớp {item.name} chưa có giáo viên chủ nhiệm nên chưa tạo được buổi điểm danh.</li>)}
    {sheet.unassigned.map((row, index) => <li key={'u' + index}>{row.class_name} · {row.subject_name} chưa có giáo viên.</li>)}
  </ul>
}

function DraftEditor({ api, draftId, term, classes, subjects, bells, onDiscarded }: {
  api: string; draftId: string; term: Term; classes: SchoolClass[]; subjects: Subject[]; bells: Bell[]; onDiscarded: () => void
}) {
  const sheet = useLoad<{ data: Sheet }>(api + '/school/timetable/' + draftId)
  const assignments = useLoad<{ data: Assignment[] }>(api + '/school/terms/' + term.id + '/assignments')
  const [classId, setClassId] = useState(classes[0].id)
  const [dirty, setDirty] = useState(false)
  const [revision, setRevision] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const item = classes.find(row => row.id === classId) ?? classes[0]
  return <>
    <Panel title="Soạn thời khóa biểu">
      <p className="muted">Bản nháp của {term.name}. Học sinh và giáo viên chỉ thấy thời khóa biểu sau khi công bố.</p>
      <ClassPicker classes={classes} value={item.id} onChange={id => {
        if (id === item.id) return
        if (dirty && !window.confirm('Chuyển lớp và bỏ thay đổi chưa lưu của lớp ' + item.name + '?')) return
        setClassId(id)
        setFeedback('')
      }} />
      <Notice>{feedback}</Notice>
      <LoadView load={sheet}>{({ data }) => {
        const teachers = new Map((assignments.value?.data ?? []).filter(row => row.class_id === item.id).map(row => [row.subject_id, row.teacher_name]))
        const clashCells = new Set(data.clashes.filter(clash => clash.classes.includes(item.name))
          .map(clash => cellKey(clash.weekday, clash.shift, clash.period)))
        return <ClassGrid key={item.id + ':' + revision} api={api} draftId={draftId} item={item} slots={data.slots} subjects={subjects}
          bells={bells} teacherFor={subject => teachers.get(subject)} clashCells={clashCells} onDirty={setDirty}
          onSaved={message => { setFeedback(message); setRevision(old => old + 1); sheet.refresh() }} />
      }}</LoadView>
    </Panel>
    <Panel title="Kiểm tra trước khi công bố">
      <LoadView load={sheet}>{({ data }) => <IssueList sheet={data} classes={classes} />}</LoadView>
      <Notice error>{error}</Notice>
      <button type="button" className="text-button school-danger" onClick={() => quietly(async () => {
        confirmOrCancel('Hủy bản nháp này? Thời khóa biểu đã công bố không bị ảnh hưởng.')
        await send(api + '/school/timetable/' + draftId + '/discard', {})
        onDiscarded()
      }, setError)}><Trash2 size={15} aria-hidden="true" /> Hủy bản nháp</button>
    </Panel>
  </>
}

function useVersions(api: string, term: Term) {
  return useLoad<{ data: { term: Term; versions: VersionRow[] } }>(api + '/school/terms/' + term.id + '/timetable')
}

function TimetableEditor(props: { api: string; term: Term; classes: SchoolClass[]; subjects: Subject[]; bells: Bell[] }) {
  const versions = useVersions(props.api, props.term)
  return <LoadView load={versions}>{({ data }) => {
    const draft = data.versions.find(row => row.status === 'draft')
    if (draft) return <DraftEditor key={draft.id} {...props} draftId={draft.id} onDiscarded={versions.refresh} />
    const published = data.versions.some(row => row.status === 'published')
    return <Panel title="Soạn thời khóa biểu">
      <p className="muted">{published ? 'Muốn sửa thời khóa biểu đang áp dụng, hãy tạo bản nháp. Bản nháp chép từ bản công bố mới nhất.'
        : 'Học kỳ này chưa có thời khóa biểu. Tạo bản nháp để bắt đầu xếp tiết.'}</p>
      <ActionForm grid={false} label="Tạo bản nháp" action={() => send(props.api + '/school/terms/' + props.term.id + '/timetable/draft', {})}
        onSaved={versions.refresh}>{null}</ActionForm>
    </Panel>
  }}</LoadView>
}

function versionLabel(row: VersionRow, rows: VersionRow[], today: string) {
  if (row.status === 'draft') return 'Bản nháp'
  if (row.status === 'archived') return 'Đã thay thế'
  if (row.effective_from! > today) return 'Sắp áp dụng'
  const current = rows.filter(item => item.status === 'published' && item.effective_from! <= today)
    .sort((a, b) => b.effective_from!.localeCompare(a.effective_from!))[0]
  return current?.id === row.id ? 'Đang áp dụng' : 'Hết hiệu lực'
}

function Publish({ api, term, classes, today }: { api: string; term: Term; classes: SchoolClass[]; today: string }) {
  const versions = useVersions(api, term)
  const draft = versions.value?.data.versions.find(row => row.status === 'draft')
  const sheet = useLoad<{ data: Sheet }>(draft ? api + '/school/timetable/' + draft.id : '')
  const [sync, setSync] = useState<SyncSummary>()
  const [feedback, setFeedback] = useState('')
  const earliest = term.starts_on > today ? term.starts_on : today
  const syncTo = addDays(today, 13) < term.ends_on ? addDays(today, 13) : term.ends_on
  return <>
    <Notice>{feedback}</Notice>
    <SyncResult sync={sync} />
    <LoadView load={versions}>{({ data }) => <>
      {draft ? <Panel title="Công bố bản nháp">
        {sheet.value ? <>
          <p>{new Set(sheet.value.data.slots.map(slot => slot.class_id)).size}/{classes.length} lớp đã xếp tiết ·
            {' ' + sheet.value.data.slots.length} tiết mỗi tuần.</p>
          <IssueList sheet={sheet.value.data} classes={classes} />
        </> : <p className="muted" role="status">Đang kiểm tra bản nháp…</p>}
        {earliest > term.ends_on ? <Notice error>{term.name} đã kết thúc.</Notice> :
          <ActionForm label="Công bố thời khóa biểu" reset={false} action={async form => {
            const from = value(form, 'effective_from')
            confirmOrCancel('Công bố thời khóa biểu áp dụng từ ' + formatDay(from) + '? Buổi điểm danh chưa diễn ra sẽ được cập nhật theo bản này.')
            const response = await send<{ sync: SyncSummary }>(api + '/school/timetable/' + draft.id + '/publish', { effective_from: from })
            setSync(response.sync)
            setFeedback('Đã công bố thời khóa biểu từ ' + formatDay(from) + '.')
            versions.refresh()
          }}>
            <Field label="Áp dụng từ ngày"><input type="date" name="effective_from" defaultValue={earliest} min={earliest} max={term.ends_on} required /></Field>
            <p className="muted">Bản mới thay thế mọi bản đã công bố có ngày áp dụng từ ngày này trở đi. Buổi đã điểm danh giữ nguyên.</p>
          </ActionForm>}
      </Panel> : <Panel title="Công bố bản nháp"><Empty>Chưa có bản nháp. Mở mục Soạn để tạo bản nháp.</Empty></Panel>}
      <Panel title="Các bản thời khóa biểu">
        {data.versions.filter(row => row.status !== 'draft').length ? <div className="list">
          {data.versions.filter(row => row.status !== 'draft').map(row => <div className="school-version" key={row.id}>
            <div><strong>Áp dụng từ {formatDay(row.effective_from!)}</strong>
              <small>{row.classes} lớp · công bố {row.published_at ? clock.format(row.published_at) : ''}{row.published_by ? ' · ' + row.published_by : ''}</small></div>
            <span className="badge">{versionLabel(row, data.versions, today)}</span>
          </div>)}
        </div> : <Empty>Chưa công bố thời khóa biểu nào trong {term.name}.</Empty>}
      </Panel>
    </>}</LoadView>
    <Panel title="Đồng bộ buổi điểm danh">
      <p className="muted">Khi công bố, ClassHub chuẩn bị buổi điểm danh cho 14 ngày tới. Dùng mục này để chuẩn bị thêm ngày
        hoặc cập nhật sau khi đổi giáo viên chủ nhiệm, khung giờ hay ngày nghỉ. Mỗi lần tối đa 31 ngày.</p>
      <ActionForm label="Đồng bộ" reset={false} action={async form => {
        const response = await send<{ sync: SyncSummary }>(api + '/school/sessions/sync', { from: value(form, 'from'), to: value(form, 'to') })
        setSync(response.sync)
        setFeedback('Đã đồng bộ buổi điểm danh.')
      }}>
        <Field label="Từ ngày"><input type="date" name="from" defaultValue={today} min={today} required /></Field>
        <Field label="Đến ngày"><input type="date" name="to" defaultValue={syncTo} min={today} required /></Field>
      </ActionForm>
    </Panel>
  </>
}

const tabs = { 'phan-cong': 'Phân công', soan: 'Soạn', 'cong-bo': 'Công bố' } as const
type Tab = keyof typeof tabs

function SchoolChecklist({ base, setup, classes }: { base: string; setup: Setup; classes: SchoolClass[] }) {
  const steps: [boolean, ReactNode][] = [
    [setup.terms.length > 0, <>Thêm học kỳ ở <Link to={base + '/thiet-lap'}>Thiết lập</Link></>],
    [setup.subjects.some(subject => !subject.archived), <>Thêm môn học ở <Link to={base + '/thiet-lap'}>Thiết lập</Link></>],
    [setup.bells.length > 0, <>Lưu khung giờ tiết ở <Link to={base + '/thiet-lap'}>Thiết lập</Link></>],
    [classes.length > 0, <>Tạo lớp ở <Link to={base + '/lop'}>Lớp học</Link></>],
  ]
  return <Panel title="Chuẩn bị trước khi xếp thời khóa biểu">
    <ol className="school-steps">{steps.map(([done, label], index) => <li key={index} className={done ? 'done' : undefined}>
      {label}{done && <span className="sr-only"> (đã xong)</span>}
    </li>)}</ol>
  </Panel>
}

export function SchoolTimetable({ api, base }: WorkspaceProps) {
  const setup = useLoad<{ data: Setup }>(api + '/school/setup')
  const classes = useLoad<{ data: SchoolClass[] }>(api + '/school/classes')
  const teachers = useLoad<{ data: Teacher[] }>(api + '/school/teachers')
  const [params, setParams] = useSearchParams()
  const requested = params.get('muc')
  const tab: Tab = requested && requested in tabs ? requested as Tab : 'phan-cong'
  const change = (key: string, next: string) => {
    const copy = new URLSearchParams(params)
    copy.set(key, next)
    setParams(copy)
  }
  return <>
    <Header kicker="Chế độ trường học" title="Thời khóa biểu"
      description="Phân công, soạn và công bố thời khóa biểu. Mỗi lớp có một buổi điểm danh cho mỗi buổi sáng hoặc chiều có tiết." />
    <LoadView load={setup}>{({ data: school }) => <LoadView load={classes}>{({ data: classList }) =>
      <LoadView load={teachers}>{({ data: teacherList }) => {
        const ordered = byName(classList)
        const activeSubjects = school.subjects.filter(subject => !subject.archived)
        if (!school.terms.length || !activeSubjects.length || !school.bells.length || !ordered.length) {
          return <SchoolChecklist base={base} setup={school} classes={ordered} />
        }
        const term = school.terms.find(row => row.id === params.get('hk'))
          ?? school.terms.find(row => row.starts_on <= school.today && school.today <= row.ends_on)
          ?? school.terms.find(row => row.starts_on > school.today) ?? school.terms.at(-1)!
        const bells = sortBells(school.bells)
        return <>
          <div className="school-toolbar">
            <Field label="Học kỳ"><select value={term.id} onChange={event => change('hk', event.target.value)}>
              {school.terms.map(row => <option key={row.id} value={row.id}>{row.name} ({formatDay(row.starts_on)} – {formatDay(row.ends_on)})</option>)}
            </select></Field>
            <div className="segmented" role="group" aria-label="Mục thời khóa biểu">
              {Object.entries(tabs).map(([id, label]) => <button type="button" key={id} aria-pressed={tab === id}
                onClick={() => change('muc', id)}>{id === 'cong-bo' ? <Send size={15} aria-hidden="true" /> : id === 'soan' ? <RefreshCw size={15} aria-hidden="true" /> : null} {label}</button>)}
            </div>
          </div>
          {tab === 'phan-cong' && <Assignments key={term.id} api={api} term={term} classes={ordered} teachers={teacherList}
            subjects={school.subjects} refreshClasses={classes.refresh} />}
          {tab === 'soan' && <TimetableEditor key={term.id} api={api} term={term} classes={ordered} subjects={school.subjects} bells={bells} />}
          {tab === 'cong-bo' && <Publish key={term.id} api={api} term={term} classes={ordered} today={school.today} />}
        </>
      }}</LoadView>}</LoadView>}</LoadView>
  </>
}
