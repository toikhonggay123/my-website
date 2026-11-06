import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import test from 'node:test'

function schema() {
  const db = new DatabaseSync(':memory:')
  db.exec('PRAGMA foreign_keys=ON')
  for (const file of readdirSync(new URL('../migrations/', import.meta.url)).sort()) {
    db.exec(readFileSync(new URL('../migrations/' + file, import.meta.url), 'utf8'))
  }
  db.exec(`
    INSERT INTO organizations(id,name,type,created_at,updated_at)
      VALUES ('org-a','Đơn vị A','center',0,0),('org-b','Đơn vị B','center',0,0);
    INSERT INTO branches VALUES ('org-a','branch-a','Cơ sở A'),('org-b','branch-b','Cơ sở B');
    INSERT INTO courses(org_id,id,code,name,subject,created_at,updated_at)
      VALUES ('org-a','course-a','A','Toán','Toán',0,0);
    INSERT INTO classes(org_id,id,course_id,branch_id,code,name,starts_on,ends_on,capacity,created_at,updated_at)
      VALUES ('org-a','class-a','course-a','branch-a','A','Toán A','2026-01-01','2026-12-31',1,0,0);
    INSERT INTO students(org_id,id,code,name,created_at,updated_at) VALUES
      ('org-a','student-a','A','Học viên A',0,0),('org-a','student-b','B','Học viên B',0,0),
      ('org-b','student-c','C','Học viên C',0,0);
  `)
  return db
}
test('tenant ownership is enforced on branches, courses and students', t => {
  const db = schema()
  t.after(() => db.close())
  assert.throws(() => db.exec(`INSERT INTO classes(org_id,id,course_id,branch_id,code,name,starts_on,ends_on,capacity,created_at,updated_at)
    VALUES ('org-b','class-b','course-a','branch-b','A','Toán A','2026-01-01','2026-12-31',1,0,0)`), /FOREIGN KEY/)
  assert.throws(() => db.exec(`INSERT INTO enrollments VALUES ('org-a','wrong','class-a','student-c','2026-06-01',NULL,0,0)`), /FOREIGN KEY/)
})
test('withdrawal preserves history while freeing a seat and allowing re-enrollment', t => {
  const db = schema()
  t.after(() => db.close())
  db.exec(`INSERT INTO enrollments VALUES ('org-a','one','class-a','student-a','2026-06-01',NULL,0,0)`)
  assert.throws(() => db.exec(`INSERT INTO enrollments VALUES ('org-a','two','class-a','student-a','2026-06-01',NULL,0,0)`), /ENROLLMENT_OVERLAP/)
  assert.throws(() => db.exec(`INSERT INTO enrollments VALUES ('org-a','two','class-a','student-b','2026-06-01',NULL,0,0)`), /CLASS_CAPACITY/)
  db.exec(`UPDATE enrollments SET withdrawn_on='2026-06-02' WHERE id='one'`)
  db.exec(`INSERT INTO enrollments VALUES ('org-a','two','class-a','student-a','2026-06-02',NULL,0,0)`)
  assert.equal(db.prepare('SELECT COUNT(*) AS total FROM enrollments').get().total, 2)
})

test('school timetables keep one draft per term and one attendance session per class and shift', t => {
  const db = schema()
  t.after(() => db.close())
  db.exec(`
    INSERT INTO "user"(id,name,email,emailVerified,createdAt,updatedAt) VALUES ('teacher-a','GV A','a@example.test',0,0,0);
    INSERT INTO memberships(org_id,user_id,role,created_at) VALUES ('org-a','teacher-a','teacher',0);
    INSERT INTO teacher_assignments(org_id,class_id,user_id,duty,assigned_at) VALUES ('org-a','class-a','teacher-a','primary',0);
    INSERT INTO school_terms VALUES ('org-a','term-a','HK1','2026-09-05','2027-01-17',0);
    INSERT INTO subjects(org_id,id,name,created_at) VALUES ('org-a','math','Toán',0);
    INSERT INTO timetable_versions(org_id,id,term_id,status,created_at,updated_at) VALUES ('org-a','draft-a','term-a','draft',0,0);
  `)
  const version = (id, status, effective) => db.exec(`INSERT INTO timetable_versions(org_id,id,term_id,status,effective_from,created_at,updated_at)
    VALUES ('org-a','${id}','term-a','${status}',${effective ? `'${effective}'` : 'NULL'},0,0)`)
  assert.throws(() => version('draft-b', 'draft'), /UNIQUE/)
  assert.throws(() => version('bad', 'published'), /CHECK/)
  version('pub-a', 'published', '2026-11-09')
  assert.throws(() => version('pub-b', 'published', '2026-11-09'), /UNIQUE/)
  version('old-a', 'archived', '2026-11-09')
  assert.throws(() => db.exec(`INSERT INTO timetable_slots VALUES ('org-b','draft-a','class-a',1,'morning',1,'math','')`), /FOREIGN KEY/)
  db.exec(`INSERT INTO timetable_slots VALUES ('org-a','draft-a','class-a',1,'morning',1,'math','')`)
  const session = (id, shift, start) => db.exec(`INSERT INTO class_sessions(org_id,id,class_id,branch_id,teacher_id,lesson_date,starts_at,ends_at,shift,created_at,updated_at)
    VALUES ('org-a','${id}','class-a','branch-a','teacher-a','2026-11-09',${start},${start + 1000},${shift ? `'${shift}'` : 'NULL'},0,0)`)
  session('morning-a', 'morning', 1000)
  assert.throws(() => session('morning-b', 'morning', 5000), /UNIQUE/)
  session('afternoon-a', 'afternoon', 10000)
  session('course-a', null, 20000)
  assert.equal(db.prepare('SELECT COUNT(*) AS total FROM class_sessions').get().total, 3)
})

test('local bootstrap reuses existing organizations and never duplicates memberships', t => {
  const db = schema()
  t.after(() => db.close())
  const bootstrap = readFileSync(new URL('../scripts/local-bootstrap.sql', import.meta.url), 'utf8')
  db.exec(bootstrap)
  db.exec(bootstrap)
  assert.equal(db.prepare('SELECT COUNT(*) AS total FROM organizations').get().total, 2)
  assert.equal(db.prepare('SELECT COUNT(*) AS total FROM classes').get().total, 1)
  assert.equal(db.prepare("SELECT COUNT(*) AS total FROM memberships WHERE role='owner'").get().total, 2)
})
