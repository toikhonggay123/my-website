import { z } from 'zod'
import {
  type Ctx, Failure, audit, body, conflict, db, missing, newId, now,
  one, query, requireRole, result, router, rows, text, today, tokenHash, uuid, validated,
} from './core'

const sourceClass = z.object({ id: text(80), name: text(150), grade: text(40) })
const sourceStudent = z.object({ id: text(200), name: text(150), code: text(150), class_id: text(80), active: z.union([z.literal(0), z.literal(1)]) })
const snapshotSchema = z.object({
  schemaVersion: z.literal(1), sourceId: text(80), space: z.enum(['live', 'demo']),
  revision: z.number().int().nonnegative(), classes: z.array(sourceClass).max(100),
  students: z.array(sourceStudent).max(1000),
})
type Snapshot = z.output<typeof snapshotSchema>
type Connection = { source_id: string; revision: number; branch_id: string; synced_at: number }
type LocalStudent = {
  id: string; code: string; name: string; active: number; external_id: string | null
  external_class_id: string | null; enrollment_id: string | null; class_id: string | null; withdrawn_on: string | null
}
export const directoryStudentInput = z.object({
  name: text(150), code: text(150), class_id: text(80),
  active: z.union([z.literal(0), z.literal(1)]).default(1),
  revision: z.number().int().nonnegative(), operation_id: uuid,
})
export function sharedEnabled(c: Ctx, orgId = c.get('scope').orgId) {
  return !c.get('demoDb') && new URL(c.req.url).origin === c.env.APP_ORIGIN && c.env.MEALCHECK_DIRECTORY_ORG_ID === orgId
    && Boolean(c.env.MEALCHECK_DIRECTORY_ORIGIN && c.env.MEALCHECK_DIRECTORY_KEY)
}
async function stableId(value: string) {
  const hash = await tokenHash(value)
  return hash.slice(0, 8) + '-' + hash.slice(8, 12) + '-4' + hash.slice(13, 16)
    + '-8' + hash.slice(17, 20) + '-' + hash.slice(20, 32)
}
async function upstream(c: Ctx, mutation?: object) {
  if (!sharedEnabled(c)) throw missing()
  const origin = c.env.MEALCHECK_DIRECTORY_ORIGIN!
  if (origin !== 'https://my-website.fyllxestonia.workers.dev') {
    throw new Failure(503, 'directory_config', 'Địa chỉ danh sách chung chưa hợp lệ.')
  }
  let response: Response
  try {
    const request = new Request(origin + '/api/v1/shared-directory?space=live', {
      method: mutation ? 'POST' : 'GET', redirect: 'manual', signal: AbortSignal.timeout(6000),
      headers: { Authorization: 'Bearer ' + c.env.MEALCHECK_DIRECTORY_KEY, Origin: origin, 'Content-Type': 'application/json' },
      ...(mutation ? { body: JSON.stringify(mutation) } : {}),
    })
    response = c.env.MEALCHECK_DIRECTORY ? await c.env.MEALCHECK_DIRECTORY.fetch(request) : await fetch(request)
  } catch {
    throw new Failure(503, 'directory_offline', 'Chưa kết nối được MealCheck web. Hãy kiểm tra mạng rồi tải lại danh sách.')
  }
  const value = await response.json().catch(() => null) as { error?: string; snapshot?: unknown; id?: string } | null
  if (!response.ok) {
    if (response.status === 409) throw conflict(value?.error ?? 'Danh sách vừa thay đổi. Hãy tải lại.')
    throw new Failure(503, 'directory_unavailable', 'Kết nối danh sách chung chưa sẵn sàng. Kiểm tra MealCheck và cấu hình kết nối.')
  }
  const parsed = snapshotSchema.safeParse(mutation ? value?.snapshot : value)
  if (!parsed.success || parsed.data.space !== 'live') {
    throw conflict('Danh sách chung không hợp lệ hoặc vượt giới hạn 100 lớp, 1.000 học sinh.')
  }
  return { snapshot: parsed.data, externalId: value?.id }
}

export async function applyDirectory(c: Ctx, snapshot: Snapshot) {
  const { orgId, userId } = c.get('scope')
  const connection = await one<Connection>(c, 'SELECT * FROM directory_connections WHERE org_id=?', orgId)
  if (connection && connection.source_id !== snapshot.sourceId) throw conflict('Nguồn danh sách chung đã đổi. Cần kiểm tra kết nối trước khi đồng bộ.')
  if (connection && connection.revision > snapshot.revision) throw conflict('Nguồn danh sách có phiên bản cũ hơn bản đã nhận.')
  if (connection?.revision === snapshot.revision) return
  const branchId = connection?.branch_id ?? (await one<{ id: string }>(c, 'SELECT id FROM branches WHERE org_id=? ORDER BY id LIMIT 1', orgId))?.id
  if (!branchId) throw conflict('Đơn vị cần có cơ sở trước khi dùng danh sách chung.')
  const existing = await rows<LocalStudent>(c, `SELECT s.*,d.external_id,d.external_class_id,d.enrollment_id,e.class_id,e.withdrawn_on
    FROM students s LEFT JOIN directory_students d ON d.org_id=s.org_id AND d.student_id=s.id
    LEFT JOIN enrollments e ON e.org_id=d.org_id AND e.id=d.enrollment_id WHERE s.org_id=?`, orgId)
  const knownClasses = await rows<{ external_id: string; class_id: string }>(c, 'SELECT external_id,class_id FROM directory_classes WHERE org_id=?', orgId)
  const byCode = new Map(existing.map(student => [student.code.toLowerCase(), student]))
  const byExternal = new Map(existing.filter(student => student.external_id).map(student => [student.external_id!, student]))
  const classIds = new Map(knownClasses.map(item => [item.external_id, item.class_id]))
  const remoteClasses = new Map(snapshot.classes.map(item => [item.id, item]))
  if (remoteClasses.size !== snapshot.classes.length) throw conflict('Nguồn có mã lớp trùng.')
  const codes = new Set<string>(), identities = new Set<string>()
  for (const item of snapshot.students) {
    const key = item.code.toLowerCase()
    if (codes.has(key) || identities.has(item.id) || !remoteClasses.has(item.class_id)) throw conflict('Nguồn có mã học sinh trùng hoặc thiếu lớp liên quan.')
    codes.add(key)
    identities.add(item.id)
  }
  const courseId = await stableId(orgId + ':mealcheck-course')
  const classPayload = await Promise.all(snapshot.classes.map(async item => {
    const id = classIds.get(item.id) ?? await stableId(orgId + ':' + snapshot.sourceId + ':class:' + item.id)
    classIds.set(item.id, id)
    return { id, externalId: item.id, name: item.name, grade: item.grade, code: 'MC-' + id.slice(0, 8) }
  }))
  const studentPayload = await Promise.all(snapshot.students.map(async item => {
    const linked = byExternal.get(item.id)
    const matching = byCode.get(item.code.toLowerCase())
    if (!linked && matching && (matching.external_id || matching.code !== item.code || matching.name !== item.name)) {
      throw conflict('Mã học sinh đang được dùng bởi hồ sơ khác. Cần kiểm tra trùng mã trước khi nối danh sách.')
    }
    const local = linked ?? matching
    const id = local?.id ?? await stableId(orgId + ':' + snapshot.sourceId + ':student:' + item.id)
    const classId = classIds.get(item.class_id)!
    const keep = local?.class_id === classId && local.withdrawn_on === null && local.enrollment_id
    return {
      id, externalId: item.id, externalClassId: item.class_id, classId,
      code: item.code, name: item.name, active: item.active,
      enrollmentId: item.active ? keep || await stableId(orgId + ':enrollment:' + item.id + ':' + snapshot.revision) : null,
    }
  }))
  // Missing source records are retired locally. Historical educational rows are retained.
  for (const item of existing.filter(item => item.external_id && !identities.has(item.external_id))) {
    studentPayload.push({ id: item.id, externalId: item.external_id!, externalClassId: item.external_class_id!,
      classId: item.class_id!, code: item.code, name: item.name, active: 0, enrollmentId: null })
  }
  const counts = new Map<string, number>()
  for (const item of studentPayload) if (item.active) counts.set(item.classId, (counts.get(item.classId) ?? 0) + 1)
  if ([...counts.values()].some(count => count > 100)) throw conflict('Một lớp trong danh sách chung vượt giới hạn 100 học sinh.')
  const timestamp = now(), nonce = newId(), date = today()
  const year = Number(date.slice(0, 4)) - (Number(date.slice(5, 7)) < 8 ? 1 : 0)
  const classes = JSON.stringify(classPayload), students = JSON.stringify(studentPayload)
  const guard = 'EXISTS (SELECT 1 FROM directory_connections dc WHERE dc.org_id=? AND dc.sync_nonce=?)'
  const guardArgs = [orgId, nonce]
  const writes = await db(c).batch([
    query(c, 'INSERT INTO directory_connections(org_id,source_id,branch_id) VALUES (?,?,?) ON CONFLICT(org_id) DO NOTHING', orgId, snapshot.sourceId, branchId),
    query(c, `UPDATE directory_connections SET revision=?,sync_nonce=?,synced_at=?
      WHERE org_id=? AND source_id=? AND revision<?`, snapshot.revision, nonce, timestamp, orgId, snapshot.sourceId, snapshot.revision),
    query(c, `INSERT INTO courses(org_id,id,code,name,subject,created_at,updated_at)
      SELECT ?,?,'MC-SHARED','Lớp sinh hoạt chung','Sinh hoạt lớp',?,? WHERE ${guard}
      ON CONFLICT(org_id,id) DO NOTHING`, orgId, courseId, timestamp, timestamp, ...guardArgs),
    query(c, `INSERT INTO classes(org_id,id,course_id,branch_id,code,name,starts_on,ends_on,capacity,status,created_at,updated_at)
      SELECT ?,value->>'id',?,?,value->>'code',value->>'name',?,?,100,'active',?,?
      FROM json_each(?) WHERE ${guard}
      ON CONFLICT(org_id,id) DO UPDATE SET name=excluded.name,updated_at=excluded.updated_at`,
    orgId, courseId, branchId, year + '-08-01', (year + 1) + '-07-31', timestamp, timestamp, classes, ...guardArgs),
    query(c, `INSERT INTO directory_classes(org_id,class_id,external_id,grade)
      SELECT ?,value->>'id',value->>'externalId',value->>'grade' FROM json_each(?) WHERE ${guard}
      ON CONFLICT(org_id,class_id) DO UPDATE SET grade=excluded.grade`, orgId, classes, ...guardArgs),
    query(c, `INSERT INTO students(org_id,id,code,name,active,created_at,updated_at)
      SELECT ?,value->>'id',value->>'code',value->>'name',value->>'active',?,? FROM json_each(?) WHERE ${guard}
      ON CONFLICT(org_id,id) DO UPDATE SET code=excluded.code,name=excluded.name,active=excluded.active,updated_at=excluded.updated_at`,
    orgId, timestamp, timestamp, students, ...guardArgs),
    query(c, `UPDATE enrollments SET withdrawn_on=max(enrolled_on,?),updated_at=? WHERE org_id=? AND withdrawn_on IS NULL
      AND id IN (SELECT ds.enrollment_id FROM directory_students ds LEFT JOIN json_each(?) j
        ON j.value->>'externalId'=ds.external_id WHERE ds.org_id=? AND ds.enrollment_id IS NOT (j.value->>'enrollmentId'))
      AND ${guard}`, date, timestamp, orgId, students, orgId, ...guardArgs),
    query(c, `INSERT INTO enrollments(org_id,id,class_id,student_id,enrolled_on,created_at,updated_at)
      SELECT ?,j.value->>'enrollmentId',j.value->>'classId',j.value->>'id',?,?,? FROM json_each(?) j
      WHERE j.value->>'active'=1 AND ${guard} AND NOT EXISTS (SELECT 1 FROM enrollments e WHERE e.org_id=? AND e.id=j.value->>'enrollmentId')`,
    orgId, date, timestamp, timestamp, students, ...guardArgs, orgId),
    query(c, `INSERT INTO directory_students(org_id,student_id,external_id,external_class_id,enrollment_id)
      SELECT ?,value->>'id',value->>'externalId',value->>'externalClassId',value->>'enrollmentId' FROM json_each(?) WHERE ${guard}
      ON CONFLICT(org_id,student_id) DO UPDATE SET external_class_id=excluded.external_class_id,enrollment_id=excluded.enrollment_id`,
    orgId, students, ...guardArgs),
    query(c, `INSERT INTO audit_events(org_id,id,actor_id,event,target_id,occurred_at,details)
      SELECT ?,?,?,'directory.synchronized',?,?,? WHERE ${guard}`, orgId, newId(), userId, orgId, timestamp,
    JSON.stringify({ revision: snapshot.revision, students: snapshot.students.length, classes: snapshot.classes.length }), ...guardArgs),
  ])
  if (!writes[1].meta.changes) {
    const latest = await one<Connection>(c, 'SELECT * FROM directory_connections WHERE org_id=?', orgId)
    if (latest?.source_id !== snapshot.sourceId || latest.revision < snapshot.revision) throw conflict('Kết nối danh sách vừa thay đổi.')
  }
}

// Best-effort throttle per Worker isolate. Each check downloads the whole roster (up to 1,000 students),
// so ordinary reads reuse a check made in the last few seconds. Roster screens pass force=true.
export const directoryRecheckMs = 15_000
const lastChecked = new Map<string, number>()
export async function refreshDirectory(c: Ctx, { force = true } = {}) {
  if (!sharedEnabled(c)) return
  const { orgId } = c.get('scope')
  const checkedAt = lastChecked.get(orgId)
  if (!force && checkedAt !== undefined && now() - checkedAt < directoryRecheckMs) return
  await applyDirectory(c, (await upstream(c)).snapshot)
  lastChecked.set(orgId, now())
}
export async function directoryWrite(c: Ctx, mutation: object) {
  const response = await upstream(c, mutation)
  try { await applyDirectory(c, response.snapshot) } catch {
    lastChecked.delete(c.get('scope').orgId)
    throw new Failure(503, 'directory_saved', 'Đã lưu vào danh sách chung. ClassHub chưa cập nhật được. Hãy tải lại để kiểm tra kết quả.')
  }
  lastChecked.set(c.get('scope').orgId, now())
  return response.externalId
}
export async function guardSharedClass(c: Ctx, classId: string) {
  if (await one(c, 'SELECT class_id FROM directory_classes WHERE org_id=? AND class_id=?', c.get('scope').orgId, classId)) {
    throw conflict('Hãy cập nhật học sinh hoặc tên lớp trong danh sách chung để hai ứng dụng cùng nhận thay đổi.')
  }
}
export const directoryRoutes = router()
  .get('/shared-directory', async c => {
    requireRole(c, 'owner')
    if (!sharedEnabled(c)) return result(c, { enabled: false })
    await refreshDirectory(c)
    const { orgId } = c.get('scope')
    const connection = await one<Connection>(c, 'SELECT * FROM directory_connections WHERE org_id=?', orgId)
    const classes = await rows(c, `SELECT d.external_id AS id,d.grade,cl.name,d.class_id FROM directory_classes d
      JOIN classes cl ON cl.org_id=d.org_id AND cl.id=d.class_id WHERE d.org_id=? ORDER BY d.grade,cl.name`, orgId)
    return result(c, { enabled: true, revision: connection?.revision, syncedAt: connection?.synced_at, classes })
  })
  .post('/shared-directory/classes', async c => {
    requireRole(c, 'owner')
    const input = await body(c, z.object({
      id: text(80).optional(), name: text(150), grade: text(40), operation_id: uuid, revision: z.number().int().nonnegative(),
    }))
    const id = await directoryWrite(c, { ...input, action: input.id ? 'class.update' : 'class.create', operationId: input.operation_id })
    return result(c, { id })
  })
