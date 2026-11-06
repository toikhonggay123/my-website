import { getCookie, setCookie } from 'hono/cookie'
import {
  type Ctx, db, dayMs, Failure, localInstant, missing, newId, now, one, param,
  query, result, router, today, token, tokenHash,
} from './core'
import { operations } from './operations'
import { scheduling } from './scheduling'
import { classcheck } from './classcheck'
import { school } from './school'
import { reports } from './reports'

const cookie = 'afyllx-classhub-demo'
type Guest = { id: string; name: string; email: string; workspaceName: string; type: string }

async function guest(c: Ctx) {
  const key = getCookie(c, cookie)
  if (!key || !/^[0-9a-f]{64}$/.test(key)) return null
  return one<Guest>(c, `SELECT u.id,u.name,u.email,o.name AS workspaceName,o.type
    FROM session s JOIN "user" u ON u.id=s.userId JOIN organizations o ON o.id=u.id
    WHERE s.token=? AND s.expiresAt>? AND o.status='active'`, await tokenHash(key), now())
}

async function seed(c: Ctx, visitor: Guest, key: string, timestamp: number) {
  const org = visitor.id
  const branch = newId()
  const teacher = newId()
  const date = today()
  const dateAt = (days: number) => new Date(Date.parse(date) + days * dayMs).toISOString().slice(0, 10)
  const starts = dateAt(-7)
  const groups = [
    { id: newId(), course: newId(), code: 'TA01', name: 'Tiếng Anh giao tiếp', subject: 'Tiếng Anh', section: 'A',
      room: 'P.101', start: '17:30', end: '19:00' },
    { id: newId(), course: newId(), code: 'TO01', name: 'Toán ứng dụng', subject: 'Toán', section: 'B',
      room: 'P.102', start: '15:30', end: '17:00' },
  ]
  const pupils = ['An', 'Bình', 'Chi'].map(name => ({ id: newId(), name, enrollments: groups.map(() => newId()) }))
  const lessons: { group: number; offset: number; marks?: string[] }[] = [
    { group: 0, offset: -6, marks: ['present', 'present', 'absent'] },
    { group: 0, offset: -4, marks: ['present', 'late', 'excused'] },
    { group: 1, offset: -4, marks: ['present', 'present', 'present'] },
    { group: 0, offset: -3, marks: ['present', 'present', 'late'] },
    { group: 1, offset: -3, marks: ['present', 'absent', 'present'] },
    { group: 0, offset: -2, marks: ['present', 'present', 'present'] },
    { group: 1, offset: -2 },
    { group: 0, offset: -1 },
    { group: 0, offset: 0 },
    { group: 1, offset: 0 },
    { group: 0, offset: 2 },
  ]
  const history = lessons.map(lesson => ({ ...lesson, id: newId(), day: dateAt(lesson.offset) }))
  const user = (id: string, name: string, email: string) => query(c,
    'INSERT INTO "user"(id,name,email,emailVerified,createdAt,updatedAt) VALUES (?,?,?,0,?,?)',
    id, name, email, timestamp, timestamp)
  const member = (id: string, role: 'owner' | 'teacher') => query(c,
    'INSERT INTO memberships(org_id,user_id,role,created_at) VALUES (?,?,?,?)', org, id, role, timestamp)
  await db(c).batch([
    user(org, visitor.name, visitor.email),
    user(teacher, 'Giáo viên mẫu', teacher + '@classhub.invalid'),
    query(c, 'INSERT INTO session(id,token,userId,expiresAt,createdAt,updatedAt) VALUES (?,?,?,?,?,?)',
      newId(), await tokenHash(key), org, timestamp + dayMs, timestamp, timestamp),
    query(c, 'INSERT INTO organizations(id,name,type,created_at,updated_at) VALUES (?,?,?,?,?)',
      org, visitor.workspaceName, visitor.type, timestamp, timestamp),
    query(c, 'INSERT INTO branches(org_id,id,name) VALUES (?,?,?)', org, branch, 'Cơ sở chính'),
    member(org, 'owner'), member(teacher, 'teacher'),
    ...groups.flatMap(group => [
      query(c, 'INSERT INTO courses(org_id,id,code,name,subject,created_at,updated_at) VALUES (?,?,?,?,?,?,?)',
        org, group.course, group.code, group.name, group.subject, timestamp, timestamp),
      query(c, `INSERT INTO classes(org_id,id,course_id,branch_id,code,name,starts_on,ends_on,capacity,room,status,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,20,?,'active',?,?)`, org, group.id, group.course, branch,
        group.code + '-' + group.section, group.name + ' ' + group.section, starts, dateAt(21), group.room, timestamp, timestamp),
      query(c, `INSERT INTO teacher_assignments(org_id,class_id,user_id,duty,assigned_at)
        VALUES (?,?,?,'primary',?)`, org, group.id, teacher, timestamp),
    ]),
    ...pupils.flatMap(({ id, name, enrollments }, index) => [
      query(c, 'INSERT INTO students(org_id,id,code,name,created_at,updated_at) VALUES (?,?,?,?,?,?)',
        org, id, 'MAU0' + (index + 1), 'Học viên mẫu ' + name, timestamp, timestamp),
      ...groups.map((group, groupIndex) =>
        query(c, `INSERT INTO enrollments(org_id,id,class_id,student_id,enrolled_on,created_at,updated_at)
          VALUES (?,?,?,?,?,?,?)`, org, enrollments[groupIndex], group.id, id, starts, timestamp, timestamp)),
    ]),
    ...history.map(lesson => {
      const group = groups[lesson.group]
      return query(c, `INSERT INTO class_sessions
        (org_id,id,class_id,branch_id,teacher_id,lesson_date,starts_at,ends_at,room,status,attendance_state,version,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, org, lesson.id, group.id, branch, teacher, lesson.day,
      localInstant(lesson.day, group.start), localInstant(lesson.day, group.end), group.room,
      lesson.marks ? 'completed' : 'scheduled', lesson.marks ? 'finalized' : 'unmarked', lesson.marks ? 1 : 0, timestamp, timestamp)
    }),
    query(c, `INSERT INTO attendance_records(org_id,session_id,class_id,enrollment_id,status,marked_by,updated_at)
      SELECT ?,j.value->>'session',j.value->>'classId',j.value->>'enrollment',j.value->>'status',?,?
      FROM json_each(?) j`, org, org, timestamp, JSON.stringify(history.flatMap(lesson =>
      (lesson.marks ?? []).map((status, index) => ({
        session: lesson.id, classId: groups[lesson.group].id, enrollment: pupils[index].enrollments[lesson.group], status,
      }))))),
  ])
}

export const demo = router()
  .use('*', async (c, next) => {
    if (!c.env.CLASSHUB_DEMO_DB) throw missing()
    c.set('demoDb', c.env.CLASSHUB_DEMO_DB)
    await next()
  })
  .post('/session', async c => {
    let visitor = await guest(c)
    if (!visitor) {
      const key = 'demo:start:' + (c.req.header('CF-Connecting-IP') ?? 'loopback')
      if (!(await c.env.ACTIVATION_LIMIT.limit({ key })).success) {
        throw new Failure(429, 'rate_limited', 'Vui lòng thử lại sau ít phút.')
      }
      const id = newId()
      visitor = { id, name: 'Khách trải nghiệm', email: id + '@classhub.invalid', workspaceName: 'Trung tâm mẫu', type: 'center' }
      const sessionKey = token()
      await seed(c, visitor, sessionKey, now())
      setCookie(c, cookie, sessionKey, {
        httpOnly: true, secure: new URL(c.req.url).protocol === 'https:', sameSite: 'Strict',
        path: (c.env.APP_BASE_PATH ?? '') + '/api/v1/demo', maxAge: dayMs / 1000,
      })
    }
    return result(c, {
      user: { name: visitor.name, email: visitor.email }, local: false,
      workspaces: [{ id: visitor.id, name: visitor.workspaceName, type: visitor.type, role: 'owner', branch_id: null }],
    })
  })
  .use('/orgs/:orgId/*', async (c, next) => {
    const visitor = await guest(c)
    if (!visitor) throw new Failure(401, 'demo_expired', 'Tải lại trang để bắt đầu phiên dùng thử mới.')
    if (param(c, 'orgId') !== visitor.id) throw missing()
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
      const key = 'demo:write:' + visitor.id
      if (!(await c.env.ACTIVATION_LIMIT.limit({ key })).success) {
        throw new Failure(429, 'rate_limited', 'Bạn thao tác hơi nhanh. Vui lòng thử lại sau một phút.')
      }
    }
    c.set('scope', { orgId: visitor.id, userId: visitor.id, role: 'owner', branchId: null })
    await next()
  })
  .route('/orgs/:orgId', operations)
  .route('/orgs/:orgId', scheduling)
  .route('/orgs/:orgId', classcheck)
  .route('/orgs/:orgId', school)
  .route('/orgs/:orgId', reports)

export async function expireDemoWorkspaces(database: D1Database, timestamp: number) {
  const expired = await database.prepare('SELECT userId FROM session WHERE expiresAt<=? ORDER BY expiresAt LIMIT 20')
    .bind(timestamp).all<{ userId: string }>()
  if (!expired.results.length) return
  const workspaces = JSON.stringify(expired.results.map(session => session.userId))
  const members = await database.prepare('SELECT user_id FROM memberships WHERE org_id IN (SELECT value FROM json_each(?))')
    .bind(workspaces).all<{ user_id: string }>()
  const tables = [
    'timetable_slots', 'timetable_versions', 'teaching_assignments', 'school_closures', 'bell_periods', 'subjects', 'school_terms',
    'attendance_records', 'audit_events', 'class_sessions', 'timetable_rules', 'enrollments', 'teacher_assignments',
    'classes', 'students', 'courses', 'memberships', 'branches',
  ]
  await database.batch([
    ...tables.map(table => database.prepare(`DELETE FROM ${table} WHERE org_id IN (SELECT value FROM json_each(?))`).bind(workspaces)),
    database.prepare('DELETE FROM organizations WHERE id IN (SELECT value FROM json_each(?))').bind(workspaces),
    // Removing the owner also removes the expired session via its foreign key.
    database.prepare('DELETE FROM "user" WHERE id IN (SELECT value FROM json_each(?))')
      .bind(JSON.stringify(members.results.map(member => member.user_id))),
  ])
}
