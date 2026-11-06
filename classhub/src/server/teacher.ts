import { type Ctx, dayMs, isoDate, missing, now, one, param, requireRole, result, router, rows, today, validated } from './core'
import { effectiveVersion, ensurePrepared, weekdayOf } from './school'

// Read-only views for the teacher page. Every query is limited to the signed-in teacher: sessions they
// instruct, school periods they teach and classes they are assigned to.

type Period = { class_id: string; class_name: string; shift: 'morning' | 'afternoon'; period: number; subject: string
  room: string; starts_at: string | null; ends_at: string | null }
type MarkSession = { id: string; class_id: string; class_name: string; shift: string | null; lesson_date: string
  starts_at: number; ends_at: number; status: string; attendance_state: string; teacher_id: string; teacher_name: string }

const addDays = (date: string, days: number) => new Date(Date.parse(date) + days * dayMs).toISOString().slice(0, 10)
const teacher = (c: Ctx) => requireRole(c, 'teacher')

async function periodsOn(c: Ctx, date: string): Promise<{ closure: string | null; periods: Period[] }> {
  const { orgId, userId } = c.get('scope')
  const closure = await one<{ reason: string }>(c, 'SELECT reason FROM school_closures WHERE org_id=? AND closed_on=?', orgId, date)
  if (closure) return { closure: closure.reason, periods: [] }
  const version = await effectiveVersion(c, date)
  if (!version) return { closure: null, periods: [] }
  const periods = await rows<Period>(c, `SELECT s.class_id,cl.name AS class_name,s.shift,s.period,sub.name AS subject,s.room,
    b.starts_at,b.ends_at FROM timetable_slots s
    JOIN teaching_assignments a ON a.org_id=s.org_id AND a.term_id=? AND a.class_id=s.class_id AND a.subject_id=s.subject_id
    JOIN classes cl ON cl.org_id=s.org_id AND cl.id=s.class_id JOIN subjects sub ON sub.org_id=s.org_id AND sub.id=s.subject_id
    LEFT JOIN bell_periods b ON b.org_id=s.org_id AND b.shift=s.shift AND b.period=s.period
    WHERE s.org_id=? AND s.version_id=? AND s.weekday=? AND a.user_id=?
    ORDER BY s.shift='afternoon',s.period`, version.term_id, orgId, version.id, weekdayOf(date), userId)
  return { closure: null, periods }
}

/** Attendance totals and the names of students not marked present, per session. */
async function summaries(c: Ctx, ids: string[]) {
  if (!ids.length) return new Map<string, { counts: Record<string, number>; flagged: { name: string; status: string }[] }>()
  const { orgId } = c.get('scope')
  const list = JSON.stringify(ids)
  const [counts, flagged] = await Promise.all([
    rows<{ session_id: string; status: string; total: number }>(c, `SELECT session_id,status,COUNT(*) AS total FROM attendance_records
      WHERE org_id=? AND session_id IN (SELECT value FROM json_each(?)) GROUP BY session_id,status`, orgId, list),
    rows<{ session_id: string; name: string; status: string }>(c, `SELECT a.session_id,st.name,a.status FROM attendance_records a
      JOIN enrollments e ON e.org_id=a.org_id AND e.id=a.enrollment_id JOIN students st ON st.org_id=e.org_id AND st.id=e.student_id
      WHERE a.org_id=? AND a.session_id IN (SELECT value FROM json_each(?)) AND a.status IN ('absent','late','excused')
      ORDER BY st.name LIMIT 300`, orgId, list),
  ])
  const map = new Map(ids.map(id => [id, { counts: {} as Record<string, number>, flagged: [] as { name: string; status: string }[] }]))
  for (const row of counts) map.get(row.session_id)!.counts[row.status] = row.total
  for (const row of flagged) map.get(row.session_id)!.flagged.push({ name: row.name, status: row.status })
  return map
}

async function classAccess(c: Ctx, classId: string) {
  const { orgId, userId } = c.get('scope')
  const term = await one<{ id: string }>(c, 'SELECT id FROM school_terms WHERE org_id=? AND starts_on<=? AND ends_on>=?', orgId, today(), today())
  const item = await one<{ id: string; name: string; homeroom: number }>(c, `SELECT cl.id,cl.name,
    EXISTS (SELECT 1 FROM teacher_assignments a WHERE a.org_id=cl.org_id AND a.class_id=cl.id AND a.user_id=? AND a.ended_at IS NULL
      AND a.duty='primary') AS homeroom
    FROM classes cl WHERE cl.org_id=? AND cl.id=? AND (
      EXISTS (SELECT 1 FROM teacher_assignments a WHERE a.org_id=cl.org_id AND a.class_id=cl.id AND a.user_id=? AND a.ended_at IS NULL)
      OR EXISTS (SELECT 1 FROM teaching_assignments t WHERE t.org_id=cl.org_id AND t.class_id=cl.id AND t.user_id=? AND t.term_id=?))`,
  userId, orgId, classId, userId, userId, term?.id ?? '')
  if (!item) throw missing()
  return { ...item, termId: term?.id ?? '' }
}

export const teacherRoutes = router()
  .get('/teacher/today', async c => {
    const { orgId, userId } = teacher(c)
    await ensurePrepared(c)
    const date = today()
    const { closure, periods } = await periodsOn(c, date)
    const candidates = await rows<MarkSession>(c, `SELECT s.id,s.class_id,cl.name AS class_name,s.shift,s.lesson_date,s.starts_at,s.ends_at,
      s.status,s.attendance_state,s.teacher_id,u.name AS teacher_name FROM class_sessions s
      JOIN classes cl ON cl.org_id=s.org_id AND cl.id=s.class_id JOIN "user" u ON u.id=s.teacher_id
      WHERE s.org_id=? AND s.lesson_date=? AND s.status<>'cancelled' ORDER BY s.starts_at,cl.name`, orgId, date)
    const assigned = new Set((await rows<{ class_id: string }>(c, `SELECT class_id FROM teacher_assignments
      WHERE org_id=? AND user_id=? AND ended_at IS NULL`, orgId, userId)).map(row => row.class_id))
    const sessions = candidates.filter(session => (session.teacher_id === userId && assigned.has(session.class_id))
      || (session.shift && periods.some(period => period.class_id === session.class_id && period.shift === session.shift)))
    const pending = await rows<MarkSession>(c, `SELECT s.id,s.class_id,cl.name AS class_name,s.shift,s.lesson_date,s.starts_at,s.ends_at,
      s.status,s.attendance_state,s.teacher_id,u.name AS teacher_name FROM class_sessions s
      JOIN classes cl ON cl.org_id=s.org_id AND cl.id=s.class_id JOIN "user" u ON u.id=s.teacher_id
      WHERE s.org_id=? AND s.teacher_id=? AND s.status='scheduled' AND s.lesson_date>=? AND s.lesson_date<? AND s.ends_at<=?
        AND EXISTS (SELECT 1 FROM teacher_assignments a WHERE a.org_id=s.org_id AND a.class_id=s.class_id AND a.user_id=s.teacher_id AND a.ended_at IS NULL)
      ORDER BY s.starts_at DESC LIMIT 20`, orgId, userId, addDays(date, -14), date, now())
    const roster = await rows<{ session_id: string; total: number }>(c, `SELECT s.id AS session_id,COUNT(e.id) AS total FROM class_sessions s
      JOIN enrollments e ON e.org_id=s.org_id AND e.class_id=s.class_id AND e.enrolled_on<=s.lesson_date
        AND (e.withdrawn_on IS NULL OR e.withdrawn_on>s.lesson_date)
      WHERE s.org_id=? AND s.id IN (SELECT value FROM json_each(?)) GROUP BY s.id`, orgId, JSON.stringify(sessions.map(row => row.id)))
    const totals = new Map(roster.map(row => [row.session_id, row.total]))
    const marks = await summaries(c, sessions.map(row => row.id))
    return result(c, {
      date, weekday: weekdayOf(date), closure, periods, pending,
      sessions: sessions.map(session => ({ ...session, mine: session.teacher_id === userId, roster: totals.get(session.id) ?? 0,
        ...marks.get(session.id)! })),
    })
  })
  .get('/teacher/week', async c => {
    teacher(c)
    const from = validated(isoDate, c.req.query('from') ?? today())
    const monday = addDays(from, 1 - weekdayOf(from))
    const days = []
    for (let index = 0; index < 6; index++) {
      const date = addDays(monday, index)
      days.push({ date, ...await periodsOn(c, date) })
    }
    return result(c, { monday, days })
  })
  .get('/teacher/classes', async c => {
    const { orgId, userId } = teacher(c)
    const term = await one<{ id: string }>(c, 'SELECT id FROM school_terms WHERE org_id=? AND starts_on<=? AND ends_on>=?', orgId, today(), today())
    const classes = await rows<{ id: string; name: string; homeroom: number; enrolled: number; subjects: string | null }>(c, `SELECT cl.id,cl.name,
      EXISTS (SELECT 1 FROM teacher_assignments a WHERE a.org_id=cl.org_id AND a.class_id=cl.id AND a.user_id=? AND a.ended_at IS NULL
        AND a.duty='primary') AS homeroom,
      (SELECT COUNT(*) FROM enrollments e WHERE e.org_id=cl.org_id AND e.class_id=cl.id AND e.withdrawn_on IS NULL) AS enrolled,
      (SELECT group_concat(sub.name, ', ') FROM teaching_assignments t JOIN subjects sub ON sub.org_id=t.org_id AND sub.id=t.subject_id
        WHERE t.org_id=cl.org_id AND t.class_id=cl.id AND t.user_id=? AND t.term_id=?) AS subjects
      FROM classes cl WHERE cl.org_id=? AND cl.status IN ('scheduled','active') AND (
        EXISTS (SELECT 1 FROM teacher_assignments a WHERE a.org_id=cl.org_id AND a.class_id=cl.id AND a.user_id=? AND a.ended_at IS NULL)
        OR EXISTS (SELECT 1 FROM teaching_assignments t WHERE t.org_id=cl.org_id AND t.class_id=cl.id AND t.user_id=? AND t.term_id=?))
      ORDER BY homeroom DESC,cl.name LIMIT 100`, userId, userId, term?.id ?? '', orgId, userId, userId, term?.id ?? '')
    return result(c, classes)
  })
  .get('/teacher/classes/:classId', async c => {
    const { orgId } = teacher(c)
    const item = await classAccess(c, param(c, 'classId'))
    const date = today()
    const from = addDays(date, -29)
    const students = await rows<{ id: string; name: string; code: string; present: number; late: number; absent: number; excused: number }>(c,
      `SELECT st.id,st.name,st.code,
        COUNT(a.status) FILTER (WHERE a.status='present') AS present, COUNT(a.status) FILTER (WHERE a.status='late') AS late,
        COUNT(a.status) FILTER (WHERE a.status='absent') AS absent, COUNT(a.status) FILTER (WHERE a.status='excused') AS excused
      FROM enrollments e JOIN students st ON st.org_id=e.org_id AND st.id=e.student_id
      LEFT JOIN attendance_records a ON a.org_id=e.org_id AND a.enrollment_id=e.id AND EXISTS (SELECT 1 FROM class_sessions s
        WHERE s.org_id=a.org_id AND s.id=a.session_id AND s.attendance_state='finalized' AND s.lesson_date BETWEEN ? AND ?)
      WHERE e.org_id=? AND e.class_id=? AND e.withdrawn_on IS NULL
      GROUP BY st.id,st.name,st.code ORDER BY st.name,st.id LIMIT 100`, from, date, orgId, item.id)
    const sessions = await one<{ total: number }>(c, `SELECT COUNT(*) AS total FROM class_sessions WHERE org_id=? AND class_id=?
      AND attendance_state='finalized' AND lesson_date BETWEEN ? AND ?`, orgId, item.id, from, date)
    return result(c, { id: item.id, name: item.name, homeroom: Boolean(item.homeroom), from, to: date,
      sessions: sessions?.total ?? 0, students })
  })
