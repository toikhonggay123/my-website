import { z } from 'zod'
import {
  type Ctx, audit, bad, body, classScope, conflict, dayMs, db, isoDate, localInstant,
  missing, newId, now, one, optionalText, pageResult, pagination, param, query, requireRole, result,
  router, rows, scopedClass, time, today, validated,
} from './core'

const admins = ['owner', 'branch_admin'] as const
const teacherId = z.string().regex(/^[a-zA-Z0-9_-]{16,64}$/)
const clock = z.object({ teacher_id: teacherId, starts_at: time, ends_at: time, room: optionalText(80) })
const sessionInput = clock.extend({ lesson_date: isoDate })
const ruleInput = clock.extend({
  weekday: z.number().int().min(1).max(7), every_weeks: z.number().int().min(1).max(4).default(1),
  starts_on: isoDate, ends_on: isoDate,
})
type Rule = z.output<typeof ruleInput> & { id: string; class_id: string }
export type Session = {
  id: string; class_id: string; class_name: string; teacher_id: string; teacher_name: string
  branch_id: string; lesson_date: string; starts_at: number; ends_at: number; room: string
  status: 'scheduled' | 'completed' | 'cancelled'
  attendance_state: 'unmarked' | 'draft' | 'finalized'; version: number
}

export function datesInRule(rule: Pick<Rule, 'starts_on' | 'ends_on' | 'weekday' | 'every_weeks'>, from: string, to: string) {
  const anchor = Date.parse(rule.starts_on)
  const firstWeekday = new Date(anchor).getUTCDay() || 7
  const first = anchor + ((rule.weekday - firstWeekday + 7) % 7) * dayMs
  const step = rule.every_weeks * 7 * dayMs
  const start = Math.max(Date.parse(from), first)
  const end = Math.min(Date.parse(to), Date.parse(rule.ends_on))
  const dates: string[] = []
  for (let date = first + Math.ceil((start - first) / step) * step; date <= end; date += step) {
    dates.push(new Date(date).toISOString().slice(0, 10))
  }
  return dates
}

export function dateRange(c: Ctx, days = 31, maxDays = 93) {
  const from = validated(isoDate, c.req.query('from') ?? today())
  const end = new Date(Date.parse(from) + (days - 1) * dayMs).toISOString().slice(0, 10)
  const to = validated(isoDate, c.req.query('to') ?? end)
  if (to < from || Date.parse(to) - Date.parse(from) >= maxDays * dayMs) {
    throw bad('Khoảng ngày phải hợp lệ và tối đa ' + maxDays + ' ngày.')
  }
  return { from, to }
}

export async function sessionFor(c: Ctx) {
  const scope = c.get('scope')
  const [rule, ...args] = classScope(scope)
  const session = await one<Session>(c, `SELECT s.id,s.class_id,s.branch_id,s.teacher_id,s.lesson_date,s.starts_at,s.ends_at,s.room,
    s.status,s.attendance_state,s.version,cl.name AS class_name,u.name AS teacher_name FROM class_sessions s
    JOIN classes cl ON cl.org_id=s.org_id AND cl.id=s.class_id JOIN "user" u ON u.id=s.teacher_id
    WHERE s.org_id=? AND s.id=? AND ${rule}`, scope.orgId, param(c, 'sessionId'), ...args)
  if (!session) throw missing()
  return session
}

function validateClock(input: z.output<typeof clock>) {
  if (input.starts_at >= input.ends_at) throw bad('Giờ kết thúc phải sau giờ bắt đầu trong cùng ngày.')
}

export const scheduling = router()
  .get('/sessions', async c => {
    const scope = c.get('scope')
    const [rule, ...args] = classScope(scope)
    const { from, to } = dateRange(c)
    const page = pagination(c)
    const classId = c.req.query('class_id') ? validated(z.uuid(), c.req.query('class_id')) : null
    const list = await rows<Session>(c, `SELECT s.id,s.class_id,s.lesson_date,s.starts_at,s.ends_at,s.room,s.status,
      s.attendance_state,cl.name AS class_name,u.name AS teacher_name
      FROM class_sessions s JOIN classes cl ON cl.org_id=s.org_id AND cl.id=s.class_id JOIN "user" u ON u.id=s.teacher_id
      WHERE s.org_id=? AND ${rule} AND (? IS NULL OR s.class_id=?) AND s.lesson_date BETWEEN ? AND ?
        AND (?<>'teacher' OR s.teacher_id=?)
      ORDER BY s.starts_at,s.id LIMIT ? OFFSET ?`,
    scope.orgId, ...args, classId, classId, from, to, scope.role, scope.userId, page.limit + 1, page.offset)
    return pageResult(c, list, page)
  })
  .get('/sessions/:sessionId', async c => result(c, await sessionFor(c)))
  .get('/classes/:classId/timetable', async c => {
    const { orgId } = c.get('scope')
    const item = await scopedClass(c)
    const page = pagination(c)
    const list = await rows(c, `SELECT r.*,u.name AS teacher_name FROM timetable_rules r JOIN "user" u ON u.id=r.teacher_id
      WHERE r.org_id=? AND r.class_id=? ORDER BY r.starts_on DESC,r.weekday,r.id LIMIT ? OFFSET ?`,
    orgId, item.id, page.limit + 1, page.offset)
    return pageResult(c, list, page)
  })
  .post('/classes/:classId/timetable', async c => {
    const { orgId, userId } = requireRole(c, ...admins)
    const item = await scopedClass(c)
    const input = await body(c, ruleInput)
    validateClock(input)
    if (input.starts_on > input.ends_on || input.starts_on < item.starts_on || input.ends_on > item.ends_on) {
      throw bad('Khoảng hiệu lực phải nằm trong thời gian của lớp.')
    }
    const id = newId(), timestamp = now()
    const writes = await db(c).batch([
      query(c, `INSERT INTO timetable_rules(org_id,id,class_id,teacher_id,weekday,every_weeks,starts_on,ends_on,starts_at,ends_at,room,created_at)
        SELECT cl.org_id,?,cl.id,a.user_id,?,?,?,?,?,?,?,?
        FROM classes cl JOIN teacher_assignments a ON a.org_id=cl.org_id AND a.class_id=cl.id
        JOIN memberships m ON m.org_id=a.org_id AND m.user_id=a.user_id
        WHERE cl.org_id=? AND cl.id=? AND a.user_id=? AND a.ended_at IS NULL AND m.active=1
          AND cl.status IN ('draft','scheduled','active') AND cl.starts_on<=? AND cl.ends_on>=?`,
      id, input.weekday, input.every_weeks, input.starts_on, input.ends_on, input.starts_at, input.ends_at,
      input.room, timestamp, orgId, item.id, input.teacher_id, input.starts_on, input.ends_on),
      query(c, `INSERT INTO audit_events(org_id,id,actor_id,event,target_id,occurred_at,details)
        SELECT ?,?,?,'timetable.created',?,?,? WHERE changes()=1`, orgId, newId(), userId, item.id, timestamp,
      JSON.stringify({ ruleId: id })),
    ])
    if (!writes[0].meta.changes) throw conflict('Lớp hoặc phân công đã thay đổi. Hãy tải lại.')
    return result(c, { id }, 201)
  })
  .post('/classes/:classId/timetable/:ruleId/generate', async c => {
    const { orgId, userId } = requireRole(c, ...admins)
    const item = await scopedClass(c)
    const id = param(c, 'ruleId')
    const { from, to } = await body(c, z.object({ from: isoDate, to: isoDate }))
    if (from > to || Date.parse(to) - Date.parse(from) >= 90 * dayMs) throw bad('Chọn khoảng tối đa 90 ngày để tạo buổi.')
    const rule = await one<Rule>(c, 'SELECT * FROM timetable_rules WHERE org_id=? AND class_id=? AND id=?', orgId, item.id, id)
    if (!rule) throw missing()
    if (['completed', 'archived', 'cancelled'].includes(item.status)) throw conflict('Lớp đã kết thúc.')
    const dates = datesInRule(rule, from, to)
    const payload = dates.map(date => ({
      id: newId(), date, start: localInstant(date, rule.starts_at), end: localInstant(date, rule.ends_at),
    }))
    const timestamp = now()
    const writes = await db(c).batch([
      query(c, `INSERT INTO class_sessions(org_id,id,class_id,branch_id,teacher_id,rule_id,source_date,lesson_date,starts_at,ends_at,room,created_at,updated_at)
        SELECT cl.org_id,j.value->>'id',cl.id,cl.branch_id,r.teacher_id,r.id,j.value->>'date',j.value->>'date',
          j.value->>'start',j.value->>'end',r.room,?,?
        FROM timetable_rules r JOIN classes cl ON cl.org_id=r.org_id AND cl.id=r.class_id CROSS JOIN json_each(?) j
        WHERE r.org_id=? AND r.id=? AND cl.status IN ('draft','scheduled','active')
          AND (j.value->>'date') BETWEEN cl.starts_on AND cl.ends_on
          AND NOT EXISTS (SELECT 1 FROM class_sessions s WHERE s.org_id=r.org_id AND s.rule_id=r.id AND s.source_date=j.value->>'date')`,
      timestamp, timestamp, JSON.stringify(payload), orgId, id),
      query(c, `INSERT INTO audit_events(org_id,id,actor_id,event,target_id,occurred_at,details)
        SELECT ?,?,?,'sessions.generated',?,?,json_object('ruleId',?,'count',changes()) WHERE changes()>0`,
      orgId, newId(), userId, item.id, timestamp, id),
    ])
    return result(c, { created: writes[0].meta.changes ?? 0, occurrences: dates.length })
  })
  .post('/classes/:classId/sessions', async c => {
    const { orgId, userId } = requireRole(c, ...admins)
    const item = await scopedClass(c)
    const input = await body(c, sessionInput)
    validateClock(input)
    const id = newId(), timestamp = now()
    const writes = await db(c).batch([
      query(c, `INSERT INTO class_sessions(org_id,id,class_id,branch_id,teacher_id,lesson_date,starts_at,ends_at,room,created_at,updated_at)
        SELECT org_id,?,id,branch_id,?,?,?,?,?,?,? FROM classes
        WHERE org_id=? AND id=? AND status IN ('draft','scheduled','active') AND ? BETWEEN starts_on AND ends_on`,
      id, input.teacher_id, input.lesson_date, localInstant(input.lesson_date, input.starts_at),
      localInstant(input.lesson_date, input.ends_at), input.room, timestamp, timestamp, orgId, item.id, input.lesson_date),
      query(c, `INSERT INTO audit_events(org_id,id,actor_id,event,target_id,occurred_at)
        SELECT ?,?,?,'session.created',?,? WHERE changes()=1`, orgId, newId(), userId, id, timestamp),
    ])
    if (!writes[0].meta.changes) throw conflict('Ngày buổi học phải nằm trong thời gian hoạt động của lớp.')
    return result(c, { id }, 201)
  })
  .patch('/sessions/:sessionId', async c => {
    const { orgId, userId } = requireRole(c, ...admins)
    const item = await sessionFor(c)
    const input = await body(c, z.discriminatedUnion('action', [
      sessionInput.extend({ action: z.literal('reschedule'), version: z.number().int().min(0) }),
      z.object({ action: z.literal('cancel'), version: z.number().int().min(0) }),
    ]))
    const timestamp = now()
    const where = "WHERE org_id=? AND id=? AND version=? AND status='scheduled' AND attendance_state='unmarked'"
    let update: D1PreparedStatement
    if (input.action === 'cancel') {
      update = query(c, `UPDATE class_sessions SET status='cancelled',version=version+1,updated_at=? ${where}`,
        timestamp, orgId, item.id, input.version)
    } else {
      validateClock(input)
      update = query(c, `UPDATE class_sessions SET teacher_id=?,lesson_date=?,starts_at=?,ends_at=?,room=?,version=version+1,updated_at=?
        ${where} AND EXISTS (SELECT 1 FROM classes WHERE org_id=? AND id=? AND ? BETWEEN starts_on AND ends_on)`,
      input.teacher_id, input.lesson_date, localInstant(input.lesson_date, input.starts_at),
      localInstant(input.lesson_date, input.ends_at), input.room, timestamp, orgId, item.id, input.version,
      orgId, item.class_id, input.lesson_date)
    }
    const writes = await db(c).batch([update,
      query(c, `INSERT INTO audit_events(org_id,id,actor_id,event,target_id,occurred_at)
        SELECT ?,?,?,?,?,? WHERE changes()=1`, orgId, newId(), userId, 'session.' + input.action, item.id, timestamp),
    ])
    if (!writes[0].meta.changes) throw conflict('Buổi học đã thay đổi, đã có điểm danh hoặc nằm ngoài thời gian của lớp.')
    return result(c, { id: item.id })
  })
