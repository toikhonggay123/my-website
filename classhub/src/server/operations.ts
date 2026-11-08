import { z } from 'zod'
import {
  type Ctx, audit, bad, body, classScope, conflict, db, email, isoDate, staffProfilesOnly, missing, newId, now, one,
  optionalText, pageResult, pagination, param, query, requireRole, result, router, rows, scopedClass,
  text, today, token, tokenHash, uuid, validated,
} from './core'
import { organizationProfile } from './identity'
import { directoryStudentInput, directoryWrite, guardSharedClass, sharedEnabled } from './shared-directory'
import { dashboardAnalytics } from './dashboard'
import { ensurePrepared } from './school'
import { resetTargetSql, sharedAccountMessage } from './password-reset'

const courseInput = z.object({ code: text(30), name: text(120), subject: text(80), description: optionalText(1000) })
const classStatus = z.enum(['draft', 'scheduled', 'active', 'completed', 'archived', 'cancelled'])
const classInput = z.object({
  code: text(30), name: text(150), starts_on: isoDate, ends_on: isoDate,
  capacity: z.number().int().min(1).max(100), room: optionalText(80), notes: optionalText(1000),
})
// School workspaces create homeroom classes without choosing a course; they share one internal course.
const classCreate = classInput.extend({ course_id: uuid.optional(), branch_id: uuid })
async function homeroomCourse(c: Ctx, orgId: string) {
  const org = await one<{ type: string }>(c, 'SELECT type FROM organizations WHERE id=?', orgId)
  if (org?.type !== 'school') throw bad('Hãy chọn khóa học cho lớp.')
  const timestamp = now()
  await query(c, `INSERT INTO courses(org_id,id,code,name,subject,created_at,updated_at)
    VALUES (?,?,'LOP-SH','Lớp sinh hoạt','Sinh hoạt lớp',?,?) ON CONFLICT(org_id,code) DO NOTHING`,
  orgId, newId(), timestamp, timestamp).run()
  return (await one<{ id: string }>(c, "SELECT id FROM courses WHERE org_id=? AND code='LOP-SH'", orgId))!.id
}
const transitions: Record<string, string[]> = {
  draft: ['scheduled', 'active', 'cancelled'], scheduled: ['active', 'cancelled'],
  active: ['completed', 'cancelled'], completed: ['archived'], cancelled: ['archived'], archived: [],
}
const studentInput = z.object({ code: text(30), name: text(120) })
const admins = ['owner', 'branch_admin'] as const
const search = (c: Ctx) => validated(z.string().trim().max(120), c.req.query('q') ?? '')

function classDates(input: { starts_on: string; ends_on: string }) {
  if (input.starts_on > input.ends_on) throw bad('Ngày kết thúc phải từ ngày bắt đầu trở đi.')
}

export const operations = router()
  .get('/settings', async c => {
    const { orgId } = c.get('scope')
    return result(c, await one(c, 'SELECT id,name,type FROM organizations WHERE id=?', orgId))
  })
  .patch('/settings', async c => {
    const { orgId } = requireRole(c, 'owner')
    const input = await body(c, organizationProfile)
    await db(c).batch([
      query(c, 'UPDATE organizations SET name=?,type=?,updated_at=? WHERE id=?', input.name, input.type, now(), orgId),
      audit(c, 'organization.updated', orgId),
    ])
    return result(c, input)
  })
  .get('/branches', async c => {
    const { orgId, role, branchId } = requireRole(c, ...admins)
    const page = pagination(c)
    const list = await rows(c, `SELECT id,name FROM branches WHERE org_id=? AND (?='owner' OR id=?)
      ORDER BY name,id LIMIT ? OFFSET ?`, orgId, role, branchId, page.limit + 1, page.offset)
    return pageResult(c, list, page)
  })
  .post('/branches', async c => {
    const { orgId } = requireRole(c, 'owner')
    const { name } = await body(c, z.object({ name: text(100) }))
    const id = newId()
    await db(c).batch([query(c, 'INSERT INTO branches(org_id,id,name) VALUES (?,?,?)', orgId, id, name),
      audit(c, 'branch.created', id)])
    return result(c, { id }, 201)
  })
  .get('/staff', async c => {
    const { orgId, role, branchId } = requireRole(c, ...admins)
    const page = pagination(c)
    const includeInactive = role === 'owner' && c.req.query('all') === '1'
    const list = await rows(c, `SELECT m.user_id,u.name,m.role,m.branch_id,m.active
      FROM memberships m JOIN "user" u ON u.id=m.user_id
      WHERE m.org_id=? AND (m.active=1 OR ?=1) AND (?='owner' OR (m.role='teacher' AND (m.branch_id=? OR m.branch_id IS NULL)))
      AND instr(lower(u.name),lower(?))>0 ORDER BY m.active DESC,u.name,u.id LIMIT ? OFFSET ?`,
    orgId, Number(includeInactive), role, branchId, search(c), page.limit + 1, page.offset)
    return pageResult(c, list, page)
  })
  .post('/staff', async c => {
    if (!staffProfilesOnly(c)) throw missing()
    const { orgId } = requireRole(c, 'owner')
    const { name } = await body(c, z.object({ name: text(100) }))
    const id = newId()
    const timestamp = now()
    await db(c).batch([
      query(c, `INSERT INTO "user"(id,name,email,emailVerified,createdAt,updatedAt)
        VALUES (?,?,?,0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`, id, name, 'teacher-' + id + '@classhub.invalid'),
      query(c, "INSERT INTO memberships(org_id,user_id,role,created_at) VALUES (?,?,'teacher',?)", orgId, id, timestamp),
      audit(c, 'teacher.created', id),
    ])
    return result(c, { id }, 201)
  })
  .patch('/staff/:userId', async c => {
    const { orgId, userId } = requireRole(c, 'owner')
    const memberId = validated(z.string().regex(/^[a-zA-Z0-9_-]{16,64}$/), c.req.param('userId'))
    const { active } = await body(c, z.object({ active: z.boolean() }))
    const next = Number(active)
    const writes = await db(c).batch([
      query(c, "UPDATE memberships SET active=? WHERE org_id=? AND user_id=? AND role<>'owner' AND active<>?",
        next, orgId, memberId, next),
      query(c, `INSERT INTO audit_events(org_id,id,actor_id,event,target_id,occurred_at)
        SELECT ?,?,?,?,?,? WHERE changes()=1`, orgId, newId(), userId,
      active ? 'membership.reactivated' : 'membership.deactivated', memberId, now()),
    ])
    if (!writes[0].meta.changes) {
      const member = await one(c, "SELECT user_id FROM memberships WHERE org_id=? AND user_id=? AND role<>'owner'", orgId, memberId)
      if (!member) throw missing()
    }
    return result(c, { active })
  })
  // A one-time link for a member who forgot their password. Creating a new link revokes older unused ones.
  .post('/staff/:userId/password-reset', async c => {
    if (staffProfilesOnly(c)) throw missing()
    const { orgId, userId } = requireRole(c, 'owner')
    const memberId = validated(z.string().regex(/^[a-zA-Z0-9_-]{16,64}$/), c.req.param('userId'))
    const member = await one<{ user_id: string; shared: number }>(c, resetTargetSql, orgId, memberId)
    if (!member) throw missing()
    // One sign-in serves every workspace: only reset accounts that belong to this workspace alone.
    if (member.shared) throw conflict(sharedAccountMessage)
    const id = newId(), code = token(), timestamp = now(), expiresAt = timestamp + 86_400_000
    await db(c).batch([
      query(c, 'UPDATE password_resets SET used_at=? WHERE user_id=? AND used_at IS NULL', timestamp, memberId),
      query(c, `INSERT INTO password_resets(id,org_id,user_id,token_hash,created_by,created_at,expires_at) VALUES (?,?,?,?,?,?,?)`,
        id, orgId, memberId, await tokenHash(code), userId, timestamp, expiresAt),
      audit(c, 'membership.password_reset_link_created', memberId),
    ])
    return result(c, { code, expiresAt }, 201)
  })
  .post('/invitations', async c => {
    if (staffProfilesOnly(c)) throw missing()
    const { orgId } = requireRole(c, 'owner')
    const input = await body(c, z.object({
      email, role: z.enum(['teacher', 'branch_admin']), branch_id: uuid.nullable().default(null),
    }))
    if (input.role === 'branch_admin' && !input.branch_id) throw bad('Hãy chọn cơ sở cho quản trị viên.')
    if (input.branch_id && !await one(c, 'SELECT id FROM branches WHERE org_id=? AND id=?', orgId, input.branch_id)) throw missing()
    const id = newId()
    const code = token()
    const timestamp = now()
    const expiresAt = timestamp + 86_400_000
    await db(c).batch([
      query(c, `INSERT INTO invitations(org_id,id,branch_id,email,role,token_hash,created_at,expires_at)
        VALUES (?,?,?,?,?,?,?,?)`, orgId, id, input.branch_id, input.email, input.role,
      await tokenHash(code), timestamp, expiresAt),
      audit(c, 'invitation.created', id, { role: input.role, branchId: input.branch_id }),
    ])
    return result(c, { code, expiresAt }, 201)
  })
  .get('/courses', async c => {
    const { orgId } = requireRole(c, ...admins)
    const page = pagination(c)
    const q = search(c)
    const list = await rows(c, `SELECT id,code,name,subject,description,archived FROM courses WHERE org_id=?
      AND (instr(lower(name),lower(?))>0 OR instr(lower(code),lower(?))>0)
      ORDER BY archived,name,id LIMIT ? OFFSET ?`, orgId, q, q, page.limit + 1, page.offset)
    return pageResult(c, list, page)
  })
  .post('/courses', async c => {
    const { orgId } = requireRole(c, 'owner')
    const input = await body(c, courseInput)
    const id = newId(), timestamp = now()
    await db(c).batch([query(c, `INSERT INTO courses(org_id,id,code,name,subject,description,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?)`, orgId, id, input.code, input.name, input.subject, input.description, timestamp, timestamp),
    audit(c, 'course.created', id)])
    return result(c, { id }, 201)
  })
  .patch('/courses/:id', async c => {
    const { orgId } = requireRole(c, 'owner')
    const id = param(c, 'id')
    const input = await body(c, courseInput.extend({ archived: z.boolean().default(false) }))
    const write = await query(c, `UPDATE courses SET code=?,name=?,subject=?,description=?,archived=?,updated_at=?
      WHERE org_id=? AND id=?`, input.code, input.name, input.subject, input.description, Number(input.archived), now(), orgId, id).run()
    if (!write.meta.changes) throw missing()
    return result(c, { id })
  })
  .get('/classes', async c => {
    const scope = c.get('scope')
    const [rule, ...args] = classScope(scope)
    const page = pagination(c)
    const q = search(c)
    const list = await rows(c, `SELECT cl.id,cl.code,cl.name,cl.status,cl.capacity,cl.starts_on,cl.ends_on,
      b.name AS branch_name,co.name AS course_name,
      EXISTS (SELECT 1 FROM directory_classes d WHERE d.org_id=cl.org_id AND d.class_id=cl.id) AS shared,
      (SELECT COUNT(*) FROM enrollments e WHERE e.org_id=cl.org_id AND e.class_id=cl.id AND e.withdrawn_on IS NULL) AS enrolled
      FROM classes cl JOIN branches b ON b.org_id=cl.org_id AND b.id=cl.branch_id
      JOIN courses co ON co.org_id=cl.org_id AND co.id=cl.course_id
      WHERE cl.org_id=? AND ${rule} AND (instr(lower(cl.name),lower(?))>0 OR instr(lower(cl.code),lower(?))>0)
      ORDER BY cl.name,cl.id LIMIT ? OFFSET ?`, scope.orgId, ...args, q, q, page.limit + 1, page.offset)
    return pageResult(c, list, page)
  })
  .post('/classes', async c => {
    const scope = requireRole(c, ...admins)
    const input = await body(c, classCreate)
    classDates(input)
    if (scope.role === 'branch_admin' && scope.branchId !== input.branch_id) throw missing()
    const courseId = input.course_id ?? await homeroomCourse(c, scope.orgId)
    const id = newId(), timestamp = now()
    const writes = await db(c).batch([
      // Homeroom classes are in session for the whole school year, so they start active.
      query(c, `INSERT INTO classes(org_id,id,code,name,course_id,branch_id,starts_on,ends_on,capacity,room,notes,status,created_at,updated_at)
        SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,? FROM courses co JOIN branches b ON b.org_id=co.org_id
        WHERE co.org_id=? AND co.id=? AND co.archived=0 AND b.id=?`,
      scope.orgId, id, input.code, input.name, courseId, input.branch_id, input.starts_on, input.ends_on,
      input.capacity, input.room, input.notes, input.course_id ? 'draft' : 'active', timestamp, timestamp,
      scope.orgId, courseId, input.branch_id),
      query(c, `INSERT INTO audit_events(org_id,id,actor_id,event,target_id,occurred_at)
        SELECT org_id,?,?,'class.created',id,? FROM classes WHERE org_id=? AND id=?`, newId(), scope.userId, timestamp, scope.orgId, id),
    ])
    if (!writes[0].meta.changes) throw missing()
    return result(c, { id }, 201)
  })
  .get('/classes/:classId', async c => {
    const item = await scopedClass(c)
    const { orgId, role, userId } = c.get('scope')
    const [enrolled, teacher, next] = await Promise.all([
      one<{ count: number }>(c, `SELECT COUNT(*) AS count FROM enrollments
        WHERE org_id=? AND class_id=? AND enrolled_on<=? AND (withdrawn_on IS NULL OR withdrawn_on>?)`,
      orgId, item.id, today(), today()),
      one<{ name: string }>(c, `SELECT u.name FROM teacher_assignments a JOIN "user" u ON u.id=a.user_id
        JOIN memberships m ON m.org_id=a.org_id AND m.user_id=a.user_id AND m.active=1
        WHERE a.org_id=? AND a.class_id=? AND a.ended_at IS NULL ORDER BY a.duty='primary' DESC,u.name LIMIT 1`, orgId, item.id),
      one<{ id: string; lesson_date: string; starts_at: number; room: string }>(c, `SELECT id,lesson_date,starts_at,room
        FROM class_sessions WHERE org_id=? AND class_id=? AND status='scheduled' AND starts_at>=?
        AND (?<>'teacher' OR teacher_id=?) ORDER BY starts_at,id LIMIT 1`, orgId, item.id, now(), role, userId),
    ])
    return result(c, { ...item, enrolled: enrolled?.count ?? 0, teacher: teacher?.name ?? null, next })
  })
  .patch('/classes/:classId', async c => {
    const { orgId } = requireRole(c, ...admins)
    const item = await scopedClass(c)
    const input = await body(c, classInput.extend({ status: classStatus }))
    if (input.name !== item.name) await guardSharedClass(c, item.id)
    classDates(input)
    if (input.status !== item.status && !transitions[item.status]?.includes(input.status)) throw conflict('Chuyển trạng thái lớp không hợp lệ.')
    const write = await query(c, `UPDATE classes SET code=?,name=?,starts_on=?,ends_on=?,capacity=?,room=?,notes=?,status=?,updated_at=?
      WHERE org_id=? AND id=? AND status=? AND NOT EXISTS (
        SELECT 1 FROM class_sessions s WHERE s.org_id=classes.org_id AND s.class_id=classes.id AND s.status<>'cancelled'
          AND (s.lesson_date<? OR s.lesson_date>? OR (? IN ('completed','cancelled','archived') AND s.status='scheduled'))
      )`, input.code, input.name, input.starts_on, input.ends_on, input.capacity, input.room, input.notes, input.status, now(),
    orgId, item.id, item.status, input.starts_on, input.ends_on, input.status).run()
    if (!write.meta.changes) throw conflict('Lớp đã thay đổi hoặc vẫn có buổi học cần xử lý trong lịch.')
    return result(c, { id: item.id })
  })
  .get('/students', async c => {
    const { orgId } = requireRole(c, 'owner')
    const page = pagination(c)
    const q = search(c)
    const list = await rows(c, `SELECT s.id,s.code,s.name,s.active,d.external_class_id AS directory_class_id,
      c.revision AS directory_revision FROM students s
      LEFT JOIN directory_students d ON d.org_id=s.org_id AND d.student_id=s.id
      LEFT JOIN directory_connections c ON c.org_id=d.org_id WHERE s.org_id=?
      AND (instr(lower(s.name),lower(?))>0 OR instr(lower(s.code),lower(?))>0)
      ORDER BY s.name,s.id LIMIT ? OFFSET ?`, orgId, q, q, page.limit + 1, page.offset)
    return pageResult(c, list, page)
  })
  .post('/students', async c => {
    const { orgId } = requireRole(c, 'owner')
    if (sharedEnabled(c)) {
      const input = await body(c, directoryStudentInput)
      const externalId = await directoryWrite(c, { ...input, action: 'student.create', operationId: input.operation_id })
      const item = await one<{ student_id: string }>(c, 'SELECT student_id FROM directory_students WHERE org_id=? AND external_id=?', orgId, externalId ?? '')
      return result(c, { id: item?.student_id }, 201)
    }
    const input = await body(c, studentInput)
    const id = newId(), timestamp = now()
    await query(c, 'INSERT INTO students(org_id,id,code,name,created_at,updated_at) VALUES (?,?,?,?,?,?)',
      orgId, id, input.code, input.name, timestamp, timestamp).run()
    return result(c, { id }, 201)
  })
  .post('/students/import', async c => {
    const { orgId } = requireRole(c, 'owner')
    if (sharedEnabled(c)) throw conflict('Hãy cập nhật danh sách chung từ nguồn MealCheck.')
    const input = await body(c, z.object({ preview: z.boolean(), students: z.array(studentInput).min(1).max(100) }))
    const keys = input.students.map(row => row.code.toLowerCase())
    if (new Set(keys).size !== keys.length) throw bad('Có mã học viên lặp trong danh sách vừa dán.')
    const records = JSON.stringify(input.students.map(row => ({ ...row, id: newId() })))
    if (input.preview) {
      const matches = await rows<{ code: string }>(c, `SELECT s.code FROM students s
        WHERE s.org_id=? AND EXISTS (SELECT 1 FROM json_each(?) j WHERE s.code=j.value->>'code')`, orgId, records)
      return result(c, { existing: matches.map(row => row.code.toLowerCase()) })
    }
    const timestamp = now()
    const write = await query(c, `INSERT INTO students(org_id,id,code,name,created_at,updated_at)
      SELECT ?,j.value->>'id',j.value->>'code',j.value->>'name',?,? FROM json_each(?) j WHERE 1
      ON CONFLICT(org_id,code) DO NOTHING`, orgId, timestamp, timestamp, records).run()
    const created = write.meta.changes ?? 0
    return result(c, { created, skipped: input.students.length - created }, 201)
  })
  .patch('/students/:id', async c => {
    const { orgId } = requireRole(c, 'owner')
    const id = param(c, 'id')
    const linked = await one<{ external_id: string; code: string }>(c, `SELECT d.external_id,s.code FROM directory_students d
      JOIN students s ON s.org_id=d.org_id AND s.id=d.student_id WHERE d.org_id=? AND d.student_id=?`, orgId, id)
    if (linked) {
      const input = await body(c, directoryStudentInput)
      if (input.code !== linked.code) throw conflict('Mã hồ sơ dùng chung được giữ cố định để đối chiếu thẻ đã cấp.')
      await directoryWrite(c, { ...input, id: linked.external_id, action: 'student.update', operationId: input.operation_id })
      return result(c, { id })
    }
    const input = await body(c, studentInput)
    const write = await query(c, 'UPDATE students SET code=?,name=?,updated_at=? WHERE org_id=? AND id=?',
      input.code, input.name, now(), orgId, id).run()
    if (!write.meta.changes) throw missing()
    return result(c, { id })
  })
  .get('/students/:id/enrollments', async c => {
    const { orgId } = requireRole(c, 'owner')
    const id = param(c, 'id')
    const page = pagination(c)
    const list = await rows(c, `SELECT e.id,e.class_id,cl.name AS class_name,e.enrolled_on,e.withdrawn_on
      FROM enrollments e JOIN classes cl ON cl.org_id=e.org_id AND cl.id=e.class_id
      WHERE e.org_id=? AND e.student_id=? ORDER BY e.enrolled_on DESC,e.id LIMIT ? OFFSET ?`,
    orgId, id, page.limit + 1, page.offset)
    return pageResult(c, list, page)
  })
  .get('/classes/:classId/enrollments', async c => {
    const { orgId, role } = c.get('scope')
    const item = await scopedClass(c)
    const page = pagination(c)
    const list = await rows(c, `SELECT e.id,e.student_id,s.code,s.name,e.enrolled_on,e.withdrawn_on,
      EXISTS (SELECT 1 FROM directory_students d WHERE d.org_id=e.org_id AND d.enrollment_id=e.id) AS shared
      FROM enrollments e JOIN students s ON s.org_id=e.org_id AND s.id=e.student_id
      WHERE e.org_id=? AND e.class_id=? AND (?<>'teacher' OR e.withdrawn_on IS NULL)
      ORDER BY e.withdrawn_on IS NOT NULL,s.name,e.id LIMIT ? OFFSET ?`, orgId, item.id, role, page.limit + 1, page.offset)
    return pageResult(c, list, page)
  })
  .post('/classes/:classId/enrollments', async c => {
    const { orgId, role, userId } = requireRole(c, ...admins)
    const item = await scopedClass(c)
    await guardSharedClass(c, item.id)
    const input = await body(c, z.union([
      z.object({ student_code: text(30) }),
      z.object({ student: studentInput }),
    ]))
    const id = newId(), timestamp = now(), date = today()
    const statements: D1PreparedStatement[] = []
    const code = 'student' in input ? input.student.code : input.student_code
    if ('student' in input) {
      if (role !== 'owner') throw bad('Tạo hồ sơ học viên mới cần quyền chủ đơn vị.')
      statements.push(query(c, `INSERT INTO students(org_id,id,code,name,created_at,updated_at)
        SELECT org_id,?,?,?,?,? FROM classes WHERE org_id=? AND id=?
          AND status IN ('draft','scheduled','active') AND ends_on>=?`,
      newId(), code, input.student.name, timestamp, timestamp, orgId, item.id, date))
    }
    const writes = await db(c).batch([...statements,
      query(c, `INSERT INTO enrollments(org_id,id,class_id,student_id,enrolled_on,created_at,updated_at)
        SELECT s.org_id,?,cl.id,s.id,?,?,? FROM students s JOIN classes cl ON cl.org_id=s.org_id
        WHERE s.org_id=? AND s.code=? AND s.active=1 AND cl.id=? AND cl.status IN ('draft','scheduled','active') AND cl.ends_on>=?
          AND (?='owner' OR EXISTS (
            SELECT 1 FROM enrollments existing JOIN classes source ON source.org_id=existing.org_id AND source.id=existing.class_id
            WHERE existing.org_id=s.org_id AND existing.student_id=s.id AND source.branch_id=cl.branch_id
              AND existing.withdrawn_on IS NULL
          ))`,
      id, date, timestamp, timestamp, orgId, code, item.id, date, role),
      query(c, `INSERT INTO audit_events(org_id,id,actor_id,event,target_id,occurred_at)
        SELECT org_id,?,?,'enrollment.created',id,? FROM enrollments WHERE org_id=? AND id=?`,
      newId(), userId, timestamp, orgId, id),
    ])
    if (!writes.at(-2)?.meta.changes) throw missing()
    return result(c, { id }, 201)
  })
  .patch('/classes/:classId/enrollments/:id', async c => {
    const { orgId, userId } = requireRole(c, ...admins)
    const item = await scopedClass(c)
    const id = param(c, 'id')
    if (await one(c, 'SELECT student_id FROM directory_students WHERE org_id=? AND enrollment_id=?', orgId, id)) {
      throw conflict('Hãy đổi lớp hoặc trạng thái học sinh trong danh sách chung.')
    }
    const input = await body(c, z.object({ transfer_to: uuid.optional() }))
    const destination = input.transfer_to ? await scopedClass(c, input.transfer_to) : null
    if (destination) await guardSharedClass(c, destination.id)
    if (destination?.id === item.id) throw bad('Hãy chọn lớp khác để chuyển.')
    const timestamp = now(), date = today(), replacement = newId()
    const statements: D1PreparedStatement[] = []
    if (destination) {
      statements.push(query(c, `INSERT INTO enrollments(org_id,id,class_id,student_id,enrolled_on,created_at,updated_at)
        SELECT e.org_id,?,cl.id,e.student_id,?,?,? FROM enrollments e JOIN classes cl ON cl.org_id=e.org_id
        WHERE e.org_id=? AND e.class_id=? AND e.id=? AND e.withdrawn_on IS NULL
          AND cl.id=? AND cl.status IN ('draft','scheduled','active') AND cl.ends_on>=?`,
      replacement, date, timestamp, timestamp, orgId, item.id, id, destination.id, date))
    }
    statements.push(query(c, `UPDATE enrollments SET withdrawn_on=max(enrolled_on,?),updated_at=?
      WHERE org_id=? AND class_id=? AND id=? AND withdrawn_on IS NULL
      AND (? IS NULL OR EXISTS (SELECT 1 FROM enrollments n WHERE n.org_id=? AND n.id=?))`,
    date, timestamp, orgId, item.id, id, destination?.id ?? null, orgId, replacement))
    statements.push(query(c, `INSERT INTO audit_events(org_id,id,actor_id,event,target_id,occurred_at,details)
      SELECT org_id,?,?,?,id,?,? FROM enrollments WHERE org_id=? AND id=? AND changes()=1`,
    newId(), userId, destination ? 'enrollment.transferred' : 'enrollment.withdrawn', timestamp,
    JSON.stringify(destination ? { destination: destination.id, replacement } : {}), orgId, id))
    const writes = await db(c).batch(statements)
    if (!writes.at(-2)?.meta.changes) throw conflict('Ghi danh đã kết thúc hoặc lớp nhận hiện không mở ghi danh.')
    return result(c, { id, replacement: destination ? replacement : null })
  })
  .get('/classes/:classId/teachers', async c => {
    const { orgId, role } = c.get('scope')
    const item = await scopedClass(c)
    const page = pagination(c)
    const list = await rows(c, `SELECT a.user_id,u.name,a.duty,a.assigned_at,a.ended_at
      FROM teacher_assignments a JOIN "user" u ON u.id=a.user_id
      WHERE a.org_id=? AND a.class_id=? AND (?<>'teacher' OR a.ended_at IS NULL)
      ORDER BY a.ended_at IS NOT NULL,a.duty,u.name,a.user_id LIMIT ? OFFSET ?`,
    orgId, item.id, role, page.limit + 1, page.offset)
    return pageResult(c, list, page)
  })
  .post('/classes/:classId/teachers', async c => {
    const { orgId, userId } = requireRole(c, ...admins)
    const item = await scopedClass(c)
    const input = await body(c, z.object({ user_id: z.string().regex(/^[a-zA-Z0-9_-]{16,64}$/), duty: z.enum(['primary', 'support']) }))
    const timestamp = now()
    const writes = await db(c).batch([
      query(c, `INSERT INTO teacher_assignments(org_id,class_id,user_id,duty,assigned_at)
        SELECT org_id,?,user_id,?,? FROM memberships WHERE org_id=? AND user_id=? AND role='teacher' AND active=1
          AND (branch_id IS NULL OR branch_id=?)`, item.id, input.duty, timestamp, orgId, input.user_id, item.branch_id),
      query(c, `INSERT INTO audit_events(org_id,id,actor_id,event,target_id,occurred_at,details)
        SELECT ?,?,?,'teacher.assigned',?,?,? WHERE changes()=1`,
      orgId, newId(), userId, item.id, timestamp, JSON.stringify(input)),
    ])
    if (!writes[0].meta.changes) throw missing()
    return result(c, { id: input.user_id }, 201)
  })
  .delete('/classes/:classId/teachers/:userId', async c => {
    const { orgId, userId } = requireRole(c, ...admins)
    const item = await scopedClass(c)
    const target = validated(z.string().max(64), c.req.param('userId'))
    const timestamp = now()
    const writes = await db(c).batch([
      query(c, `UPDATE teacher_assignments SET ended_at=? WHERE org_id=? AND class_id=? AND user_id=? AND ended_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM class_sessions WHERE org_id=? AND class_id=? AND teacher_id=? AND status='scheduled')`,
      timestamp, orgId, item.id, target, orgId, item.id, target),
      query(c, `INSERT INTO audit_events(org_id,id,actor_id,event,target_id,occurred_at,details)
        SELECT ?,?,?,'teacher.unassigned',?,?,? WHERE changes()=1`,
      orgId, newId(), userId, item.id, timestamp, JSON.stringify({ userId: target })),
    ])
    if (!writes[0].meta.changes) throw conflict('Phân công đã kết thúc hoặc giáo viên vẫn phụ trách buổi học chưa hoàn tất.')
    return result(c, { id: target })
  })
  .get('/dashboard/analytics', dashboardAnalytics)
  .get('/dashboard', async c => {
    const scope = c.get('scope')
    await ensurePrepared(c)
    const [rule, ...args] = classScope(scope)
    const date = today()
    const timestamp = now()
    const pendingPage = validated(z.coerce.number().int().min(1).max(10_000), c.req.query('pending_page') ?? 1)
    const [stats, sessions, unassigned, pendingSessions, todaySessions] = await Promise.all([
      one(c, `WITH visible AS (SELECT cl.* FROM classes cl WHERE cl.org_id=? AND ${rule})
        SELECT (SELECT COUNT(*) FROM visible WHERE status='active') AS active_classes,
        (SELECT COUNT(DISTINCT e.student_id) FROM enrollments e JOIN visible v ON v.org_id=e.org_id AND v.id=e.class_id
          WHERE e.withdrawn_on IS NULL AND v.status IN ('active','scheduled')) AS enrolled_students,
        (SELECT COUNT(DISTINCT a.user_id) FROM teacher_assignments a JOIN visible v ON v.org_id=a.org_id AND v.id=a.class_id
          JOIN memberships m ON m.org_id=a.org_id AND m.user_id=a.user_id WHERE a.ended_at IS NULL AND m.active=1) AS teachers,
        (SELECT COUNT(*) FROM class_sessions s JOIN visible v ON v.org_id=s.org_id AND v.id=s.class_id
          WHERE s.lesson_date=? AND s.status<>'cancelled' AND (?<>'teacher' OR s.teacher_id=?)) AS today_sessions,
        (SELECT COUNT(*) FROM class_sessions s JOIN visible v ON v.org_id=s.org_id AND v.id=s.class_id
          WHERE s.ends_at<=? AND s.status='scheduled' AND (?<>'teacher' OR s.teacher_id=?)) AS pending`,
      scope.orgId, ...args, date, scope.role, scope.userId, timestamp, scope.role, scope.userId),
      rows(c, `SELECT s.id,s.starts_at,s.ends_at,s.lesson_date,s.attendance_state,s.room,cl.name AS class_name
        FROM class_sessions s JOIN classes cl ON cl.org_id=s.org_id AND cl.id=s.class_id
        WHERE s.org_id=? AND ${rule} AND (?<>'teacher' OR s.teacher_id=?) AND s.lesson_date>=? AND s.status='scheduled'
        ORDER BY s.starts_at,s.id LIMIT 8`, scope.orgId, ...args, scope.role, scope.userId, date),
      rows(c, `SELECT cl.id,cl.name FROM classes cl WHERE cl.org_id=? AND ${rule} AND cl.status='active'
        AND NOT EXISTS (SELECT 1 FROM teacher_assignments a JOIN memberships m ON m.org_id=a.org_id AND m.user_id=a.user_id
          WHERE a.org_id=cl.org_id AND a.class_id=cl.id AND a.ended_at IS NULL AND m.active=1)
        ORDER BY cl.name,cl.id LIMIT 8`, scope.orgId, ...args),
      rows(c, `SELECT s.id,s.starts_at,s.ends_at,s.lesson_date,s.attendance_state,s.status,s.room,cl.name AS class_name
        FROM class_sessions s JOIN classes cl ON cl.org_id=s.org_id AND cl.id=s.class_id
        WHERE s.org_id=? AND ${rule} AND (?<>'teacher' OR s.teacher_id=?) AND s.ends_at<=? AND s.status='scheduled'
        ORDER BY s.ends_at DESC,s.id LIMIT 9 OFFSET ?`, scope.orgId, ...args, scope.role, scope.userId, timestamp, (pendingPage - 1) * 8),
      rows(c, `SELECT s.id,s.starts_at,s.ends_at,s.lesson_date,s.attendance_state,s.status,s.room,cl.name AS class_name
        FROM class_sessions s JOIN classes cl ON cl.org_id=s.org_id AND cl.id=s.class_id
        WHERE s.org_id=? AND ${rule} AND (?<>'teacher' OR s.teacher_id=?) AND s.lesson_date=? AND s.status<>'cancelled'
        ORDER BY s.starts_at,s.id LIMIT 10`, scope.orgId, ...args, scope.role, scope.userId, date),
    ])
    return result(c, { stats, sessions, unassigned, date, pendingPage, pendingSessions: pendingSessions.slice(0, 8),
      pendingHasMore: pendingSessions.length > 8, todaySessions })
  })
