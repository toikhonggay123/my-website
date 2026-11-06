import { z } from 'zod'
import {
  type Ctx, audit, bad, body, conflict, dayMs, db, dbFailure, isoDate, localInstant, missing, newId, now, one,
  optionalText, param, query, requireRole, result, router, rows, scopedClass, text, time, today, uuid, validated,
} from './core'
import { publicSlug } from './public'

// School mode: the owner keeps terms, subjects, bell periods, closures, subject teachers and a versioned
// weekly timetable. Attendance stays in ClassCheck with one session per class and shift (buổi),
// owned by the homeroom teacher (GVCN, the class's primary teacher assignment).

const shifts = ['morning', 'afternoon'] as const
type Shift = (typeof shifts)[number]
const shift = z.enum(shifts)
const memberId = z.string().regex(/^[a-zA-Z0-9_-]{16,64}$/)
/** Days ahead that publishing prepares attendance sessions for. */
export const prepareDays = 14
const maxSyncDays = 31

export const defaultSubjects: [string, string][] = [
  ['Toán', 'Toán'], ['Ngữ văn', 'Văn'], ['Tiếng Anh', 'Anh'], ['Khoa học tự nhiên', 'KHTN'],
  ['Lịch sử và Địa lý', 'LS&ĐL'], ['Giáo dục công dân', 'GDCD'], ['Tin học', 'Tin'], ['Công nghệ', 'CN'],
  ['Giáo dục thể chất', 'GDTC'], ['Âm nhạc', 'Nhạc'], ['Mĩ thuật', 'MT'], ['Hoạt động trải nghiệm', 'HĐTN'],
  ['Giáo dục địa phương', 'GDĐP'], ['Chào cờ', 'Chào cờ'], ['Sinh hoạt lớp', 'SHL'],
]
export const defaultBells: { shift: Shift; period: number; starts_at: string; ends_at: string }[] = [
  ['morning', 1, '07:00', '07:45'], ['morning', 2, '07:50', '08:35'], ['morning', 3, '08:50', '09:35'],
  ['morning', 4, '09:40', '10:25'], ['morning', 5, '10:30', '11:15'],
  ['afternoon', 1, '13:30', '14:15'], ['afternoon', 2, '14:20', '15:05'], ['afternoon', 3, '15:20', '16:05'],
  ['afternoon', 4, '16:10', '16:55'], ['afternoon', 5, '17:00', '17:45'],
].map(([shift, period, starts_at, ends_at]) => ({ shift: shift as Shift, period: period as number, starts_at: starts_at as string, ends_at: ends_at as string }))

type Term = { id: string; name: string; starts_on: string; ends_on: string }
type Version = { id: string; term_id: string; status: 'draft' | 'published' | 'archived'; effective_from: string | null }
type Bell = { shift: Shift; period: number; starts_at: string; ends_at: string }
type Slot = { class_id: string; weekday: number; shift: Shift; period: number; subject_id: string; room: string }
export type SyncSummary = { created: number; updated: number; cancelled: number; failures: { class_name: string; message: string }[] }

export const weekdayOf = (date: string) => new Date(date + 'T00:00:00Z').getUTCDay() || 7
const addDays = (date: string, days: number) => new Date(Date.parse(date) + days * dayMs).toISOString().slice(0, 10)
const owner = (c: Ctx) => requireRole(c, 'owner')

async function termFor(c: Ctx, id = param(c, 'termId')) {
  const term = await one<Term>(c, 'SELECT id,name,starts_on,ends_on FROM school_terms WHERE org_id=? AND id=?', c.get('scope').orgId, id)
  if (!term) throw missing()
  return term
}
async function versionFor(c: Ctx) {
  const version = await one<Version>(c, 'SELECT id,term_id,status,effective_from FROM timetable_versions WHERE org_id=? AND id=?',
    c.get('scope').orgId, param(c, 'versionId'))
  if (!version) throw missing()
  return version
}

function checkTerm(input: { starts_on: string; ends_on: string }) {
  if (input.starts_on > input.ends_on) throw bad('Ngày kết thúc học kỳ phải từ ngày bắt đầu trở đi.')
  if (Date.parse(input.ends_on) - Date.parse(input.starts_on) > 366 * dayMs) throw bad('Một học kỳ dài tối đa 366 ngày.')
}

function checkBells(periods: Bell[]) {
  const keys = new Set(periods.map(row => row.shift + ':' + row.period))
  if (keys.size !== periods.length) throw bad('Mỗi tiết trong một buổi chỉ khai báo một lần.')
  for (const name of shifts) {
    const ordered = periods.filter(row => row.shift === name).sort((a, b) => a.period - b.period)
    for (const [index, row] of ordered.entries()) {
      if (row.ends_at <= row.starts_at) throw bad('Tiết ' + row.period + ' cần giờ kết thúc sau giờ bắt đầu.')
      const previous = ordered[index - 1]
      if (previous && previous.ends_at > row.starts_at) throw bad('Tiết ' + row.period + ' bắt đầu trước khi tiết ' + previous.period + ' kết thúc.')
    }
  }
}

/** Teacher for each (class, subject) in a term, plus clashes where one teacher has two classes in the same period. */
async function timetableIssues(c: Ctx, version: Version, slots: Slot[]) {
  const { orgId } = c.get('scope')
  const [assignments, classes, subjects] = await Promise.all([
    rows<{ class_id: string; subject_id: string; user_id: string; name: string }>(c, `SELECT t.class_id,t.subject_id,t.user_id,u.name
      FROM teaching_assignments t JOIN "user" u ON u.id=t.user_id WHERE t.org_id=? AND t.term_id=?`, orgId, version.term_id),
    rows<{ id: string; name: string }>(c, 'SELECT id,name FROM classes WHERE org_id=?', orgId),
    rows<{ id: string; name: string }>(c, 'SELECT id,name FROM subjects WHERE org_id=?', orgId),
  ])
  const teacher = new Map(assignments.map(row => [row.class_id + ':' + row.subject_id, row]))
  const className = new Map(classes.map(row => [row.id, row.name]))
  const subjectName = new Map(subjects.map(row => [row.id, row.name]))
  const busy = new Map<string, Slot[]>()
  const unassigned = new Map<string, { class_name: string; subject_name: string }>()
  const enriched = slots.map(slot => {
    const assigned = teacher.get(slot.class_id + ':' + slot.subject_id)
    if (assigned) {
      const key = assigned.user_id + ':' + slot.weekday + ':' + slot.shift + ':' + slot.period
      busy.set(key, [...busy.get(key) ?? [], slot])
    } else {
      unassigned.set(slot.class_id + ':' + slot.subject_id, {
        class_name: className.get(slot.class_id) ?? '', subject_name: subjectName.get(slot.subject_id) ?? '',
      })
    }
    return { ...slot, teacher_id: assigned?.user_id ?? null, teacher_name: assigned?.name ?? null }
  })
  const clashes = [...busy.entries()].filter(([, list]) => list.length > 1).map(([key, list]) => ({
    teacher_name: teacher.get(list[0].class_id + ':' + list[0].subject_id)?.name ?? '',
    weekday: list[0].weekday, shift: list[0].shift, period: list[0].period,
    classes: list.map(slot => className.get(slot.class_id) ?? '').sort(),
    user_id: key.split(':')[0],
  }))
  return { slots: enriched, clashes, unassigned: [...unassigned.values()] }
}

/**
 * Makes attendance sessions for [from, to] match the published timetables. Only sessions that have not started
 * and hold no attendance are changed. Dates before today are never touched. Each class is written in its own
 * batch so one schedule conflict does not block the other classes.
 */
export async function reconcileSchoolSessions(c: Ctx, from: string, to: string): Promise<SyncSummary> {
  const { orgId, userId } = c.get('scope')
  const summary: SyncSummary = { created: 0, updated: 0, cancelled: 0, failures: [] }
  const start = from < today() ? today() : from
  if (start > to) return summary
  const [terms, versions, slotGroups, bells, closures, classes, existing] = await Promise.all([
    rows<Term>(c, 'SELECT id,name,starts_on,ends_on FROM school_terms WHERE org_id=? AND starts_on<=? AND ends_on>=?', orgId, to, start),
    rows<Version>(c, `SELECT id,term_id,status,effective_from FROM timetable_versions WHERE org_id=? AND status='published'
      ORDER BY effective_from DESC`, orgId),
    rows<{ version_id: string; class_id: string; weekday: number; shift: Shift; first: number; last: number }>(c,
      `SELECT version_id,class_id,weekday,shift,MIN(period) AS first,MAX(period) AS last FROM timetable_slots
      WHERE org_id=? AND version_id IN (SELECT id FROM timetable_versions WHERE org_id=? AND status='published')
      GROUP BY version_id,class_id,weekday,shift`, orgId, orgId),
    rows<Bell>(c, 'SELECT shift,period,starts_at,ends_at FROM bell_periods WHERE org_id=?', orgId),
    rows<{ closed_on: string }>(c, 'SELECT closed_on FROM school_closures WHERE org_id=? AND closed_on BETWEEN ? AND ?', orgId, start, to),
    rows<{ id: string; name: string; branch_id: string; room: string; status: string; starts_on: string; ends_on: string; homeroom: string | null }>(c,
      `SELECT cl.id,cl.name,cl.branch_id,cl.room,cl.status,cl.starts_on,cl.ends_on,m.user_id AS homeroom FROM classes cl
      LEFT JOIN teacher_assignments a ON a.org_id=cl.org_id AND a.class_id=cl.id AND a.ended_at IS NULL AND a.duty='primary'
      LEFT JOIN memberships m ON m.org_id=a.org_id AND m.user_id=a.user_id AND m.active=1 AND m.role='teacher'
      WHERE cl.org_id=?`, orgId),
    rows<{ id: string; class_id: string; lesson_date: string; shift: Shift; status: string; attendance_state: string
      starts_at: number; ends_at: number; teacher_id: string; version: number; pinned: number }>(c,
      `SELECT id,class_id,lesson_date,shift,status,attendance_state,starts_at,ends_at,teacher_id,version,pinned FROM class_sessions
      WHERE org_id=? AND shift IS NOT NULL AND lesson_date BETWEEN ? AND ?`, orgId, start, to),
  ])
  const bell = new Map(bells.map(row => [row.shift + ':' + row.period, row]))
  const closed = new Set(closures.map(row => row.closed_on))
  const groups = new Map<string, typeof slotGroups>()
  for (const row of slotGroups) {
    const key = row.version_id + ':' + row.weekday
    groups.set(key, [...groups.get(key) ?? [], row])
  }
  type Want = { date: string; shift: Shift; starts: number; ends: number }
  const wanted = new Map<string, Map<string, Want>>()
  const problems = new Map<string, string>()
  for (let date = start; date <= to; date = addDays(date, 1)) {
    const term = terms.find(row => row.starts_on <= date && date <= row.ends_on)
    const version = term && versions.find(row => row.term_id === term.id && row.effective_from! <= date)
    if (!version || closed.has(date)) continue
    for (const group of groups.get(version.id + ':' + weekdayOf(date)) ?? []) {
      const first = bell.get(group.shift + ':' + group.first), last = bell.get(group.shift + ':' + group.last)
      if (!first || !last) {
        problems.set(group.class_id, 'Thiếu khung giờ cho tiết ' + (first ? group.last : group.first) + (group.shift === 'morning' ? ' buổi sáng.' : ' buổi chiều.'))
        continue
      }
      const list = wanted.get(group.class_id) ?? new Map<string, Want>()
      list.set(date + ':' + group.shift, {
        date, shift: group.shift, starts: localInstant(date, first.starts_at), ends: localInstant(date, last.ends_at),
      })
      wanted.set(group.class_id, list)
    }
  }
  const timestamp = now()
  for (const item of classes) {
    const want = wanted.get(item.id) ?? new Map<string, Want>()
    const open = ['scheduled', 'active'].includes(item.status)
    for (const [key, value] of want) if (!open || value.date < item.starts_on || value.date > item.ends_on) want.delete(key)
    const current = existing.filter(row => row.class_id === item.id)
    if (!want.size && !current.length) {
      if (problems.has(item.id)) summary.failures.push({ class_name: item.name, message: problems.get(item.id)! })
      continue
    }
    const statements: D1PreparedStatement[] = []
    let created = 0, updated = 0, cancelled = 0
    if (want.size && !item.homeroom) summary.failures.push({ class_name: item.name, message: 'Lớp chưa có giáo viên chủ nhiệm.' })
    else if (problems.has(item.id)) summary.failures.push({ class_name: item.name, message: problems.get(item.id)! })
    for (const row of current) {
      const mutable = row.attendance_state === 'unmarked' && row.starts_at > timestamp && !row.pinned
      if (!mutable) continue
      const target = want.get(row.lesson_date + ':' + row.shift)
      if (target && item.homeroom) {
        if (row.status !== 'scheduled' || row.starts_at !== target.starts || row.ends_at !== target.ends || row.teacher_id !== item.homeroom) {
          statements.push(query(c, `UPDATE class_sessions SET status='scheduled',starts_at=?,ends_at=?,teacher_id=?,version=version+1,updated_at=?
            WHERE org_id=? AND id=? AND version=? AND attendance_state='unmarked'`,
          target.starts, target.ends, item.homeroom, timestamp, orgId, row.id, row.version))
          updated++
        }
      } else if (!target && row.status === 'scheduled') {
        statements.push(query(c, `UPDATE class_sessions SET status='cancelled',version=version+1,updated_at=?
          WHERE org_id=? AND id=? AND version=? AND attendance_state='unmarked'`, timestamp, orgId, row.id, row.version))
        cancelled++
      }
    }
    if (item.homeroom) {
      for (const [key, target] of want) {
        if (current.some(row => row.lesson_date + ':' + row.shift === key)) continue
        statements.push(query(c, `INSERT INTO class_sessions(org_id,id,class_id,branch_id,teacher_id,lesson_date,starts_at,ends_at,room,shift,
          status,attendance_state,version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,'scheduled','unmarked',0,?,?)`,
        orgId, newId(), item.id, item.branch_id, item.homeroom, target.date, target.starts, target.ends, item.room, target.shift,
        timestamp, timestamp))
        created++
      }
    }
    if (!statements.length) continue
    try {
      await db(c).batch(statements)
      summary.created += created
      summary.updated += updated
      summary.cancelled += cancelled
    } catch (error) {
      const known = dbFailure(error)
      if (!known) throw error
      summary.failures.push({ class_name: item.name, message: known.message })
    }
  }
  if (summary.created || summary.updated || summary.cancelled) {
    await query(c, `INSERT INTO audit_events(org_id,id,actor_id,event,target_id,occurred_at,details) VALUES (?,?,?,?,?,?,?)`,
      orgId, newId(), userId, 'school.sessions_synced', orgId, timestamp,
      JSON.stringify({ from: start, to, created: summary.created, updated: summary.updated, cancelled: summary.cancelled })).run()
  }
  return summary
}

/** The published timetable version that applies on a date, if any. */
export async function effectiveVersion(c: Ctx, date: string) {
  const row = await one<{ id: string; term_id: string }>(c, `SELECT v.id,v.term_id FROM timetable_versions v
    JOIN school_terms t ON t.org_id=v.org_id AND t.id=v.term_id
    WHERE v.org_id=? AND v.status='published' AND t.starts_on<=? AND t.ends_on>=? AND v.effective_from<=?
    ORDER BY v.effective_from DESC LIMIT 1`, c.get('scope').orgId, date, date, date)
  return row ?? null
}

/** True when the teacher has a period with this class in this shift on this date (closures excluded). */
export async function teachesShift(c: Ctx, userId: string, classId: string, date: string, shift: string) {
  const version = await effectiveVersion(c, date)
  if (!version) return false
  const { orgId } = c.get('scope')
  return Boolean(await one(c, `SELECT 1 FROM timetable_slots s JOIN teaching_assignments a ON a.org_id=s.org_id
      AND a.term_id=? AND a.class_id=s.class_id AND a.subject_id=s.subject_id
    WHERE s.org_id=? AND s.version_id=? AND s.class_id=? AND s.weekday=? AND s.shift=? AND a.user_id=?
      AND NOT EXISTS (SELECT 1 FROM school_closures x WHERE x.org_id=s.org_id AND x.closed_on=?) LIMIT 1`,
  version.term_id, orgId, version.id, classId, weekdayOf(date), shift, userId, date))
}

// Keeps the next two weeks of attendance sessions ready without a scheduler: the first dashboard or teacher
// page load of a day prepares them. Best effort per Worker isolate; reconciliation is idempotent.
const preparedOn = new Map<string, string>()
export async function ensurePrepared(c: Ctx) {
  const { orgId } = c.get('scope')
  const date = today()
  if (preparedOn.get(orgId) === date) return
  const org = await one<{ type: string }>(c, 'SELECT type FROM organizations WHERE id=?', orgId)
  if (org?.type === 'school') {
    const horizon = addDays(date, prepareDays - 1)
    const ready = await one(c, `SELECT 1 FROM class_sessions WHERE org_id=? AND shift IS NOT NULL AND lesson_date>=? LIMIT 1`,
      orgId, addDays(date, 6))
    if (!ready && await one(c, `SELECT 1 FROM timetable_versions WHERE org_id=? AND status='published' LIMIT 1`, orgId)) {
      await reconcileSchoolSessions(c, date, horizon)
    }
  }
  preparedOn.set(orgId, date)
}

const termInput = z.object({ name: text(80), starts_on: isoDate, ends_on: isoDate })
const subjectInput = z.object({ name: text(80), short_name: optionalText(20) })
const bellInput = z.object({ shift, period: z.number().int().min(1).max(10), starts_at: time, ends_at: time })
const slotInput = z.object({
  weekday: z.number().int().min(1).max(7), shift, period: z.number().int().min(1).max(10),
  subject_id: uuid, room: optionalText(80),
})

export const school = router()
  .get('/school/setup', async c => {
    const { orgId } = owner(c)
    const [terms, subjects, bells, closures, org] = await Promise.all([
      rows(c, 'SELECT id,name,starts_on,ends_on FROM school_terms WHERE org_id=? ORDER BY starts_on,id', orgId),
      rows(c, 'SELECT id,name,short_name,archived FROM subjects WHERE org_id=? ORDER BY archived,name,id', orgId),
      rows(c, "SELECT shift,period,starts_at,ends_at FROM bell_periods WHERE org_id=? ORDER BY shift='afternoon',period", orgId),
      rows(c, 'SELECT closed_on,reason FROM school_closures WHERE org_id=? AND closed_on>=? ORDER BY closed_on LIMIT 100',
        orgId, addDays(today(), -30)),
      one<{ public_slug: string | null }>(c, 'SELECT public_slug FROM organizations WHERE id=?', orgId),
    ])
    return result(c, { today: today(), terms, subjects, bells, closures, default_bells: defaultBells, public_slug: org?.public_slug ?? null })
  })
  .patch('/school/public', async c => {
    const { orgId } = owner(c)
    const { slug } = await body(c, z.object({ slug: publicSlug.nullable() }))
    const write = await db(c).batch([
      query(c, "UPDATE organizations SET public_slug=?,updated_at=? WHERE id=? AND type='school'", slug, now(), orgId),
      audit(c, slug ? 'school.public_timetable_enabled' : 'school.public_timetable_disabled', orgId, { slug }),
    ])
    if (!write[0].meta.changes) throw conflict('Chỉ đơn vị loại Trường học mới công bố được thời khóa biểu cho học sinh.')
    return result(c, { slug })
  })
  .post('/school/terms', async c => {
    const { orgId } = owner(c)
    const input = await body(c, termInput)
    checkTerm(input)
    const id = newId()
    const writes = await db(c).batch([
      query(c, `INSERT INTO school_terms(org_id,id,name,starts_on,ends_on,created_at) SELECT ?,?,?,?,?,?
        WHERE NOT EXISTS (SELECT 1 FROM school_terms WHERE org_id=? AND starts_on<=? AND ends_on>=?)`,
      orgId, id, input.name, input.starts_on, input.ends_on, now(), orgId, input.ends_on, input.starts_on),
      query(c, `INSERT INTO audit_events(org_id,id,actor_id,event,target_id,occurred_at)
        SELECT ?,?,?,'school.term_created',?,? WHERE changes()=1`, orgId, newId(), c.get('scope').userId, id, now()),
    ])
    if (!writes[0].meta.changes) throw conflict('Học kỳ trùng thời gian với một học kỳ đã có.')
    return result(c, { id }, 201)
  })
  .patch('/school/terms/:termId', async c => {
    const { orgId } = owner(c)
    const term = await termFor(c)
    const input = await body(c, termInput)
    checkTerm(input)
    const write = await query(c, `UPDATE school_terms SET name=?,starts_on=?,ends_on=? WHERE org_id=? AND id=?
      AND NOT EXISTS (SELECT 1 FROM school_terms o WHERE o.org_id=? AND o.id<>? AND o.starts_on<=? AND o.ends_on>=?)
      AND NOT EXISTS (SELECT 1 FROM timetable_versions v WHERE v.org_id=? AND v.term_id=? AND v.status='published'
        AND (v.effective_from<? OR v.effective_from>?))`,
    input.name, input.starts_on, input.ends_on, orgId, term.id, orgId, term.id, input.ends_on, input.starts_on,
    orgId, term.id, input.starts_on, input.ends_on).run()
    if (!write.meta.changes) throw conflict('Học kỳ trùng với học kỳ khác hoặc không còn chứa ngày áp dụng của thời khóa biểu đã công bố.')
    return result(c, { id: term.id })
  })
  .post('/school/subjects', async c => {
    const { orgId } = owner(c)
    const input = await body(c, subjectInput)
    const id = newId()
    await query(c, 'INSERT INTO subjects(org_id,id,name,short_name,created_at) VALUES (?,?,?,?,?)',
      orgId, id, input.name, input.short_name, now()).run()
    return result(c, { id }, 201)
  })
  .post('/school/subjects/defaults', async c => {
    const { orgId } = owner(c)
    const timestamp = now()
    const write = await query(c, `INSERT INTO subjects(org_id,id,name,short_name,created_at)
      SELECT ?,value->>'id',value->>'name',value->>'short',? FROM json_each(?) WHERE 1
      ON CONFLICT(org_id,name) DO NOTHING`, orgId, timestamp,
    JSON.stringify(defaultSubjects.map(([name, short]) => ({ id: newId(), name, short })))).run()
    return result(c, { created: write.meta.changes ?? 0 }, 201)
  })
  .patch('/school/subjects/:subjectId', async c => {
    const { orgId } = owner(c)
    const id = param(c, 'subjectId')
    const input = await body(c, subjectInput.extend({ archived: z.boolean().default(false) }))
    const write = await query(c, 'UPDATE subjects SET name=?,short_name=?,archived=? WHERE org_id=? AND id=?',
      input.name, input.short_name, Number(input.archived), orgId, id).run()
    if (!write.meta.changes) throw missing()
    return result(c, { id })
  })
  .put('/school/bells', async c => {
    const { orgId } = owner(c)
    const { periods } = await body(c, z.object({ periods: z.array(bellInput).min(1).max(20) }))
    checkBells(periods)
    await db(c).batch([
      query(c, 'DELETE FROM bell_periods WHERE org_id=?', orgId),
      query(c, `INSERT INTO bell_periods(org_id,shift,period,starts_at,ends_at)
        SELECT ?,value->>'shift',value->>'period',value->>'starts_at',value->>'ends_at' FROM json_each(?)`, orgId, JSON.stringify(periods)),
      audit(c, 'school.bells_updated', orgId, { periods: periods.length }),
    ])
    return result(c, { periods: periods.length })
  })
  .post('/school/closures', async c => {
    const { orgId } = owner(c)
    const input = await body(c, z.object({ closed_on: isoDate, reason: text(120) }))
    await db(c).batch([
      query(c, `INSERT INTO school_closures(org_id,closed_on,reason,created_at) VALUES (?,?,?,?)
        ON CONFLICT(org_id,closed_on) DO UPDATE SET reason=excluded.reason`, orgId, input.closed_on, input.reason, now()),
      audit(c, 'school.closure_saved', orgId, input),
    ])
    return result(c, { sync: await reconcileSchoolSessions(c, input.closed_on, input.closed_on) }, 201)
  })
  .delete('/school/closures/:date', async c => {
    const { orgId } = owner(c)
    const date = validated(isoDate, c.req.param('date'))
    const write = await query(c, 'DELETE FROM school_closures WHERE org_id=? AND closed_on=?', orgId, date).run()
    if (!write.meta.changes) throw missing()
    await audit(c, 'school.closure_removed', orgId, { closed_on: date }).run()
    return result(c, { sync: await reconcileSchoolSessions(c, date, date) })
  })
  .get('/school/teachers', async c => {
    const { orgId } = owner(c)
    return result(c, await rows(c, `SELECT m.user_id AS id,u.name FROM memberships m JOIN "user" u ON u.id=m.user_id
      WHERE m.org_id=? AND m.role='teacher' AND m.active=1 ORDER BY u.name,u.id LIMIT 500`, orgId))
  })
  .get('/school/classes', async c => {
    const { orgId } = owner(c)
    return result(c, await rows(c, `SELECT cl.id,cl.code,cl.name,cl.status,cl.room,d.grade,a.user_id AS homeroom_id,u.name AS homeroom_name
      FROM classes cl LEFT JOIN directory_classes d ON d.org_id=cl.org_id AND d.class_id=cl.id
      LEFT JOIN teacher_assignments a ON a.org_id=cl.org_id AND a.class_id=cl.id AND a.ended_at IS NULL AND a.duty='primary'
      LEFT JOIN "user" u ON u.id=a.user_id
      WHERE cl.org_id=? AND cl.status IN ('draft','scheduled','active') ORDER BY cl.name,cl.id LIMIT 200`, orgId))
  })
  .put('/school/classes/:classId/homeroom', async c => {
    const { orgId, userId } = owner(c)
    const item = await scopedClass(c)
    const { user_id: teacher } = await body(c, z.object({ user_id: memberId }))
    const current = await one<{ user_id: string }>(c, `SELECT user_id FROM teacher_assignments
      WHERE org_id=? AND class_id=? AND ended_at IS NULL AND duty='primary'`, orgId, item.id)
    if (current?.user_id === teacher) return result(c, { id: teacher })
    const eligible = `EXISTS (SELECT 1 FROM memberships WHERE org_id=? AND user_id=? AND role='teacher' AND active=1
      AND (branch_id IS NULL OR branch_id=?))`
    const timestamp = now()
    const writes = await db(c).batch([
      query(c, `UPDATE teacher_assignments SET ended_at=? WHERE org_id=? AND class_id=? AND ended_at IS NULL
        AND (duty='primary' OR user_id=?) AND ${eligible}`, timestamp, orgId, item.id, teacher, orgId, teacher, item.branch_id),
      query(c, `INSERT INTO teacher_assignments(org_id,class_id,user_id,duty,assigned_at)
        SELECT ?,?,?,'primary',? WHERE ${eligible}`, orgId, item.id, teacher, timestamp, orgId, teacher, item.branch_id),
      // Sessions that hold no attendance move to the new homeroom teacher. Recorded sessions keep their history.
      query(c, `UPDATE class_sessions SET teacher_id=?,version=version+1,updated_at=? WHERE org_id=? AND class_id=?
        AND shift IS NOT NULL AND status='scheduled' AND attendance_state='unmarked' AND teacher_id<>? AND ${eligible}`,
      teacher, timestamp, orgId, item.id, teacher, orgId, teacher, item.branch_id),
      query(c, `INSERT INTO audit_events(org_id,id,actor_id,event,target_id,occurred_at,details)
        SELECT ?,?,?,'school.homeroom_assigned',?,?,? WHERE ${eligible}`,
      orgId, newId(), userId, item.id, timestamp, JSON.stringify({ userId: teacher, previous: current?.user_id ?? null }),
      orgId, teacher, item.branch_id),
    ])
    if (!writes[1].meta.changes) throw missing()
    return result(c, { id: teacher })
  })
  .get('/school/terms/:termId/assignments', async c => {
    const { orgId } = owner(c)
    const term = await termFor(c)
    return result(c, await rows(c, `SELECT t.class_id,t.subject_id,t.user_id,u.name AS teacher_name FROM teaching_assignments t
      JOIN "user" u ON u.id=t.user_id WHERE t.org_id=? AND t.term_id=?`, orgId, term.id))
  })
  .put('/school/terms/:termId/assignments', async c => {
    const { orgId } = owner(c)
    const term = await termFor(c)
    const input = await body(c, z.object({ class_id: uuid, subject_id: uuid, user_id: memberId.nullable() }))
    await scopedClass(c, input.class_id)
    if (!input.user_id) {
      await query(c, 'DELETE FROM teaching_assignments WHERE org_id=? AND term_id=? AND class_id=? AND subject_id=?',
        orgId, term.id, input.class_id, input.subject_id).run()
      return result(c, { user_id: null })
    }
    const write = await query(c, `INSERT INTO teaching_assignments(org_id,term_id,class_id,subject_id,user_id,updated_at)
      SELECT ?,?,?,?,user_id,? FROM memberships WHERE org_id=? AND user_id=? AND role='teacher' AND active=1
      ON CONFLICT(org_id,term_id,class_id,subject_id) DO UPDATE SET user_id=excluded.user_id,updated_at=excluded.updated_at`,
    orgId, term.id, input.class_id, input.subject_id, now(), orgId, input.user_id).run()
    if (!write.meta.changes) throw missing()
    return result(c, { user_id: input.user_id })
  })
  .get('/school/terms/:termId/timetable', async c => {
    const { orgId } = owner(c)
    const term = await termFor(c)
    const versions = await rows(c, `SELECT v.id,v.status,v.effective_from,v.updated_at,v.published_at,u.name AS published_by,
      (SELECT COUNT(DISTINCT s.class_id) FROM timetable_slots s WHERE s.org_id=v.org_id AND s.version_id=v.id) AS classes
      FROM timetable_versions v LEFT JOIN "user" u ON u.id=v.published_by
      WHERE v.org_id=? AND v.term_id=? ORDER BY v.status='draft' DESC,v.effective_from DESC,v.published_at DESC LIMIT 30`, orgId, term.id)
    return result(c, { term, versions })
  })
  .post('/school/terms/:termId/timetable/draft', async c => {
    const { orgId } = owner(c)
    const term = await termFor(c)
    const id = newId(), timestamp = now()
    const writes = await db(c).batch([
      query(c, `INSERT INTO timetable_versions(org_id,id,term_id,status,created_at,updated_at) SELECT ?,?,?,'draft',?,?
        WHERE NOT EXISTS (SELECT 1 FROM timetable_versions WHERE org_id=? AND term_id=? AND status='draft')`,
      orgId, id, term.id, timestamp, timestamp, orgId, term.id),
      // A new draft starts from the latest published version of the term.
      query(c, `INSERT INTO timetable_slots(org_id,version_id,class_id,weekday,shift,period,subject_id,room)
        SELECT org_id,?,class_id,weekday,shift,period,subject_id,room FROM timetable_slots
        WHERE org_id=? AND version_id=(SELECT id FROM timetable_versions WHERE org_id=? AND term_id=? AND status='published'
          ORDER BY effective_from DESC LIMIT 1) AND changes()=1`, id, orgId, orgId, term.id),
      audit(c, 'school.timetable_draft_created', id),
    ])
    if (!writes[0].meta.changes) throw conflict('Học kỳ này đã có bản nháp thời khóa biểu.')
    return result(c, { id }, 201)
  })
  .get('/school/timetable/:versionId', async c => {
    const { orgId } = owner(c)
    const version = await versionFor(c)
    const slots = await rows<Slot>(c, `SELECT class_id,weekday,shift,period,subject_id,room FROM timetable_slots
      WHERE org_id=? AND version_id=? ORDER BY class_id,weekday,shift,period`, orgId, version.id)
    return result(c, { version, ...await timetableIssues(c, version, slots) })
  })
  .put('/school/timetable/:versionId/classes/:classId', async c => {
    const { orgId } = owner(c)
    const version = await versionFor(c)
    if (version.status !== 'draft') throw conflict('Chỉ sửa được bản nháp. Hãy tạo bản nháp mới từ bản đã công bố.')
    const item = await scopedClass(c)
    const { slots } = await body(c, z.object({ slots: z.array(slotInput).max(140) }))
    const cells = new Set(slots.map(slot => slot.weekday + ':' + slot.shift + ':' + slot.period))
    if (cells.size !== slots.length) throw bad('Mỗi tiết chỉ xếp một môn.')
    const bells = new Set((await rows<Bell>(c, 'SELECT shift,period FROM bell_periods WHERE org_id=?', orgId))
      .map(row => row.shift + ':' + row.period))
    const missingBell = slots.find(slot => !bells.has(slot.shift + ':' + slot.period))
    if (missingBell) throw bad('Chưa khai báo giờ cho tiết ' + missingBell.period + (missingBell.shift === 'morning' ? ' buổi sáng.' : ' buổi chiều.'))
    const draft = `EXISTS (SELECT 1 FROM timetable_versions WHERE org_id=? AND id=? AND status='draft')`
    const timestamp = now()
    const writes = await db(c).batch([
      query(c, `UPDATE timetable_versions SET updated_at=? WHERE org_id=? AND id=? AND status='draft'`, timestamp, orgId, version.id),
      query(c, `DELETE FROM timetable_slots WHERE org_id=? AND version_id=? AND class_id=? AND ${draft}`,
        orgId, version.id, item.id, orgId, version.id),
      query(c, `INSERT INTO timetable_slots(org_id,version_id,class_id,weekday,shift,period,subject_id,room)
        SELECT ?,?,?,value->>'weekday',value->>'shift',value->>'period',value->>'subject_id',value->>'room'
        FROM json_each(?) WHERE ${draft}`, orgId, version.id, item.id, JSON.stringify(slots), orgId, version.id),
    ])
    if (!writes[0].meta.changes) throw conflict('Bản nháp vừa được công bố hoặc hủy. Hãy tải lại.')
    return result(c, { slots: slots.length })
  })
  .post('/school/timetable/:versionId/discard', async c => {
    const { orgId } = owner(c)
    const version = await versionFor(c)
    if (version.status !== 'draft') throw conflict('Chỉ hủy được bản nháp.')
    await db(c).batch([
      query(c, `DELETE FROM timetable_slots WHERE org_id=? AND version_id=?
        AND EXISTS (SELECT 1 FROM timetable_versions WHERE org_id=? AND id=? AND status='draft')`, orgId, version.id, orgId, version.id),
      query(c, `DELETE FROM timetable_versions WHERE org_id=? AND id=? AND status='draft'`, orgId, version.id),
      audit(c, 'school.timetable_draft_discarded', version.id),
    ])
    return result(c, { id: version.id })
  })
  .post('/school/timetable/:versionId/publish', async c => {
    const { orgId, userId } = owner(c)
    const version = await versionFor(c)
    if (version.status !== 'draft') throw conflict('Bản này đã được công bố.')
    const term = await termFor(c, version.term_id)
    const { effective_from: from } = await body(c, z.object({ effective_from: isoDate }))
    if (from < today()) throw bad('Ngày áp dụng phải từ hôm nay trở đi.')
    if (from < term.starts_on || from > term.ends_on) throw bad('Ngày áp dụng phải nằm trong ' + term.name + '.')
    const slots = await rows<Slot>(c, `SELECT class_id,weekday,shift,period,subject_id,room FROM timetable_slots
      WHERE org_id=? AND version_id=?`, orgId, version.id)
    if (!slots.length) throw bad('Bản nháp chưa có tiết học nào.')
    const { clashes } = await timetableIssues(c, version, slots)
    if (clashes.length) {
      const first = clashes[0]
      throw conflict(first.teacher_name + ' bị xếp cùng lúc ở ' + first.classes.join(', ') + '. Hãy sửa ' + clashes.length + ' chỗ trùng trước khi công bố.')
    }
    const timestamp = now()
    const writes = await db(c).batch([
      query(c, `UPDATE timetable_versions SET status='archived',updated_at=? WHERE org_id=? AND term_id=? AND status='published'
        AND effective_from>=? AND EXISTS (SELECT 1 FROM timetable_versions WHERE org_id=? AND id=? AND status='draft')`,
      timestamp, orgId, term.id, from, orgId, version.id),
      query(c, `UPDATE timetable_versions SET status='published',effective_from=?,published_at=?,published_by=?,updated_at=?
        WHERE org_id=? AND id=? AND status='draft'`, from, timestamp, userId, timestamp, orgId, version.id),
      query(c, `INSERT INTO audit_events(org_id,id,actor_id,event,target_id,occurred_at,details)
        SELECT ?,?,?,'school.timetable_published',?,?,? WHERE changes()=1`,
      orgId, newId(), userId, version.id, timestamp, JSON.stringify({ effective_from: from, slots: slots.length })),
    ])
    if (!writes[1].meta.changes) throw conflict('Bản nháp vừa thay đổi. Hãy tải lại.')
    // Prepare the coming days, and also revisit sessions an earlier publication prepared further ahead.
    const furthest = await one<{ day: string | null }>(c, `SELECT MAX(lesson_date) AS day FROM class_sessions
      WHERE org_id=? AND shift IS NOT NULL AND lesson_date>=?`, orgId, from)
    const end = [addDays(from, prepareDays - 1), furthest?.day ?? from].sort().at(-1)!
    const to = [end, addDays(from, 61), term.ends_on].sort()[0]
    return result(c, { sync: await reconcileSchoolSessions(c, from, to) })
  })
  .post('/school/sessions/sync', async c => {
    owner(c)
    const input = await body(c, z.object({ from: isoDate, to: isoDate }))
    if (input.to < input.from || Date.parse(input.to) - Date.parse(input.from) >= maxSyncDays * dayMs) {
      throw bad('Chọn khoảng tối đa ' + maxSyncDays + ' ngày.')
    }
    return result(c, { sync: await reconcileSchoolSessions(c, input.from, input.to) })
  })
