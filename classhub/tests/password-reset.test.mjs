import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import test from 'node:test'
import { resetRedeemSql, resetTargetSql } from '../src/server/password-reset.ts'

// Runs the exact reset queries against every ClassHub migration on an in-memory SQLite database.
function database() {
  const db = new DatabaseSync(':memory:')
  for (const file of readdirSync(new URL('../migrations/', import.meta.url)).filter(name => name.endsWith('.sql')).sort()) {
    db.exec(readFileSync(new URL('../migrations/' + file, import.meta.url), 'utf8'))
  }
  const at = new Date(0).toISOString()
  for (const [id, email] of [['owner-a', 'a@example.test'], ['owner-b', 'b@example.test'], ['teacher', 't@example.test']]) {
    db.prepare(`INSERT INTO "user"(id,name,email,emailVerified,createdAt,updatedAt) VALUES (?,?,?,1,?,?)`).run(id, id, email, at, at)
    db.prepare(`INSERT INTO account(id,accountId,providerId,userId,password,createdAt,updatedAt) VALUES (?,?,'credential',?,'hash',?,?)`)
      .run('acc-' + id, id, id, at, at)
  }
  for (const org of ['org-a', 'org-b']) {
    db.prepare(`INSERT INTO organizations(id,name,type,created_at,updated_at) VALUES (?,?,'school',0,0)`).run(org, org)
  }
  const member = (org, user, role) => db.prepare('INSERT INTO memberships(org_id,user_id,role,created_at) VALUES (?,?,?,0)').run(org, user, role)
  member('org-a', 'owner-a', 'owner')
  member('org-b', 'owner-b', 'owner')
  member('org-a', 'teacher', 'teacher')
  return { db, member }
}
const target = (db, org, user) => db.prepare(resetTargetSql).get(org, user)
const link = (db, org, user, hash) => db.prepare(`INSERT INTO password_resets(id,org_id,user_id,token_hash,created_by,created_at,expires_at)
  VALUES (?,?,?,?,?,0,?)`).run('reset-' + hash, org, user, hash, 'owner-' + org.slice(-1), Date.now() + 86_400_000)
const redeem = (db, hash) => db.prepare(resetRedeemSql).get(hash, Date.now())

test('an owner can reset a member whose account belongs to that workspace alone', () => {
  const { db } = database()
  assert.deepEqual({ ...target(db, 'org-a', 'teacher') }, { user_id: 'teacher', shared: 0 })
  link(db, 'org-a', 'teacher', 'h1')
  assert.equal(redeem(db, 'h1')?.user_id, 'teacher')
})

test('a member who also belongs to another workspace cannot be reset by either owner', () => {
  const { db, member } = database()
  member('org-b', 'teacher', 'teacher')
  assert.equal(target(db, 'org-a', 'teacher')?.shared, 1)
  assert.equal(target(db, 'org-b', 'teacher')?.shared, 1)
  // Owners are never reset this way, and the owner of B is no member of A at all.
  assert.equal(target(db, 'org-a', 'owner-a'), undefined)
  assert.equal(target(db, 'org-a', 'owner-b'), undefined)
})

test('an inactive membership elsewhere still blocks, since the same sign-in is used there', () => {
  const { db, member } = database()
  member('org-b', 'teacher', 'teacher')
  db.prepare("UPDATE memberships SET active=0 WHERE org_id='org-b' AND user_id='teacher'").run()
  assert.equal(target(db, 'org-a', 'teacher')?.shared, 1)
})

test('an open link stops working once the member joins another workspace', () => {
  const { db, member } = database()
  link(db, 'org-a', 'teacher', 'h2')
  assert.equal(redeem(db, 'h2')?.user_id, 'teacher')
  member('org-b', 'teacher', 'teacher')
  assert.equal(redeem(db, 'h2'), undefined)
})
