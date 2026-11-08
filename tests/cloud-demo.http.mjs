import assert from 'node:assert/strict';
import fs from 'node:fs';
import {read,utils} from 'xlsx';
import {makeDailyXls} from '../lib/daily-report.mjs';
const config=JSON.parse(fs.readFileSync('wrangler.demo.jsonc','utf8'));
const base=process.env.TEST_DEMO_URL;
if(!base||new URL(base).origin!==base||new URL(base).protocol!=='https:'||new URL(base).hostname!==config.vars.MEALCHECK_PUBLIC_HOST)throw Error('Set TEST_DEMO_URL to the exact configured HTTPS demo origin');
async function call(path,body,cookie='',status=200,origin=base){
  const response=await fetch(base+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{Cookie:cookie,...(body===undefined?{}:{Origin:origin,'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
  assert.equal(response.status,status,path+' HTTP status');
  return {data:await response.json(),cookie:response.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ')};
}
// No write is allowed until the deployed server confirms synthetic-only mode.
const health=(await call('health')).data;
assert.equal(health.deployment,'cloud-demo');assert.equal(health.demoOnly,true);assert.equal(health.disposableTestDatabase,false);
const identity=(await call('identity')).data;assert.equal(identity.publicDemo,true);assert.equal(identity.defaultSpace,'demo');assert.equal(identity.localAdmin,false);
await call('board?space=live',undefined,'',403);
await call('students?space=live',undefined,'',403);
await call('qa/browser-reset',undefined,'',404);
await call('students?space=demo',{rows:[]},'',403);
await call('device/start',{space:'live'},'',404);
await call('seed?space=demo',{},'',403,'https://wrong.example.test');
await call('seed?space=demo',{});
const students=(await call('students?space=demo')).data;
assert.equal(students.length,1000);assert.ok(students.every(s=>/^TEST\d{4}$/.test(s.code)&&s.id==='demo:'+s.code));
const board=(await call('board?space=demo')).data;assert.equal(board.total,1000);assert.equal(board.alwaysOpen,true);
assert.equal((await call('qr/config?space=demo')).data.configured,true);
const cards=(await call('qr/cards?space=demo',{class:'6A1'})).data.cards;assert.equal(cards.length,40);
assert.equal((await call('qr/cards/issued?space=demo',{class:'6A1'})).data.cards.length,40);
const scanner=(await call('qr/scanner/start?space=demo',{})).cookie,sessionId=`demo:${board.date}:sang`;
for(const card of cards.slice(0,2))assert.ok(['recorded','already'].includes((await call('qr/scan?space=demo',{token:card.token,id:crypto.randomUUID(),sessionId},scanner)).data.status));
const before=(await call('records?space=demo')).data.length;
assert.equal((await call('qr/scan?space=demo',{token:cards[0].token,id:crypto.randomUUID(),sessionId},scanner)).data.status,'already');
assert.equal((await call('records?space=demo')).data.length,before);
await call('qr/scan?space=demo',{token:'tampered',id:crypto.randomUUID(),sessionId},scanner,400);
const reset=(await call('attendance/reset-today?space=demo',{confirmDate:board.date})).data;
assert.ok(reset.removed>=2);assert.equal((await call('records?space=demo')).data.length,0);
const restored=(await call('attendance/restore-reset?space=demo',{backupId:reset.backupId})).data;
assert.equal(restored.restored,before);assert.equal((await call('records?space=demo')).data.length,before);
const xls=await fetch(base+'/api/export/today?space=demo',{redirect:'manual'});assert.equal(xls.status,303);assert.equal(xls.headers.get('location'),'/xuat-excel');
const daily=(await call('daily/today?space=demo&date=2000-01-01')).data;assert.equal(daily.date,board.date);
// The browser uses this exact workbook generator; CPU-heavy BIFF8 work stays off the free Worker.
const bytes=makeDailyXls(daily);assert.equal(Buffer.from(bytes.slice(0,8)).toString('hex'),'d0cf11e0a1b11ae1');
const workbook=read(bytes,{type:'array'});assert.ok(workbook.SheetNames.includes('Lớp 6A1'));assert.equal(utils.sheet_to_json(workbook.Sheets['Buổi sáng'],{header:1}).length,1007);
for(const path of ['/','/diem-danh']){const response=await fetch(base+path,{redirect:'manual'});assert.equal(response.status,307);assert.equal(response.headers.get('location'),'/quan-tri');}
console.log(JSON.stringify({cloudDemo:'passed',syntheticStudents:students.length,attendance:before,resetRestore:true,xls:true,liveBlocked:true,rosterUploadsBlocked:true}));
