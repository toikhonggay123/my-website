import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import test from 'node:test'

function schema() {
  const db = new DatabaseSync(':memory:')
  db.exec('PRAGMA foreign_keys=ON')
  db.exec(readFileSync(new URL('../migrations/0001_accounts.sql', import.meta.url), 'utf8'))
  return db
}
const add = (db: DatabaseSync, id: string, role: string | null) => db.prepare(
  'INSERT INTO accounts(id,email,name,platform_role,created_at,updated_at) VALUES (?,?,?,?,0,0)').run(id, id + '@example.test', id, role)

test('the last active founder can never be demoted or disabled', t => {
  const db = schema()
  t.after(() => db.close())
  add(db, 'a', 'founder')
  assert.throws(() => db.exec("UPDATE accounts SET platform_role=NULL WHERE id='a'"), /LAST_FOUNDER/)
  assert.throws(() => db.exec("UPDATE accounts SET status='disabled' WHERE id='a'"), /LAST_FOUNDER/)
  add(db, 'b', 'founder')
  db.exec("UPDATE accounts SET platform_role='platform_admin' WHERE id='a'")
  assert.throws(() => db.exec("UPDATE accounts SET status='disabled' WHERE id='b'"), /LAST_FOUNDER/)
  db.exec("UPDATE accounts SET name='Đổi tên' WHERE id='b'")
})

test('emails are unique regardless of case and roles are constrained', t => {
  const db = schema()
  t.after(() => db.close())
  add(db, 'a', null)
  assert.throws(() => db.prepare("INSERT INTO accounts(id,email,name,created_at,updated_at) VALUES ('x','A@EXAMPLE.TEST','x',0,0)").run(), /UNIQUE/)
  assert.throws(() => add(db, 'c', 'owner'), /CHECK/)
})
