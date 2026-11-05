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
