import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readdirSync,readFileSync} from 'node:fs';
import {MealCheck} from '../lib/mealcheck.mjs';
import {directoryAccess,directorySnapshot,directoryMutation} from '../lib/shared-directory.mjs';

class Adapter {
  constructor(db){this.db=db;}
  prepare(sql){
    const statement=this.db.prepare(sql);
    const build=(args=[])=>({
      bind:(...values)=>build(values),
      execute:()=>statement.columns().length?{results:statement.all(...args),meta:{changes:0}}:
        {results:[],meta:{changes:Number(statement.run(...args).changes)}},
      async run(){return this.execute();},
      async first(){return statement.get(...args)||null;},
      async all(){return {results:statement.all(...args)};},
    });
    return build();
  }
  async batch(statements){
    this.db.exec('BEGIN IMMEDIATE');
    try{const result=statements.map(s=>s.execute());this.db.exec('COMMIT');return result;}
    catch(error){this.db.exec('ROLLBACK');throw error;}
  }
}
function fixture(t){
  const raw=new DatabaseSync(':memory:');
  t.after(()=>raw.close());
  raw.exec('PRAGMA foreign_keys=ON');
  for(const file of readdirSync('drizzle').filter(file=>file.endsWith('.sql')).sort())raw.exec(readFileSync('drizzle/'+file,'utf8'));
  return {raw,app:new MealCheck(new Adapter(raw))};
}
test('directory authentication supports live hosting and denies unrelated callers',async()=>{
  const req=new Request('http://127.0.0.1/api/v1/shared-directory',{headers:{Authorization:'Bearer qa-only-key'}});
  await assert.rejects(directoryAccess(req,{MEALCHECK_DIRECTORY_KEY:'qa-only-key'},{mode:'cloud-demo'}),/Không tìm thấy/);
  await assert.rejects(directoryAccess(req,{MEALCHECK_DIRECTORY_KEY:'another'},{mode:'local'}),/xác thực/);
  await directoryAccess(req,{MEALCHECK_DIRECTORY_KEY:'qa-only-key'},{mode:'local'});
  await directoryAccess(req,{MEALCHECK_DIRECTORY_KEY:'qa-only-key'},{mode:'cloud-live'});
});
test('shared writes retain student identity and QR, reject stale versions and recover retries',async t=>{
  const {app,raw}=fixture(t);
  await app.saveStudents('live',[{code:'001',name:'Học sinh QA',grade:'9',class:'9B'}],'qa');
  await app.saveStudents('demo',[{code:'001',name:'Demo QA',grade:'6',class:'6A'}],'qa');
  raw.prepare('INSERT INTO student_qr(student_id,space,token,created_at) VALUES (?,?,?,?)').run('live:001','live','fictional-test-card',0);
  const original=await directorySnapshot(app,'live');
  assert.equal(original.students.length,1);
  assert.equal(original.students[0].code,'001');
  assert.equal(JSON.stringify(original).includes('fictional-test-card'),false);
  const operation={action:'student.update',operationId:crypto.randomUUID(),revision:original.revision,
    id:'live:001',name:'Học sinh QA đã sửa',class_id:original.classes[0].id,active:1};
  const changed=await directoryMutation(app,'live',operation);
  assert.ok(changed.snapshot.revision>original.revision);
  assert.equal(changed.snapshot.students[0].id,'live:001');
  assert.equal((await directoryMutation(app,'live',operation)).id,'live:001');
  await assert.rejects(directoryMutation(app,'live',{...operation,operationId:crypto.randomUUID()}),/vừa thay đổi/);
  await assert.rejects(directoryMutation(app,'live',{...operation,name:'Khác'}),/đã được dùng/);
  const renamed=await directoryMutation(app,'live',{action:'class.update',id:original.classes[0].id,
    operationId:crypto.randomUUID(),revision:changed.snapshot.revision,name:'9C',grade:'9'});
  assert.equal(renamed.snapshot.classes[0].id,original.classes[0].id);
  assert.equal((await app.roster('live'))[0].class,'9C');
  assert.equal((await app.roster('demo'))[0].name,'Demo QA');
  assert.equal(raw.prepare('SELECT token FROM student_qr WHERE student_id=?').get('live:001').token,'fictional-test-card');
});
test('MealCheck roster upserts reuse the same class and advance the shared revision',async t=>{
  const {app}=fixture(t);
  await app.saveStudents('live',[{code:'001',name:'Học sinh QA',grade:'9',class:'9B'}],'qa');
  const before=await directorySnapshot(app,'live');
  await app.saveStudents('live',[
    {code:'001',name:'Học sinh QA đã sửa',grade:'9',class:'9B',active:0},
    {code:'002',name:'Học sinh QA 02',grade:'9',class:'9B'},
  ],'qa');
  const after=await directorySnapshot(app,'live');
  assert.deepEqual(after.classes,before.classes);
  assert.ok(after.revision>before.revision);
  assert.equal(after.students.find(item=>item.code==='001').name,'Học sinh QA đã sửa');
  assert.equal(after.students.find(item=>item.code==='001').active,0);
  assert.equal(after.students.length,2);
});
