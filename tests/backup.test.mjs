import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import {restoreBackup,tableOrder} from '../scripts/backup-format.mjs';
function fixture(){
  const db=new DatabaseSync(':memory:');for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())db.exec(fs.readFileSync('drizzle/'+f,'utf8'));
  const tables=Object.fromEntries(tableOrder.map(t=>[t,{columns:db.prepare('PRAGMA table_info('+t+')').all().map(c=>c.name),rows:[],next_offset:null,projections:[{truncated:false,omitted_columns:0,omitted_rows:0,truncated_values:0}]}]));db.close();
  tables.students.rows.push({id:'live:S1',space:'live',code:'S1',name:"Học sinh thử O'An",grade:'9',class:'9B',active:1});return {complete:true,tables};
}
test('Private restore SQL preserves data, indexes, triggers and migration history',()=>{
  const b=fixture(),result=restoreBackup(b),db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');db.exec(result.sql);
  assert.equal(db.prepare('SELECT name FROM students').get().name,b.tables.students.rows[0].name);
  assert.equal(db.prepare('SELECT count(*) n FROM d1_migrations').get().n,4);
  assert.ok(db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='trigger'").get().n>0);assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);db.close();
});
test('Backup validation rejects missing, truncated and corrupt records',()=>{
  const b=fixture();b.complete=false;assert.throws(()=>restoreBackup(b),/incomplete/);b.complete=true;
  b.tables.students.projections[0].truncated_values=1;assert.throws(()=>restoreBackup(b),/Lossy/);b.tables.students.projections[0].truncated_values=0;
  b.tables.student_qr.rows.push({student_id:'missing',space:'live',token:'test',created_at:1});assert.throws(()=>restoreBackup(b),/FOREIGN KEY/);
});
