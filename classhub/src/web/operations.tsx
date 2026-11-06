import { useState, type ReactNode } from 'react'
import { Link, NavLink, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ChevronRight, UsersRound } from 'lucide-react'
import {
  ActionForm, Badge, confirmOrCancel, Disclosure, Empty, Field, Header, LoadView, Notice, PageSearch, Pager, Panel,
  addDays, basePath, errorText, formatClock, formatDay, localDay, roles, send, useLoad, value, type Page, type Workspace,
} from './ui'
import { Calendar, Timetable } from './scheduling'
import { DirectoryBanner, DirectorySettings, DirectoryStudentFields, directoryForm, type Directory } from './shared-directory'
import { SchoolSettings } from './school'

export type WorkspaceProps = { workspace: Workspace; api: string; base: string }
type Item = { id: string; name: string }
type Course = Item & { code: string; subject: string; description: string; archived: number }
type Student = Item & { code: string; active: number; directory_class_id?: string; directory_revision?: number }
type StaffRow = { user_id: string; name: string; role: Workspace['role']; branch_id: string | null; active: number }
export type Assignment = { user_id: string; name: string; duty: 'primary' | 'support'; ended_at: number | null }
export type ClassRow = Item & {
  code: string; starts_on: string; ends_on: string; room: string; notes: string; capacity: number
  status: string; branch_id: string; course_id: string; shared?: number
}
type ClassCard = ClassRow & { branch_name: string; course_name: string; enrolled: number }
type Enrollment = { id: string; student_id: string; name: string; code: string; enrolled_on: string; withdrawn_on: string | null; shared?: number }
type StudentHistory = { id: string; class_id: string; class_name: string; enrolled_on: string; withdrawn_on: string | null }

const orgTypes = { independent: 'Giáo viên độc lập', center: 'Trung tâm giáo dục', school: 'Trường học', other: 'Đơn vị đào tạo khác' }
export function TypeField({ current = 'center' }: { current?: string }) {
  return <Field label="Loại hình"><select name="type" defaultValue={current} required>
    {Object.entries(orgTypes).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
  </select></Field>
}
function TextField({ label, name, initial = '', maxLength, required = false, readOnly = false }: {
  label: string; name: string; initial?: string; maxLength: number; required?: boolean; readOnly?: boolean
}) {
  return <Field label={label}><input name={name} defaultValue={initial} maxLength={maxLength} required={required} readOnly={readOnly} /></Field>
}
export function RemoteSelect<T>({ label, name, url, toOption, required = true, searchable = false, defaultOption }: {
  label: string; name: string; url: string; toOption: (item: T) => Item | null
  required?: boolean; searchable?: boolean; defaultOption?: Item
}) {
  const [selection, setSelection] = useState<Item | undefined>(defaultOption)
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const load = useLoad<Page<T>>(url + (url.includes('?') ? '&' : '?') + new URLSearchParams({ page: String(page), q }))
  const options = (load.value?.data ?? []).map(toOption).filter((item): item is Item => item !== null)
  if (selection && !options.some(option => option.id === selection.id)) options.unshift(selection)
  return <div className="lookup">
    <Field label={label}><select name={name} required={required} value={selection?.id ?? ''} onChange={event =>
      setSelection(options.find(option => option.id === event.target.value))}>
      <option value="">{load.value ? 'Chọn…' : 'Đang tải…'}</option>
      {options.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
    </select></Field>
    {searchable && <Field label={'Tìm ' + label.toLowerCase()}><input type="search" value={q} maxLength={120}
      onChange={event => { setPage(1); setQ(event.target.value) }} /></Field>}
    {load.value && <Pager {...load.value.pagination} change={setPage} />}
    {load.error && <Notice error>{load.error}</Notice>}
  </div>
}
const identityOption = <T extends Item>(item: T) => item
const classOption = (item: ClassCard) => ({ id: item.id, name: item.code + ' · ' + item.name })

function useCollection<T>(url: string) {
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const path = url + (url.includes('?') ? '&' : '?') + new URLSearchParams({ page: String(page), q })
  return { load: useLoad<Page<T>>(path), change: setPage, search: (term: string) => { setPage(1); setQ(term) } }
}
function Collection<T>({ state, render, empty = 'Chưa có bản ghi.' }: {
  state: ReturnType<typeof useCollection<T>>; render: (items: T[]) => ReactNode; empty?: string
}) {
  return <LoadView load={state.load}>{({ data, pagination }) => <>
    {data.length ? render(data) : <Empty>{empty}</Empty>}
    <Pager {...pagination} change={state.change} />
  </>}</LoadView>
}
function itemForm(data: FormData) { return { code: value(data, 'code'), name: value(data, 'name') } }
function ItemFields({ item, label }: { item?: { code: string; name: string }; label: string }) {
  return <><TextField label="Mã" name="code" maxLength={30} initial={item?.code} required />
    <TextField label={label} name="name" maxLength={120} initial={item?.name} required /></>
}
function CourseFields({ course }: { course?: Course }) {
  return <>
    <ItemFields item={course} label="Tên khóa học" />
    <TextField label="Môn học" name="subject" maxLength={80} initial={course?.subject} required />
    <TextField label="Mô tả" name="description" maxLength={1000} initial={course?.description} />
    {course && <label className="check"><input type="checkbox" name="archived" defaultChecked={Boolean(course.archived)} /> Lưu trữ khóa học</label>}
  </>
}
const courseForm = (data: FormData) => ({
  ...itemForm(data), subject: value(data, 'subject'), description: value(data, 'description'), archived: data.has('archived'),
})
export function Courses({ api, workspace }: WorkspaceProps) {
  const owner = workspace.role === 'owner'
  const list = useCollection<Course>(api + '/courses')
  const [feedback, setFeedback] = useState('')
  const saved = () => { setFeedback('Đã lưu khóa học.'); list.load.refresh() }
  return <>
    <Header kicker="Danh mục đào tạo" title="Khóa học" description="Quản lý các khóa mẫu để mở lớp." />
    <Notice>{feedback}</Notice>
    {owner && <Panel title="Thêm khóa học"><ActionForm action={data => send(api + '/courses', courseForm(data))}
      label="Tạo khóa học" onSaved={saved}><CourseFields /></ActionForm></Panel>}
    <Panel title="Danh sách khóa học">
      <PageSearch placeholder="Tên hoặc mã khóa học" action={list.search} />
      <Collection state={list} render={items => <div className="list">{items.map(item => <details className="detail-row" key={item.id}>
        <summary><strong>{item.name}</strong><span>{item.code} · {item.subject}</span>{Boolean(item.archived) && <Badge status="archived" />}</summary>
        {owner ? <ActionForm action={data => send(api + '/courses/' + item.id, courseForm(data), 'PATCH')} onSaved={saved}>
          <CourseFields course={item} /></ActionForm> : <p>{item.description || 'Chưa có mô tả.'}</p>}
      </details>)}</div>} />
    </Panel>
  </>
}
function schoolYearEnd(day: string) {
  const year = Number(day.slice(0, 4)) + (Number(day.slice(5, 7)) >= 8 ? 1 : 0)
  return year + '-07-31'
}
function ClassFields({ item, school = false }: { item?: ClassRow; school?: boolean }) {
  return <>
    <TextField label="Mã" name="code" maxLength={30} initial={item?.code} required />
    <TextField label="Tên lớp" name="name" maxLength={150} initial={item?.name} required readOnly={Boolean(item?.shared)} />
    <Field label="Ngày bắt đầu"><input type="date" name="starts_on" defaultValue={item?.starts_on ?? localDay()} required /></Field>
    <Field label="Ngày kết thúc"><input type="date" name="ends_on" required
      defaultValue={item?.ends_on ?? (school ? schoolYearEnd(localDay()) : addDays(localDay(), 90))} /></Field>
    <Field label="Sĩ số tối đa"><input type="number" name="capacity" min={1} max={100} defaultValue={item?.capacity ?? (school ? 45 : 30)} required /></Field>
    <TextField label="Phòng học mặc định" name="room" maxLength={80} initial={item?.room} />
    <TextField label="Ghi chú vận hành" name="notes" maxLength={1000} initial={item?.notes} />
  </>
}
const classForm = (data: FormData) => ({
  ...itemForm(data), starts_on: value(data, 'starts_on'), ends_on: value(data, 'ends_on'), capacity: Number(value(data, 'capacity')),
  room: value(data, 'room'), notes: value(data, 'notes'),
})
export function Classes({ api, base, workspace }: WorkspaceProps) {
  const list = useCollection<ClassCard>(api + '/classes')
  const navigate = useNavigate()
  return <>
    <Header kicker="Không gian giảng dạy" title="Lớp học" description={workspace.role === 'teacher' ? 'Các lớp bạn đang phụ trách.' : 'Tổ chức lớp, ghi danh và phân công giảng dạy.'} />
    {workspace.shared_directory && <DirectoryBanner api={api} base={base} />}
    {workspace.role !== 'teacher' && <details className="panel new-record"><summary>Tạo lớp học</summary>
      <ActionForm label="Tạo lớp" action={async data => {
        const item = await send<{ id: string }>(api + '/classes', {
          ...classForm(data), course_id: value(data, 'course_id') || undefined, branch_id: value(data, 'branch_id'),
        })
        navigate(base + '/lop/' + item.id)
      }}>
        <ClassFields school={workspace.type === 'school'} />
        {workspace.type !== 'school' && <RemoteSelect<Course> url={api + '/courses'} name="course_id" label="Khóa học" searchable
          toOption={item => item.archived ? null : item} />}
        <RemoteSelect<Item> url={api + '/branches'} name="branch_id" label="Cơ sở" toOption={identityOption} />
      </ActionForm>
    </details>}
    <Panel title="Danh sách lớp">
      <PageSearch placeholder="Tên hoặc mã lớp" action={list.search} />
      <Collection state={list} render={items => <div className="class-grid">{items.map(item => <Link className="class-card" to={base + '/lop/' + item.id} key={item.id}>
        <div className="row-between"><span className="eyebrow">{item.code}</span><Badge status={item.status} /></div>
        <h3>{item.name}</h3><p>{item.course_name} · {item.branch_name}</p>{Boolean(item.shared) && <span className="badge">Dùng chung MealCheck</span>}
        <div className="row-between"><span><UsersRound size={15} aria-hidden="true" /> {item.enrolled}/{item.capacity} học viên</span><ChevronRight size={16} aria-hidden="true" /></div>
      </Link>)}</div>} />
    </Panel>
  </>
}
const classTransitions: Record<string, string[]> = {
  draft: ['scheduled', 'active', 'cancelled'], scheduled: ['active', 'cancelled'],
  active: ['completed', 'cancelled'], completed: ['archived'], cancelled: ['archived'], archived: [],
}
const statusLabels: Record<string, string> = {
  draft: 'Bản nháp', scheduled: 'Đã lên lịch', active: 'Đang học', completed: 'Hoàn tất', cancelled: 'Đã hủy', archived: 'Lưu trữ',
}
export function ClassWorkspace(props: WorkspaceProps) {
  type ClassOverview = ClassRow & { enrolled: number; teacher: string | null
    next: { id: string; lesson_date: string; starts_at: number; room: string } | null }
  const { classId } = useParams()
  const classApi = props.api + '/classes/' + classId
  const route = props.base + '/lop/' + classId
  const load = useLoad<{ data: ClassOverview }>(classApi)
  const [feedback, setFeedback] = useState('')
  const admin = props.workspace.role !== 'teacher'
  return <LoadView load={load}>{({ data: item }) => <>
    <Link className="back" to={props.base + '/lop'}><ArrowLeft size={16} aria-hidden="true" /> Lớp học</Link>
    <Header kicker={item.code} title={item.name} description={formatDay(item.starts_on) + ' – ' + formatDay(item.ends_on)}>
      <Badge status={item.status} />
    </Header>
    <nav className="tabs" aria-label="Không gian lớp">
      {[['', 'Tổng quan'], ['/ghi-danh', 'Học viên'], ['/giao-vien', 'Giáo viên'], ['/lich', 'Lịch & chuyên cần'], ...(admin ? [['/chinh-sua', 'Chỉnh sửa']] : [])]
        .map(([path, label]) => <NavLink key={label} end={!path} to={route + path}>{label}</NavLink>)}
    </nav>
    <Notice>{feedback}</Notice>
    <Routes>
      <Route index element={<>
        <Panel title="Thông tin nhanh">
          <div className="class-overview">
            <div><small>Sĩ số đang học</small><strong>{item.enrolled}/{item.capacity}</strong></div>
            <div><small>Giáo viên phụ trách</small><strong>{item.teacher ?? 'Chưa phân công'}</strong></div>
            <div><small>Phòng mặc định</small><strong>{item.room || 'Chưa đặt phòng'}</strong></div>
          </div>
          {item.notes && <p>{item.notes}</p>}
        </Panel>
        <Panel title="Buổi tiếp theo">
          {item.next ? <Link className="row-link" to={props.base + '/buoi/' + item.next.id}>
            <span>{formatDay(item.next.lesson_date)} · {formatClock(item.next.starts_at)}{item.next.room && ' · ' + item.next.room}</span>
            <ChevronRight size={17} aria-hidden="true" /></Link> : <Empty>Chưa có buổi học sắp tới.</Empty>}
          <Link className="back" to={route + '/lich'}>Xem lịch lớp</Link>
        </Panel>
        {admin && <Link className="back" to={props.base + '/bao-cao?class_id=' + item.id}>Xem chuyên cần của lớp</Link>}
      </>} />
      {admin && <Route path="chinh-sua" element={<Panel title="Chỉnh sửa thông tin lớp">
        <p>Sĩ số tối đa {item.capacity} · {item.room || 'Chưa đặt phòng học mặc định'}</p>
        {item.notes && <p>{item.notes}</p>}
        {admin && <ActionForm action={data => send(classApi, { ...classForm(data), status: value(data, 'status') }, 'PATCH')}
          onSaved={() => { setFeedback('Đã cập nhật thông tin lớp.'); load.refresh() }}>
          <ClassFields item={item} />
          <Field label="Trạng thái"><select name="status" defaultValue={item.status}>
            {[item.status, ...(classTransitions[item.status] ?? [])].map(status => <option key={status} value={status}>{statusLabels[status]}</option>)}
          </select></Field>
        </ActionForm>}
      </Panel>} />}
      <Route path="ghi-danh" element={<EnrollmentPanel key={classId} {...props} item={item} classApi={classApi} />} />
      <Route path="giao-vien" element={<TeacherPanel key={classId} {...props} item={item} classApi={classApi} />} />
      <Route path="lich" element={<>
        {admin && <Timetable key={classId} {...props} item={item} classApi={classApi} />}
        <Calendar {...props} classId={item.id} />
      </>} />
      <Route path="*" element={<Empty>Không tìm thấy mục trong lớp này.</Empty>} />
    </Routes>
  </>}</LoadView>
}
function EnrollmentPanel({ workspace, api, item, classApi }: WorkspaceProps & { item: ClassRow; classApi: string }) {
  const [feedback, setFeedback] = useState('')
  const list = useCollection<Enrollment>(classApi + '/enrollments')
  const admin = workspace.role !== 'teacher'
  const saved = (message: string) => { setFeedback(message); list.load.refresh() }
  return <>
    <Notice>{feedback}</Notice>
    {Boolean(item.shared) && <p className="panel">Học sinh được cập nhật từ danh sách chung. <Link to={api.replace('/api/v1/orgs/', '/w/') + '/hoc-vien'}>Quản lý học sinh</Link></p>}
    {admin && !item.shared && <Panel title="Ghi danh học viên">
      <ActionForm label="Ghi danh" onSaved={() => saved('Đã ghi danh học viên.')} action={data => {
        const code = value(data, 'code')
        const name = value(data, 'name').trim()
        return send(classApi + '/enrollments', name ? { student: { name, code } } : { student_code: code })
      }}>
        <TextField label="Mã học viên" name="code" maxLength={30} required />
        {workspace.role === 'owner' && <TextField label="Họ tên (điền khi tạo hồ sơ mới)" name="name" maxLength={120} />}
      </ActionForm>
    </Panel>}
    <Panel title={admin ? 'Danh sách và lịch sử ghi danh' : 'Học viên đang theo học'}>
      <Collection state={list} render={items => <div className="list">{items.map(row => <Disclosure key={row.id} summary={<>
        <strong>{row.name}</strong><span>{row.code} · Từ {formatDay(row.enrolled_on)}</span>
        {row.withdrawn_on && <span className="badge">Rút {formatDay(row.withdrawn_on)}</span>}</>}>
        {admin && !row.withdrawn_on && !row.shared ? <ActionForm label="Xác nhận thay đổi" onSaved={() => saved('Đã cập nhật ghi danh.')}
          action={data => {
            const target = value(data, 'transfer_to')
            confirmOrCancel(target ? 'Chuyển học viên sang lớp đã chọn?' : 'Rút học viên khỏi lớp từ hôm nay?')
            return send(classApi + '/enrollments/' + row.id, target ? { transfer_to: target } : {}, 'PATCH')
          }}>
          <RemoteSelect<ClassCard> url={api + '/classes'} name="transfer_to" label="Lớp nhận (để trống nếu rút)" required={false}
            searchable toOption={option => option.id !== item.id ? classOption(option) : null} />
        </ActionForm> : <p>Ghi danh từ {formatDay(row.enrolled_on)}{row.withdrawn_on ? ' đến ' + formatDay(row.withdrawn_on) : '.'}</p>}
      </Disclosure>)}</div>} />
    </Panel>
  </>
}
function TeacherPanel({ workspace, api, item, classApi }: WorkspaceProps & { item: ClassRow; classApi: string }) {
  const list = useCollection<Assignment>(classApi + '/teachers')
  const [feedback, setFeedback] = useState('')
  const admin = workspace.role !== 'teacher'
  const saved = () => { setFeedback('Đã cập nhật phân công.'); list.load.refresh() }
  const primaryLabel = workspace.type === 'school' ? 'Chủ nhiệm' : 'Phụ trách chính'
  return <>
    <Notice>{feedback}</Notice>
    {admin && <Panel title="Phân công giáo viên">
      <ActionForm label="Phân công" onSaved={saved} action={data => send(classApi + '/teachers', { user_id: value(data, 'user_id'), duty: value(data, 'duty') })}>
        <RemoteSelect<StaffRow> url={api + '/staff'} name="user_id" label="Giáo viên" searchable toOption={row =>
          row.role === 'teacher' && (!row.branch_id || row.branch_id === item.branch_id) ? { id: row.user_id, name: row.name } : null} />
        <Field label="Vai trò"><select name="duty"><option value="primary">{primaryLabel}</option><option value="support">Hỗ trợ</option></select></Field>
      </ActionForm>
    </Panel>}
    <Panel title="Giáo viên của lớp">
      {workspace.type === 'school' && <p className="muted">Giáo viên chủ nhiệm phụ trách buổi điểm danh. Đổi chủ nhiệm và phân công bộ môn ở mục Thời khóa biểu.</p>}
      <Collection state={list} render={items => <div className="list">{items.map((row, index) => <details className="detail-row" key={row.user_id + index}>
        <summary><strong>{row.name}</strong><span>{row.duty === 'primary' ? primaryLabel : 'Hỗ trợ'}</span>{row.ended_at && <span className="badge">Đã kết thúc</span>}</summary>
        {admin && !row.ended_at ? <ActionForm label="Kết thúc phân công" onSaved={saved}
          action={() => {
            confirmOrCancel('Kết thúc phân công của giáo viên này?')
            return send(classApi + '/teachers/' + row.user_id, {}, 'DELETE')
          }}><p>Buổi học chưa hoàn tất cần đổi giáo viên trước.</p></ActionForm> : <p>Phân công giảng dạy</p>}
      </details>)}</div>} />
    </Panel>
  </>
}
function History({ api, base, student }: { api: string; base: string; student: Student }) {
  const list = useCollection<StudentHistory>(api + '/students/' + student.id + '/enrollments')
  return <Collection state={list} empty="Học viên chưa ghi danh lớp nào." render={items => <div className="list">
    {items.map(item => <Link className="row-link" key={item.id} to={base + '/lop/' + item.class_id}>
      <strong>{item.class_name}</strong><span>{formatDay(item.enrolled_on)}{item.withdrawn_on ? ' – ' + formatDay(item.withdrawn_on) : ' · Đang học'}</span>
    </Link>)}
  </div>} />
}
function StudentImport({ api, onSaved }: { api: string; onSaved: (message: string) => void }) {
  type Draft = { code: string; name: string }
  const [preview, setPreview] = useState<{ students: Draft[]; existing: string[] }>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function importStudents() {
    if (!preview) return
    setBusy(true)
    setError('')
    try {
      const { created, skipped } = await send<{ created: number; skipped: number }>(api + '/students/import', {
        preview: false, students: preview.students,
      })
      setPreview(undefined)
      onSaved('Đã thêm ' + created + ' học viên · Bỏ qua ' + skipped + ' mã đã có.')
    } catch (failure) { setError(errorText(failure)) }
    finally { setBusy(false) }
  }
  return <details className="panel new-record">
    <summary>Nhập nhiều học viên từ Excel</summary>
    <ActionForm label="Đối chiếu trước khi nhập" reset={false} action={async form => {
      setPreview(undefined)
      setError('')
      const lines = value(form, 'roster').trim().split(/\r?\n/).filter(line => line.trim())
      const students = lines.map((line, index) => {
        const cells = line.split('\t').map(cell => cell.trim())
        if (cells.length !== 2 || cells.some(cell => !cell)) throw new Error('Dòng ' + (index + 1) + ' cần có đúng hai cột mã và họ tên.')
        return { code: cells[0], name: cells[1] }
      })
      const { existing } = await send<{ existing: string[] }>(api + '/students/import', { preview: true, students })
      setPreview({ students, existing })
    }}>
      <Field label="Mã và họ tên"><textarea name="roster" rows={5} maxLength={17000} required
        placeholder="Dán hai cột mã và họ tên từ Excel, tối đa 100 dòng, bỏ dòng tiêu đề"
        onChange={() => setPreview(undefined)} /></Field>
    </ActionForm>
    {preview && <div className="schedule-preview">
      <p>{preview.students.length - preview.existing.length} hồ sơ mới · {preview.existing.length} mã đã có</p>
      {preview.students.map(row => <div className="schedule-occurrence" key={row.code}>
        <strong>{row.code} · {row.name}</strong>
        <span>{preview.existing.includes(row.code.toLowerCase()) ? 'Đã có · Bỏ qua' : 'Thêm mới'}</span>
      </div>)}
      <Notice error>{error}</Notice>
      <button type="button" className="primary" disabled={busy || preview.existing.length === preview.students.length}
        onClick={importStudents}>{busy ? 'Đang nhập…' : 'Nhập hồ sơ mới'}</button>
    </div>}
  </details>
}
export function Students({ api, base, workspace }: WorkspaceProps) {
  const list = useCollection<Student>(api + '/students')
  const [feedback, setFeedback] = useState('')
  const [epoch, setEpoch] = useState(0)
  const directory = useLoad<{ data: Directory }>(workspace.shared_directory ? api + '/shared-directory' : '')
  const saved = () => { setFeedback(workspace.shared_directory ? 'Đã lưu vào danh sách chung.' : 'Đã lưu hồ sơ học viên.'); setEpoch(old => old + 1); list.load.refresh(); directory.refresh() }
  return <>
    <Header kicker="Danh mục đào tạo" title="Học viên" description="Tìm hồ sơ theo tên hoặc mã và xem các lớp đã ghi danh." />
    <Notice>{feedback}</Notice>
    {workspace.shared_directory && <DirectoryBanner api={api} base={base} />}
    {workspace.shared_directory ? <LoadView load={directory}>{({ data }) => <Panel title="Thêm học sinh dùng chung">
      <ActionForm key={epoch} label="Thêm học sinh" action={form => send(api + '/students', { ...itemForm(form), ...directoryForm(form) })} onSaved={saved}>
        <DirectoryStudentFields directory={data} />
      </ActionForm>
    </Panel>}</LoadView> : <Panel title="Thêm học viên"><ActionForm label="Thêm học viên" action={data => send(api + '/students', itemForm(data))}
      onSaved={saved}><ItemFields label="Họ và tên" /></ActionForm></Panel>
    }
    {!workspace.shared_directory && <StudentImport api={api} onSaved={message => { saved(); setFeedback(message) }} />}
    <Panel title="Danh sách học viên">
      <PageSearch placeholder="Tên hoặc mã học viên" action={list.search} />
      <Collection state={list} render={items => <div className="list">{items.map(item => <Disclosure key={item.id}
        summary={<><strong>{item.name}</strong><span>{item.code}</span>{!item.active && <span className="badge">Ngừng theo học</span>}</>}>
        <ActionForm action={data => send(api + '/students/' + item.id, { ...itemForm(data),
          ...(item.directory_class_id ? directoryForm(data) : {}) }, 'PATCH')} onSaved={saved}>
          {item.directory_class_id
            ? directory.value && <DirectoryStudentFields directory={directory.value.data} item={item} />
            : <ItemFields item={item} label="Họ và tên" />}
        </ActionForm>
        <h3>Lịch sử ghi danh</h3><History api={api} base={base} student={item} />
        <Link className="back" to={base + '/bao-cao?student_id=' + item.id}>Xem chuyên cần</Link>
      </Disclosure>)}</div>} />
    </Panel>
  </>
}
// A one-time link (24 hours) for a member who forgot their password. A new link revokes the previous one.
function ResetLink({ api, member }: { api: string; member: StaffRow }) {
  const [link, setLink] = useState('')
  const [copied, setCopied] = useState(false)
  return <div className="reset-link">
    <ActionForm grid={false} label={link ? 'Tạo link khác' : 'Tạo link đặt lại mật khẩu'} action={async () => {
      confirmOrCancel('Tạo link đặt lại mật khẩu cho ' + member.name + '? Link cũ chưa dùng sẽ hết hiệu lực.')
      const { code } = await send<{ code: string }>(api + '/staff/' + member.user_id + '/password-reset', {})
      setCopied(false)
      setLink(location.origin + basePath + '/gv/dat-lai-mat-khau#' + code)
    }}>
      <p className="muted">Dùng khi {member.name} quên mật khẩu. Link dùng một lần trong 24 giờ, gửi riêng cho người này.</p>
    </ActionForm>
    {link && <div className="invite" role="status">
      <Field label="Link đặt lại mật khẩu"><input readOnly value={link} onFocus={event => event.target.select()} /></Field>
      <button type="button" onClick={() => navigator.clipboard?.writeText(link).then(() => setCopied(true), () => undefined)}>
        {copied ? 'Đã sao chép' : 'Sao chép'}</button>
    </div>}
  </div>
}
export function Staff({ api, workspace, local }: WorkspaceProps & { local: boolean }) {
  const [code, setCode] = useState('')
  const [feedback, setFeedback] = useState('')
  const owner = workspace.role === 'owner'
  const list = useCollection<StaffRow>(api + '/staff' + (owner ? '?all=1' : ''))
  return <>
    <Header kicker="Vận hành đơn vị" title="Nhân sự"
      description={local ? 'Thêm hồ sơ giáo viên để phân công lớp và buổi học.' : 'Quản lý thành viên và cấp mã mời có thời hạn.'} />
    <Notice>{feedback}</Notice>
    {owner && local && <Panel title="Thêm giáo viên">
      <ActionForm label="Thêm giáo viên" action={data => send(api + '/staff', { name: value(data, 'name') })}
        onSaved={() => { setFeedback('Đã thêm giáo viên.'); list.load.refresh() }}>
        <TextField label="Họ và tên giáo viên" name="name" maxLength={100} required />
      </ActionForm>
    </Panel>}
    {owner && !local && <Panel title="Mời thành viên">
      <ActionForm label="Tạo mã mời" action={async data => {
        const role = value(data, 'role')
        const invite = await send<{ code: string }>(api + '/invitations', {
          email: value(data, 'email'), role, branch_id: value(data, 'branch_id') || null,
        })
        // Teachers get a link to the teacher page. The code sits after # so it never reaches server logs.
        setCode(role === 'teacher' ? location.origin + basePath + '/gv/kich-hoat#' + invite.code : invite.code)
      }}>
        <Field label="Email người nhận"><input name="email" type="email" maxLength={254} required /></Field>
        <Field label="Vai trò"><select name="role"><option value="teacher">Giáo viên</option><option value="branch_admin">Quản trị cơ sở</option></select></Field>
        <RemoteSelect<Item> url={api + '/branches'} name="branch_id" label="Cơ sở (bắt buộc với quản trị cơ sở)" required={false} toOption={identityOption} />
      </ActionForm>
      {code && <div className="invite" role="status">
        <p>{code.includes('#') ? 'Link dùng một lần trong 24 giờ. Gửi riêng cho giáo viên; mở link trên điện thoại để tạo mật khẩu và vào trang giáo viên.'
          : 'Mã dùng một lần trong 24 giờ. Gửi riêng cho người nhận.'}</p>
        <Field label={code.includes('#') ? 'Link kích hoạt vừa tạo' : 'Mã mời vừa tạo'}>
          <input readOnly value={code} onFocus={event => event.target.select()} /></Field>
        <button type="button" onClick={() => navigator.clipboard?.writeText(code).then(() => setFeedback('Đã sao chép.'), () => undefined)}>Sao chép</button>
      </div>}
    </Panel>}
    <Panel title={owner ? 'Thành viên đơn vị' : 'Giáo viên cơ sở'}>
      <PageSearch placeholder="Tên thành viên" action={list.search} />
      <Collection state={list} render={items => <div className="list">{items.map(row => <details className="detail-row" key={row.user_id}>
        <summary><strong>{row.name}</strong><span>{roles[row.role]}</span>
          <span className="badge">{row.active ? 'Đang hoạt động' : 'Đã tạm dừng'}</span></summary>
        {owner && row.role !== 'owner' ? <ActionForm label={local
          ? (row.active ? 'Ngừng phân công' : 'Cho phép phân công')
          : (row.active ? 'Tạm dừng quyền truy cập' : 'Khôi phục quyền truy cập')}
          action={async () => {
            const message = local
              ? (row.active ? 'Ngừng phân công giáo viên này?' : 'Cho phép phân công giáo viên này?')
              : (row.active ? 'Tạm dừng quyền truy cập của thành viên này?' : 'Khôi phục quyền truy cập của thành viên này?')
            confirmOrCancel(message)
            await send(api + '/staff/' + row.user_id, { active: !row.active }, 'PATCH')
          }} onSaved={() => { setFeedback(local ? 'Đã cập nhật hồ sơ giáo viên.' : 'Đã cập nhật quyền truy cập.'); list.load.refresh() }}>
          <p>Lịch sử giảng dạy và điểm danh của thành viên được lưu giữ.</p>
        </ActionForm> : <p>{roles[row.role]}</p>}
        {owner && !local && row.role !== 'owner' && <ResetLink api={api} member={row} />}
      </details>)}</div>} />
    </Panel>
  </>
}
export function WorkspaceSettings({ api, workspace, refresh }: WorkspaceProps & { refresh: () => Promise<unknown> }) {
  const list = useCollection<Item>(api + '/branches')
  const [feedback, setFeedback] = useState('')
  return <>
    <Header kicker="Vận hành đơn vị" title="Thiết lập" description="Thông tin đơn vị, múi giờ và cơ sở." />
    {workspace.shared_directory && <DirectorySettings api={api} />}
    <Notice>{feedback}</Notice>
    <Panel title="Hồ sơ đơn vị">
      <ActionForm key={workspace.name + workspace.type} action={async data => {
        await send(api + '/settings', { name: value(data, 'name'), type: value(data, 'type') }, 'PATCH')
        await refresh()
        setFeedback('Đã lưu thiết lập.')
      }}>
        <TextField label="Tên đơn vị" name="name" initial={workspace.name} maxLength={120} required /><TypeField current={workspace.type} />
      </ActionForm>
      <p className="muted">Múi giờ Việt Nam · Asia/Ho_Chi_Minh{workspace.type === 'school' ? '' :
        ' · Chọn loại hình Trường học để dùng học kỳ, môn học, thời khóa biểu và điểm danh theo buổi.'}</p>
    </Panel>
    {workspace.type === 'school' && <SchoolSettings api={api} schoolName={workspace.name} />}
    <Panel title="Cơ sở">
      <ActionForm label="Thêm cơ sở" action={data => send(api + '/branches', { name: value(data, 'name') })}
        onSaved={() => { setFeedback('Đã thêm cơ sở.'); list.load.refresh() }}>
        <TextField label="Tên cơ sở" name="name" maxLength={100} required />
      </ActionForm>
      <Collection state={list} render={items => <ul>{items.map(item => <li key={item.id}>{item.name}</li>)}</ul>} />
    </Panel>
  </>
}
