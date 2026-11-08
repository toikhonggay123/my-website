import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import {MealCheck,localClock} from '../lib/mealcheck.mjs';
import {resetBackups,restoreReset} from '../lib/reset-backup.mjs';

// SQLite adapter that counts statements which can change data.
class Adapter {
 constructor(db){this.db=db;this.writes=[];}
 track(sql){if(!/^\s*SELECT/i.test(sql))this.writes.push(sql.trim().split(/\s+/).slice(0,3).join(' '));}
 prepare(sql){const raw=this.db.prepare(sql),track=()=>this.track(sql);const build=(args=[])=>({bind:(...a)=>build(a),execute:()=>{track();const r=raw.run(...args);return {meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}};},async run(){return this.execute();},async first(){return raw.get(...args)||null;},async all(){return {results:raw.all(...args)};}});return build();}
 async batch(statements){this.db.exec('BEGIN IMMEDIATE');try{const r=statements.map(s=>s.execute());this.db.exec('COMMIT');return r;}catch(e){this.db.exec('ROLLBACK');throw e;}}
}
function fixture(){
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');
 for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())db.exec(fs.readFileSync('drizzle/'+f,'utf8'));
 let now=Date.parse('2026-10-30T01:00:00Z');const adapter=new Adapter(db);
 return {db,adapter,app:new MealCheck(adapter,()=>now),setNow:t=>now=t,advance:t=>now+=t,getNow:()=>now};
}

test('board and records polling write nothing after the first day setup',async()=>{
 const f=fixture();await f.app.saveStudents('demo',[{code:'001',name:'Nguyễn Văn Đạt',grade:'10',class:'10A1'}],'admin');
 await f.app.dashboard('demo');
 const sessions=f.db.prepare("SELECT id FROM meal_sessions WHERE space='demo'").all().map(r=>r.id);
 assert.deepEqual(sessions.sort(),['demo:2026-10-30:sang','demo:2026-10-30:toi','demo:2026-10-30:trua']);
 f.adapter.writes.length=0;
 for(let i=0;i<5;i++){f.advance(10000);await f.app.init('demo');await f.app.dashboard('demo');await f.app.sessionState('demo');await f.app.records('demo','2026-10-30','2026-10-30');}
 assert.deepEqual(f.adapter.writes,[]);
});

test('a new local date, another space or another database runs setup again',async()=>{
 const f=fixture();await f.app.init('demo');f.adapter.writes.length=0;
 await f.app.init('live');assert.ok(f.adapter.writes.length>0,'live space has its own setup');
 f.adapter.writes.length=0;
 // 17:01 UTC is 00:01 the next day in Asia/Ho_Chi_Minh.
 f.setNow(Date.parse('2026-10-30T17:01:00Z'));assert.equal(localClock(f.getNow()).date,'2026-10-31');
 await f.app.sessionState('demo');assert.ok(f.adapter.writes.length>0);
 assert.ok(f.db.prepare("SELECT 1 FROM meal_sessions WHERE id='demo:2026-10-31:sang'").get());
 const other=fixture();await other.app.init('demo');
 assert.ok(other.db.prepare("SELECT 1 FROM meal_sessions WHERE id='demo:2026-10-30:sang'").get(),'separate database is not skipped');
});

test('instances sharing an explicit scope share the memo; a failed setup is retried',async()=>{
 const f=fixture(),scope={};
 await new MealCheck(f.adapter,f.getNow,{initScope:scope}).init('demo');f.adapter.writes.length=0;
 await new MealCheck(f.adapter,f.getNow,{initScope:scope}).init('demo');assert.deepEqual(f.adapter.writes,[]);
 const g=fixture(),batch=g.adapter.batch.bind(g.adapter);let fail=true;
 g.adapter.batch=async s=>{if(fail){fail=false;throw Error('D1 busy');}return batch(s);};
 await assert.rejects(g.app.init('demo'),/D1 busy/);
 await g.app.init('demo');assert.ok(g.db.prepare("SELECT 1 FROM meal_sessions WHERE id='demo:2026-10-30:sang'").get());
 await assert.rejects(g.app.init('other'),/không hợp lệ/);
});

test('pending requests from an earlier day still expire on the first request of a new day',async()=>{
 const f=fixture();await f.app.init('demo');
 await f.app.saveStudents('demo',[{code:'001',name:'Nguyễn Văn Đạt',grade:'10',class:'10A1'}],'admin');
 await f.app.setApproval('demo',true,'admin');
 const device=await f.app.device((await f.app.enrollDevice('demo','Nhà ăn 01','admin')).token);
 const r=await f.app.submit(device,'demo:001',crypto.randomUUID(),'demo:2026-10-30:sang');
 await f.app.dashboard('demo');assert.equal((await f.app.one('SELECT status FROM requests WHERE id=?',r.id)).status,'pending');
 f.setNow(Date.parse('2026-10-30T17:01:00Z'));await f.app.dashboard('demo');
 assert.equal((await f.app.one('SELECT status FROM requests WHERE id=?',r.id)).status,'expired');
});

test('reset and restore clear the memo so the next request repeats the idempotent setup',async()=>{
 const f=fixture();await f.app.init('demo');
 const today=localClock(f.getNow()).date,reset=await f.app.resetToday('demo',today,'test');
 f.adapter.writes.length=0;await f.app.init('demo');assert.ok(f.adapter.writes.length>0);
 f.adapter.writes.length=0;await f.app.init('demo');assert.deepEqual(f.adapter.writes,[]);
 assert.equal((await resetBackups(f.app,'demo'))[0].id,reset.backupId);
 await restoreReset(f.app,'demo',reset.backupId,'test');
 f.adapter.writes.length=0;await f.app.init('demo');assert.ok(f.adapter.writes.length>0);
});
