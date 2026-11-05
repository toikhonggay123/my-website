import { z } from 'zod'
import {
  type Ctx, audit, bad, body, classScope, conflict, db, missing, newId, now, optionalText,
  pageResult, pagination, query, requireRole, result, router, rows, text, uuid, validated,
} from './core'
import { dateRange, sessionFor } from './scheduling'

const statuses = ['present', 'late', 'absent', 'excused', 'unmarked'] as const
const entry = z.object({ enrollment_id: uuid, status: z.enum(statuses), note: optionalText(400) })
const writeInput = z.object({ version: z.number().int().min(0), entries: z.array(entry).max(100) })
type Entry = z.output<typeof entry>
type RosterRow = Entry & { name: string; code: string }
const eligible = `e.org_id=? AND e.class_id=? AND (
  (?='unmarked' AND e.enrolled_on<=? AND (e.withdrawn_on IS NULL OR e.withdrawn_on>?))
  OR (?<>'unmarked' AND EXISTS (SELECT 1 FROM attendance_records a
    WHERE a.org_id=e.org_id AND a.enrollment_id=e.id AND a.session_id=?))
)`

async function attendanceSession(c: Ctx) {
  const session = await sessionFor(c)
  const { role, userId } = c.get('scope')
  if (role === 'teacher' && userId !== session.teacher_id) throw missing()
  return session
}

async function save(c: Ctx, finalize: boolean) {
  const { orgId, userId } = c.get('scope')
  const session = await attendanceSession(c)
  const { version, entries } = await body(c, writeInput)
  if (session.version !== version || session.attendance_state === 'finalized') {
    throw conflict('Điểm danh đã thay đổi hoặc đã chốt. Hãy tải lại.')
  }
  const timestamp = now()
  if (session.status === 'cancelled' || session.starts_at > timestamp) {
    throw conflict('Chỉ ghi điểm danh khi buổi học đã bắt đầu và còn hiệu lực.')
  }
  if (new Set(entries.map(item => item.enrollment_id)).size !== entries.length) throw bad('Danh sách điểm danh có học viên trùng.')
  if (finalize && (entries.length === 0 || entries.some(item => item.status === 'unmarked'))) {
    throw bad('Cần đánh dấu từng học viên trước khi chốt điểm danh.')
  }
  const edit = newId()
  const payload = JSON.stringify(entries)
  const args = [orgId, session.class_id, session.attendance_state, session.lesson_date,
    session.lesson_date, session.attendance_state, session.id]
  const writes = await db(c).batch([
    query(c, `WITH roster AS (SELECT e.id FROM enrollments e WHERE ${eligible}),
      submitted AS (SELECT value->>'enrollment_id' AS id FROM json_each(?))
      UPDATE class_sessions SET attendance_state=?,status=?,version=version+1,edit_token=?,updated_at=?
      WHERE org_id=? AND id=? AND version=? AND status='scheduled' AND attendance_state<>'finalized'
        AND EXISTS (SELECT 1 FROM memberships m WHERE m.org_id=class_sessions.org_id AND m.user_id=? AND m.active=1)
        AND (SELECT COUNT(*) FROM roster)=(SELECT COUNT(*) FROM submitted)
        AND NOT EXISTS (SELECT id FROM submitted EXCEPT SELECT id FROM roster)`,
    ...args, payload, finalize ? 'finalized' : 'draft', finalize ? 'completed' : 'scheduled',
    edit, timestamp, orgId, session.id, version, userId),
    query(c, `INSERT INTO audit_events(org_id,id,actor_id,event,target_id,occurred_at,details)
      SELECT s.org_id,?,?,'attendance.records_updated',s.id,?,json_object('changes',
        json_group_array(json_object('enrollmentId',j.value->>'enrollment_id','from',coalesce(a.status,'unmarked'),
        'to',j.value->>'status','noteChanged',coalesce(a.note,'')<>j.value->>'note')))
      FROM class_sessions s CROSS JOIN json_each(?) j LEFT JOIN attendance_records a
        ON a.org_id=s.org_id AND a.session_id=s.id AND a.enrollment_id=j.value->>'enrollment_id'
      WHERE s.org_id=? AND s.id=? AND s.edit_token=?
        AND (coalesce(a.status,'unmarked')<>j.value->>'status' OR coalesce(a.note,'')<>j.value->>'note')
      GROUP BY s.org_id,s.id`,
    newId(), userId, timestamp, payload, orgId, session.id, edit),
    query(c, `INSERT INTO attendance_records(org_id,session_id,class_id,enrollment_id,status,note,marked_by,updated_at)
      SELECT s.org_id,s.id,s.class_id,j.value->>'enrollment_id',j.value->>'status',j.value->>'note',?,?
      FROM class_sessions s CROSS JOIN json_each(?) j WHERE s.org_id=? AND s.id=? AND s.edit_token=?
      ON CONFLICT(org_id,session_id,enrollment_id) DO UPDATE SET
        status=excluded.status,note=excluded.note,marked_by=excluded.marked_by,updated_at=excluded.updated_at
      WHERE attendance_records.status<>excluded.status OR attendance_records.note<>excluded.note`,
    userId, timestamp, payload, orgId, session.id, edit),
    query(c, `INSERT INTO audit_events(org_id,id,actor_id,event,target_id,occurred_at)
      SELECT org_id,?,?,?,id,? FROM class_sessions WHERE org_id=? AND id=? AND edit_token=?`,
    newId(), userId, finalize ? 'attendance.finalized' : 'attendance.saved', timestamp, orgId, session.id, edit),
  ])
  if (!writes[0].meta.changes) throw conflict('Danh sách hoặc phiên bản điểm danh đã đổi. Hãy tải lại trước khi lưu.')
  return result(c, { version: version + 1, state: finalize ? 'finalized' : 'draft' })
}

function reportFilter(c: Ctx) {
  const scope = requireRole(c, 'owner', 'branch_admin')
  const { from, to } = dateRange(c)
  const [rule, ...args] = classScope(scope)
  const ids = ['class_id', 'branch_id', 'teacher_id', 'student_id'] as const
  const filters = ids.map(key => {
    const value = c.req.query(key)
    return value ? validated(key === 'teacher_id' ? text(64) : uuid, value) : null
  })
  return {
    args: [scope.orgId, ...args, from, to, ...filters.flatMap(value => [value, value])],
    sql: `FROM attendance_records a
      JOIN class_sessions s ON s.org_id=a.org_id AND s.id=a.session_id
      JOIN classes cl ON cl.org_id=s.org_id AND cl.id=s.class_id
      JOIN enrollments e ON e.org_id=a.org_id AND e.id=a.enrollment_id
      JOIN students st ON st.org_id=e.org_id AND st.id=e.student_id
      WHERE a.org_id=? AND ${rule} AND s.attendance_state='finalized'
        AND s.lesson_date BETWEEN ? AND ? AND (? IS NULL OR cl.id=?)
        AND (? IS NULL OR cl.branch_id=?) AND (? IS NULL OR s.teacher_id=?) AND (? IS NULL OR st.id=?)`,
  }
}
type ReportRow = { lesson_date: string; class_name: string; student_code: string; student_name: string; status: Entry['status'] }
const reportCols = `SELECT s.lesson_date,cl.name AS class_name,st.code AS student_code,st.name AS student_name,a.status`
const reportSort = 'ORDER BY s.lesson_date DESC,s.starts_at DESC,s.id,st.name,st.id'
const labels: Record<Entry['status'], string> = {
  present: 'Có mặt', late: 'Đi muộn', absent: 'Vắng', excused: 'Có phép', unmarked: 'Chưa đánh dấu',
}
function csvCell(value: string) {
  const safe = /^[\s\uFEFF]*[=+\-@＝＋－＠]|^[\t\r\n]/.test(value) ? "'" + value : value
  return '"' + safe.replaceAll('"', '""') + '"'
}

export const classcheck = router()
  .get('/sessions/:sessionId/attendance', async c => {
    const { orgId } = c.get('scope')
    const session = await attendanceSession(c)
    const roster = session.status === 'cancelled' ? [] : await rows<RosterRow>(c, `SELECT e.id AS enrollment_id,s.name,s.code,
      COALESCE(a.status,'unmarked') AS status,COALESCE(a.note,'') AS note
      FROM enrollments e JOIN students s ON s.org_id=e.org_id AND s.id=e.student_id
      LEFT JOIN attendance_records a ON a.org_id=e.org_id AND a.enrollment_id=e.id AND a.session_id=?
      WHERE ${eligible} ORDER BY s.name,s.id LIMIT 100`,
    session.id, orgId, session.class_id, session.attendance_state, session.lesson_date,
    session.lesson_date, session.attendance_state, session.id)
    return result(c, { session, roster, canEdit: session.status === 'scheduled' && session.starts_at <= now() })
  })
  .put('/sessions/:sessionId/attendance', c => save(c, false))
  .post('/sessions/:sessionId/attendance/finalize', c => save(c, true))
  .post('/sessions/:sessionId/attendance/reopen', async c => {
    const { orgId, userId } = requireRole(c, 'owner', 'branch_admin')
    const session = await attendanceSession(c)
    const { version, reason } = await body(c, z.object({ version: z.number().int().min(0), reason: text(400) }))
    const timestamp = now()
    const writes = await db(c).batch([
      query(c, `UPDATE class_sessions SET attendance_state='draft',status='scheduled',version=version+1,updated_at=?
        WHERE org_id=? AND id=? AND version=? AND attendance_state='finalized'`, timestamp, orgId, session.id, version),
      query(c, `INSERT INTO audit_events(org_id,id,actor_id,event,target_id,occurred_at,details)
        SELECT ?,?,?,'attendance.reopened',?,?,? WHERE changes()=1`,
      orgId, newId(), userId, session.id, timestamp, JSON.stringify({ reason })),
    ])
    if (!writes[0].meta.changes) throw conflict('Chỉ mở lại phiên bản điểm danh đã chốt hiện tại.')
    return result(c, { version: version + 1 })
  })
  .get('/sessions/:sessionId/attendance/history', async c => {
    const { orgId } = requireRole(c, 'owner', 'branch_admin')
    const session = await attendanceSession(c)
    const page = pagination(c)
    const list = await rows(c, `SELECT a.id,a.event,a.occurred_at,a.details,u.name AS actor
      FROM audit_events a JOIN "user" u ON u.id=a.actor_id WHERE a.org_id=? AND a.target_id=? AND a.event LIKE 'attendance.%'
      ORDER BY a.occurred_at DESC,a.id LIMIT ? OFFSET ?`, orgId, session.id, page.limit + 1, page.offset)
    return pageResult(c, list, page)
  })
  .get('/reports/attendance', async c => {
    const { sql, args } = reportFilter(c)
    const page = pagination(c)
    const [summary, data] = await db(c).batch([
      query(c, `SELECT COUNT(*) AS total, count(*) FILTER (WHERE a.status='present') AS present,
        count(*) FILTER (WHERE a.status='late') AS late,count(*) FILTER (WHERE a.status='absent') AS absent,
        count(*) FILTER (WHERE a.status='excused') AS excused,count(*) FILTER (WHERE a.status='unmarked') AS unmarked ${sql}`, ...args),
      query(c, `${reportCols} ${sql} ${reportSort} LIMIT ? OFFSET ?`, ...args, page.limit + 1, page.offset),
    ])
    return c.json({ data: data.results.slice(0, page.limit), summary: summary.results[0],
      pagination: { page: page.page, hasMore: data.results.length > page.limit } })
  })
  .get('/reports/attendance.csv', async c => {
    const { sql, args } = reportFilter(c)
    const list = await rows<ReportRow>(c, `${reportCols} ${sql} ${reportSort} LIMIT 10001`, ...args)
    if (list.length > 10000) throw bad('Chọn khoảng ngày hoặc lớp hẹp hơn để xuất tối đa 10.000 dòng.')
    const exportId = newId()
    await audit(c, 'attendance.exported', exportId, { rows: list.length }).run()
    const csv = [
      ['Ngày', 'Lớp', 'Mã học viên', 'Học viên', 'Điểm danh'],
      ...list.map(row => [row.lesson_date, row.class_name, row.student_code, row.student_name, labels[row.status]]),
    ].map(row => row.map(csvCell).join(',')).join('\r\n')
    return c.body('\uFEFF' + csv, 200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="classhub-attendance.csv"',
    })
  })
