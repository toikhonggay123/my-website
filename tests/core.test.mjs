import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import {MealCheck,localClock,normalize,sortNames} from '../lib/mealcheck.mjs';
import {makeXlsx,parseCsv} from '../lib/files.mjs';
import {encryptStudentToken,decryptStudentToken,studentCards,issuedStudentCards,reissueStudentCard,scanStudentCard} from '../lib/qr.mjs';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import {resetPreview,resetBackups,restoreReset} from '../lib/reset-backup.mjs';
class Adapter {
 constructor(db){this.db=db;}
 prepare(sql){const raw=this.db.prepare(sql);const build=(args=[])=>({bind:(...a)=>build(a),execute:()=>{const r=raw.run(...args);return {meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}};},async run(){return this.execute();},async first(){return raw.get(...args)||null;},async all(){return {results:raw.all(...args)};}});return build();}
 async batch(statements){this.db.exec('BEGIN IMMEDIATE');try{const r=statements.map(s=>s.execute());this.db.exec('COMMIT');return r;}catch(e){this.db.exec('ROLLBACK');throw e;}}
}
async function fixture(requireApproval=true){const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())db.exec(fs.readFileSync('drizzle/'+f,'utf8'));let now=Date.parse('2026-10-30T01:00:00Z');const app=new MealCheck(new Adapter(db),()=>now);await app.init('demo');if(requireApproval)await app.setApproval('demo',true,'admin');await app.saveStudents('demo',[{code:'001',name:'Nguyễn Văn Đạt',grade:'10',class:'10A1'},{code:'002',name:'Hoàng Thị Ánh',grade:'10',class:'10A1'}],'admin');const d=await app.enrollDevice('demo','Nhà ăn 01','admin'),d2=await app.enrollDevice('demo','Nhà ăn 02','admin');const a=await app.device(d.token),b=await app.device(d2.token);await app.control('demo','sang',true,'admin');return {app,db,a,b,setNow:t=>now=t,advance:t=>now+=t,getNow:()=>now};}
const submit=(f,device,studentId,id=crypto.randomUUID(),meal='sang')=>f.app.submit(device,studentId,id,`${device.space}:${localClock(f.getNow()).date}:${meal}`);
const checkIn=(f,device,studentId,id=crypto.randomUUID(),meal='sang')=>f.app.checkIn(device,studentId,id,`${device.space}:${localClock(f.getNow()).date}:${meal}`);
const qrEnv={MEALCHECK_QR_KEY:Buffer.alloc(32,7).toString('base64url')};
test('In lại thẻ đã cấp không cần khóa, không sinh token và lọc đúng lớp/môi trường',async()=>{
 const f=await fixture(false),issued=await studentCards(f.app,qrEnv,'demo');
 await f.app.saveStudents('demo',[{code:'003',name:'Học sinh chưa cấp thẻ',grade:'9',class:'9B'}],'test');
 const before=f.db.prepare('SELECT * FROM student_qr ORDER BY student_id').all(),again=await issuedStudentCards(f.app,'demo');
 assert.equal(again.cards.length,2);assert.equal(again.missing,1);assert.equal(again.total,3);
 assert.deepEqual(again.cards.map(c=>c.token),issued.map(c=>c.token));
 assert.equal((await issuedStudentCards(f.app,'demo',{class:'9B'})).cards.length,0);
 assert.equal((await issuedStudentCards(f.app,'live')).cards.length,0);
 assert.deepEqual(f.db.prepare('SELECT * FROM student_qr ORDER BY student_id').all(),before);
 await assert.rejects(decryptStudentToken({},again.cards[0].token),/Chưa cấu hình/);
});
test('Sao lưu reset nhất quán; phục hồi thêm lượt thiếu, giữ lượt mới và QR dù đã sang ngày',async()=>{
 const f=await fixture(false),cards=await studentCards(f.app,qrEnv,'demo');
 await checkIn(f,f.a,'demo:001');f.advance(6000);await checkIn(f,f.a,'demo:002');f.advance(6000);await checkIn(f,f.a,'demo:001',crypto.randomUUID(),'trua');
 const today=localClock(f.getNow()).date,preview=await resetPreview(f.app,'demo');assert.equal(preview.attendance,3);
 const reset=await f.app.resetToday('demo',today,'test');assert.equal(reset.removed,3);
 const backups=await resetBackups(f.app,'demo');assert.equal(backups[0].id,reset.backupId);assert.equal(backups[0].attendance,3);
 assert.equal((await f.app.queue('demo')).length,0);
 await checkIn(f,f.b,'demo:001');const newer=(await f.app.records('demo',today,today))[0];
 f.advance(86400000);await f.app.init('demo');await f.app.run('UPDATE students SET active=0 WHERE id=?','demo:002');await f.app.run('UPDATE devices SET active=0 WHERE id=?',f.a.id);
 await assert.rejects(restoreReset(f.app,'live',reset.backupId,'test'),/Không tìm thấy/);
 const recovered=await restoreReset(f.app,'demo',reset.backupId,'test');assert.equal(recovered.restored,2);assert.equal(recovered.skipped,1);
 const rows=await f.app.records('demo',today,today);assert.equal(rows.length,3);assert.equal(rows.find(r=>r.student_id==='demo:001'&&r.meal==='sang').request_id,newer.request_id);
 assert.equal(rows.find(r=>r.student_id==='demo:002').name,'Hoàng Thị Ánh');
 await assert.rejects(restoreReset(f.app,'demo',reset.backupId,'test'),/đã được khôi phục/);
 assert.equal((await resetBackups(f.app,'demo'))[0].restored,1);assert.equal(f.db.prepare('PRAGMA foreign_key_check').all().length,0);
 assert.deepEqual(f.db.prepare('SELECT token FROM student_qr ORDER BY student_id').all().map(r=>r.token),[...cards].sort((a,b)=>a.id.localeCompare(b.id)).map(r=>r.token));
});
test('Lỗi ghi bản sao hủy toàn bộ reset; yêu cầu đang chờ được giải phóng, không hồi sinh khi phục hồi',async()=>{
 const f=await fixture(false);await checkIn(f,f.a,'demo:001');const today=localClock(f.getNow()).date;
 f.db.exec("CREATE TRIGGER fail_backup BEFORE INSERT ON settings WHEN NEW.key LIKE 'reset-backup:%' BEGIN SELECT RAISE(ABORT,'backup_unavailable'); END");
 await assert.rejects(f.app.resetToday('demo',today,'test'),/backup_unavailable/);assert.equal((await f.app.records('demo',today,today)).length,1);
 f.db.exec('DROP TRIGGER fail_backup');await submit(f,f.b,'demo:002');const reset=await f.app.resetToday('demo',today,'test');
 assert.equal((await f.app.queue('demo')).length,0);assert.equal((await f.app.one('SELECT lock_until FROM devices WHERE id=?',f.a.id)).lock_until,0);
 const recovery=await restoreReset(f.app,'demo',reset.backupId,'test');assert.equal(recovery.restored,1);assert.equal((await f.app.queue('demo')).length,0);
});
test('Reset chỉ xóa hôm nay trong đúng môi trường; giữ hôm qua, QR và danh sách, cho điểm danh lại',async()=>{
 const f=await fixture(false),cards=await studentCards(f.app,qrEnv,'demo');
 await f.app.checkIn(f.a,'demo:001',crypto.randomUUID(),`demo:${localClock(f.getNow()).date}:sang`);
 f.advance(86400000);await f.app.init('demo');
 for(const meal of ['sang','trua','toi']){f.advance(6000);await f.app.checkIn(f.a,'demo:001',crypto.randomUUID(),`demo:${localClock(f.getNow()).date}:${meal}`);}
 await f.app.saveStudents('live',[{code:'L1',name:'Học sinh thử',grade:'9',class:'9B'}],'test');await f.app.init('live');
 const live=await f.app.enrollDevice('live','test','test');await f.app.checkIn(await f.app.device(live.token),'live:L1',crypto.randomUUID(),`live:${localClock(f.getNow()).date}:sang`);
 const today=localClock(f.getNow()).date,result=await f.app.resetToday('demo',today,'test');assert.equal(result.removed,3);
 assert.equal((await f.app.records('demo',today,today)).length,0);assert.equal((await f.app.records('live',today,today)).length,1);
 assert.equal(f.db.prepare("SELECT count(*) n FROM attendance WHERE space='demo'").get().n,1);
 assert.deepEqual(await studentCards(f.app,qrEnv,'demo'),cards);assert.equal((await f.app.roster('demo')).length,2);
 await f.app.checkIn(f.a,'demo:001',crypto.randomUUID(),`demo:${today}:sang`);
 await assert.rejects(f.app.resetToday('demo','2000-01-01','test'),/Ngày đã thay đổi/);
 await f.app.resetToday('live',today,'test');assert.equal(f.db.prepare('SELECT count(*) n FROM outbox').get().n,0);
 assert.ok(f.db.prepare("SELECT count(*) n FROM audit WHERE action='Đặt lại điểm danh hôm nay'").get().n===2);
});
const scan=(f,device,token,meal='sang',id=crypto.randomUUID())=>scanStudentCard(f.app,qrEnv,device,token,id,`${device.space}:${localClock(f.getNow()).date}:${meal}`,'teacher-qr');

test('QR mã hóa AES-GCM không chứa họ tên/mã, chống sửa và dùng sai khóa',async()=>{const s={id:'demo:001',space:'demo',code:'001',name:'Nguyễn Văn Đạt'},token=await encryptStudentToken(qrEnv,s);assert.ok(!token.includes(s.name)&&!token.includes(s.id));assert.deepEqual(await decryptStudentToken(qrEnv,token),{s:'demo',id:s.id});const bad=token.slice(0,20)+(token[20]==='A'?'B':'A')+token.slice(21);await assert.rejects(decryptStudentToken(qrEnv,bad),/không hợp lệ/);await assert.rejects(decryptStudentToken({MEALCHECK_QR_KEY:Buffer.alloc(32,8).toString('base64url')},token),/không hợp lệ/);await assert.rejects(encryptStudentToken({},s),/Chưa cấu hình/);});

test('Mỗi học sinh một QR ổn định, cấp lại vô hiệu thẻ cũ',async()=>{const f=await fixture(),first=await studentCards(f.app,qrEnv,'demo'),again=await studentCards(f.app,qrEnv,'demo');assert.equal(first.length,2);assert.equal(new Set(first.map(c=>c.token)).size,2);assert.deepEqual(first,again);const old=first[0],fresh=await reissueStudentCard(f.app,qrEnv,'demo',old.id,'admin');assert.notEqual(fresh.token,old.token);await assert.rejects(scan(f,f.a,old.token),/cấp lại/);assert.equal((await scan(f,f.a,fresh.token)).status,'recorded');});

test('Phát hành hơn 1.000 QR theo lô và giữ mã ổn định khi tải lại',async()=>{const f=await fixture();await f.app.seed('admin');const cards=await studentCards(f.app,qrEnv,'demo');assert.equal(cards.length,1002);assert.equal(new Set(cards.map(c=>c.token)).size,1002);assert.equal((await studentCards(f.app,qrEnv,'demo'))[500].token,cards[500].token);});

test('Giáo viên quét QR tự điểm danh dù đang bật chờ duyệt; quét lại không thêm suất',async()=>{const f=await fixture(),[card]=await studentCards(f.app,qrEnv,'demo');const r=await scan(f,f.a,card.token);assert.equal(r.student.name,card.name);assert.equal(r.teacher,'teacher-qr');assert.equal(r.status,'recorded');assert.equal((await f.app.queue('demo')).length,0);assert.equal((await scan(f,f.b,card.token)).duplicate,true);assert.equal(f.db.prepare('SELECT count(*) n FROM attendance').get().n,1);});

test('QR lưu ngay hai học sinh liên tiếp cùng thời điểm, bỏ cả khóa chờ cũ và không tăng suất khi quét lại',async()=>{const f=await fixture(),cards=await studentCards(f.app,qrEnv,'demo');await f.app.run('UPDATE devices SET lock_until=? WHERE id=?',f.getNow()+60000,f.a.id);assert.equal((await scan(f,f.a,cards[0].token)).status,'recorded');assert.equal((await scan(f,f.a,cards[1].token)).status,'recorded');assert.equal((await f.app.one('SELECT lock_until FROM devices WHERE id=?',f.a.id)).lock_until,0);assert.equal((await f.app.records('demo',localClock(f.getNow()).date,localClock(f.getNow()).date)).length,2);assert.equal((await scan(f,f.a,cards[0].token)).duplicate,true);assert.equal(f.db.prepare('SELECT count(*) n FROM attendance').get().n,2);});

test('QR đồng thời hai máy vẫn chỉ ghi một suất; từng bữa được tách riêng',async()=>{const f=await fixture(),[card]=await studentCards(f.app,qrEnv,'demo');const r=await Promise.all([scan(f,f.a,card.token),scan(f,f.b,card.token)]);assert.equal(r.length,2);assert.equal(f.db.prepare('SELECT count(*) n FROM attendance').get().n,1);f.advance(5000);await scan(f,f.b,card.token,'trua');assert.equal(f.db.prepare('SELECT count(*) n FROM attendance').get().n,2);});

test('QR xử lý được yêu cầu học sinh đang chờ và ghi đúng giáo viên',async()=>{const f=await fixture(),[card]=await studentCards(f.app,qrEnv,'demo');await submit(f,f.a,card.id);await scan(f,f.b,card.token);assert.equal(f.db.prepare('SELECT count(*) n FROM requests').get().n,1);assert.equal(f.db.prepare('SELECT teacher FROM attendance').get().teacher,'teacher-qr');});

test('QR chặn sai môi trường, sai ngày, học sinh khóa và máy quét thu hồi',async()=>{const f=await fixture(),[card]=await studentCards(f.app,qrEnv,'demo');await assert.rejects(scanStudentCard(f.app,qrEnv,f.a,card.token,crypto.randomUUID(),'demo:2026-10-29:sang','teacher'),/ngày hiện tại/);const wrong=await encryptStudentToken(qrEnv,{id:card.id,space:'live'});await assert.rejects(scan(f,f.a,wrong),/môi trường/);await f.app.run('UPDATE students SET active=0 WHERE id=?',card.id);await assert.rejects(scan(f,f.a,card.token),/vô hiệu hóa/);await f.app.run('UPDATE students SET active=1 WHERE id=?',card.id);await f.app.run('UPDATE devices SET active=0 WHERE id=?',f.a.id);await assert.rejects(scan(f,f.a,card.token),/thu hồi/);assert.equal(f.db.prepare('SELECT count(*) n FROM attendance').get().n,0);});

test('QR hình ảnh được bộ giải mã camera đọc đúng chuỗi mã hóa',async()=>{const token=await encryptStudentToken(qrEnv,{id:'live:1800186862',space:'live'}),qr=QRCode.create(token,{errorCorrectionLevel:'M'}),scale=6,padding=4,width=(qr.modules.size+padding*2)*scale,pixels=new Uint8ClampedArray(width*width*4).fill(255);for(let y=0;y<width;y++)for(let x=0;x<width;x++){const row=Math.floor(y/scale)-padding,col=Math.floor(x/scale)-padding;if(row>=0&&col>=0&&row<qr.modules.size&&col<qr.modules.size&&qr.modules.get(row,col)){const i=(y*width+x)*4;pixels[i]=pixels[i+1]=pixels[i+2]=0;}}assert.equal(jsQR(pixels,width,width)?.data,token);});

test('Mặc định tự điểm danh ngay, không vào hàng đợi và vẫn khóa 5 giây',async()=>{const f=await fixture(false);assert.equal(await f.app.approvalRequired('demo'),false);const r=await checkIn(f,f.a,'demo:001');assert.equal(r.status,'approved');assert.equal(r.actor,'Học sinh tự điểm danh');assert.equal(f.db.prepare('SELECT count(*) n FROM attendance').get().n,1);assert.equal((await f.app.queue('demo')).length,0);assert.equal((await f.app.kiosk(f.a)).device.lock_until,f.getNow()+5000);assert.equal((await f.app.kiosk(f.b)).device.lock_until,0);await assert.rejects(checkIn(f,f.b,'demo:001'),/Đã điểm danh/);});

test('Tự điểm danh: gửi lại cùng mã đồng thời chỉ tạo một lượt và một nhật ký',async()=>{const f=await fixture(false),id=crypto.randomUUID();const results=await Promise.all(Array.from({length:10},()=>checkIn(f,f.a,'demo:001',id)));assert.ok(results.every(r=>r.status==='approved'));assert.equal(f.db.prepare('SELECT count(*) n FROM attendance').get().n,1);assert.equal(f.db.prepare("SELECT count(*) n FROM audit WHERE action='approved'").get().n,1);const lock=(await f.app.kiosk(f.a)).device.lock_until;f.advance(1000);await checkIn(f,f.a,'demo:001',id);assert.equal((await f.app.kiosk(f.a)).device.lock_until,lock);});

test('Bật lại duyệt giữ yêu cầu chờ; tắt duyệt giải phóng màn hình đang chờ',async()=>{const f=await fixture(false);await f.app.setApproval('demo',true,'admin');const r=await checkIn(f,f.a,'demo:001');assert.equal(r.status,'pending');assert.equal((await f.app.kiosk(f.a)).request.status,'pending');assert.equal(f.db.prepare('SELECT count(*) n FROM attendance').get().n,0);await f.app.setApproval('demo',false,'admin');const state=await f.app.kiosk(f.a,'sang');assert.equal(state.request.status,'approved');assert.ok(state.confirmed.includes('demo:001'));assert.equal(f.db.prepare('SELECT count(*) n FROM attendance').get().n,1);});

test('Tự điểm danh vẫn chặn thiết bị bị thu hồi, học sinh bị khóa và sai ngày',async()=>{for(const kind of ['device','student','date']){const f=await fixture(false),r=await submit(f,f.a,'demo:001');if(kind==='device')await f.app.run('UPDATE devices SET active=0 WHERE id=?',f.a.id);if(kind==='student')await f.app.run("UPDATE students SET active=0 WHERE id='demo:001'");if(kind==='date')f.advance(86400000);await assert.rejects(f.app.autoConfirm(f.a,r),/session_no_longer_active/);assert.equal(f.db.prepare('SELECT count(*) n FROM attendance').get().n,0);}});

test('Tự điểm danh lưu outbox chính thức và ghi rõ người thực hiện',async()=>{const f=await fixture(false);await f.app.init('live');await f.app.saveStudents('live',[{code:'AUTO',name:'Học sinh kiểm thử',grade:'9',class:'9B'}],'admin');const d=await f.app.enrollDevice('live','Test','admin'),device=await f.app.device(d.token);await checkIn(f,device,'live:AUTO');assert.equal(f.db.prepare('SELECT count(*) n FROM outbox').get().n,1);assert.equal(f.db.prepare('SELECT teacher FROM attendance').get().teacher,'Học sinh tự điểm danh');await assert.rejects(f.app.setApproval('live','false','admin'),/không hợp lệ/);});
test('Múi giờ Việt Nam và chuyển ngày',()=>{assert.deepEqual(localClock(Date.parse('2026-10-30T17:01:00Z')),{date:'2026-10-31',time:'00:01'});});
test('Tìm tiếng Việt và sắp xếp theo tên gọi',()=>{assert.equal(normalize('Đặng Thị Ánh'),'dang thi anh');assert.deepEqual(sortNames([{name:'Nguyễn Văn Đạt'},{name:'Hoàng Thị Ánh'}]).map(r=>r.name),['Hoàng Thị Ánh','Nguyễn Văn Đạt']);});
test('Ba bữa mở cả ngày, không cần giờ hoặc mở thủ công',async()=>{const f=await fixture();await f.app.control('demo','sang',false,'admin');for(const t of ['00:01','12:34','23:59']){f.setNow(Date.parse('2026-10-30T'+t+':00+07:00'));const state=await f.app.sessionState('demo');assert.equal(state.alwaysOpen,true);assert.equal(state.sessions.filter(s=>s.open).length,3);assert.equal(state.conflict,false);}const r=await submit(f,f.a,'demo:001',crypto.randomUUID(),'toi');await f.app.decide('demo',r.id,true,'teacher');assert.equal(f.db.prepare('SELECT count(*) n FROM attendance').get().n,1);});

test('Chờ duyệt chưa tạo suất ăn và không khóa 5 giây',async()=>{const f=await fixture();await submit(f,f.a,'demo:001',crypto.randomUUID());assert.equal(f.db.prepare('SELECT count(*) n FROM attendance').get().n,0);assert.equal((await f.app.kiosk(f.a)).device.lock_until,0);});
test('Giáo viên duyệt tạo một suất, không thể duyệt lại',async()=>{const f=await fixture(),r=await submit(f,f.a,'demo:001',crypto.randomUUID());await f.app.decide('demo',r.id,true,'teacher');assert.equal(f.db.prepare('SELECT count(*) n FROM attendance').get().n,1);await assert.rejects(f.app.decide('demo',r.id,true,'teacher'),/đã được xử lý/);});
test('Từ chối không ghi nhận và khóa riêng thiết bị 5 giây',async()=>{const f=await fixture(),r=await submit(f,f.a,'demo:001',crypto.randomUUID());await f.app.decide('demo',r.id,false,'teacher');assert.equal(f.db.prepare('SELECT count(*) n FROM attendance').get().n,0);assert.equal((await f.app.kiosk(f.a)).device.lock_until,f.getNow()+5000);assert.equal((await f.app.kiosk(f.b)).device.lock_until,0);await assert.rejects(submit(f,f.a,'demo:002',crypto.randomUUID()),/đang khóa/);f.advance(5000);assert.equal((await submit(f,f.a,'demo:002',crypto.randomUUID())).status,'pending');});
test('Chặn bấm liên tục bằng mã idempotency',async()=>{const f=await fixture(),id=crypto.randomUUID();const r=await Promise.all(Array.from({length:20},()=>submit(f,f.a,'demo:001',id)));assert.equal(new Set(r.map(x=>x.id)).size,1);assert.equal(f.db.prepare('SELECT count(*) n FROM requests').get().n,1);});
test('Hai thiết bị gửi đồng thời cho cùng học sinh: một yêu cầu',async()=>{const f=await fixture();const r=await Promise.allSettled([submit(f,f.a,'demo:001',crypto.randomUUID()),submit(f,f.b,'demo:001',crypto.randomUUID())]);assert.equal(r.filter(x=>x.status==='fulfilled').length,1);});
test('Mỗi thiết bị chỉ có một yêu cầu chờ',async()=>{const f=await fixture();await submit(f,f.a,'demo:001',crypto.randomUUID());await assert.rejects(submit(f,f.a,'demo:002',crypto.randomUUID()),/chờ duyệt/);});
test('Một học sinh đủ ba bữa, mỗi bữa chỉ một lần',async()=>{const f=await fixture();for(const meal of ['sang','trua','toi']){const r=await submit(f,f.a,'demo:001',crypto.randomUUID(),meal);await f.app.decide('demo',r.id,true,'teacher');f.advance(5000);await assert.rejects(submit(f,f.b,'demo:001',crypto.randomUUID(),meal),/Đã điểm danh/);}const b=await f.app.dashboard('demo');for(const m of ['sang','trua','toi']){assert.equal(b.meals[m].count,1);assert.equal(b.meals[m].missing,1);}assert.equal(f.db.prepare('SELECT count(*) n FROM attendance').get().n,3);});

test('Chuyển ngày: yêu cầu cũ hết hạn, ngày mới điểm danh lại',async()=>{const f=await fixture();const r=await submit(f,f.a,'demo:001',crypto.randomUUID());f.setNow(Date.parse('2026-10-30T17:01:00Z'));await f.app.init('demo');assert.equal((await f.app.one('SELECT status FROM requests WHERE id=?',r.id)).status,'expired');await f.app.control('demo','sang',true,'admin');f.advance(5000);assert.equal((await submit(f,f.a,'demo:001',crypto.randomUUID())).status,'pending');});
test('Lựa chọn bữa trên thiết bị khác không đổi bữa của yêu cầu đã gửi',async()=>{const f=await fixture(),r=await submit(f,f.a,'demo:001');await f.app.control('demo','trua',true,'admin');await f.app.decide('demo',r.id,true,'teacher');assert.equal((await f.app.records('demo','2026-10-30','2026-10-30'))[0].meal,'sang');});

test('Thời gian khóa tùy chỉnh và giờ không chồng lấn',async()=>{const f=await fixture();const rows=['sang','trua','toi'].map(meal=>({meal,enabled:false}));await f.app.setSchedule('demo',rows,9,'admin');assert.equal(await f.app.lockMs('demo'),9000);await assert.rejects(f.app.setSchedule('demo',rows.map(r=>({...r,enabled:true,start:'07:00',end:'09:00'})),5,'admin'),/chồng lấn/);});
test('Dữ liệu demo tuyệt đối không có outbox Google Sheets',async()=>{const f=await fixture(),r=await submit(f,f.a,'demo:001',crypto.randomUUID());await f.app.decide('demo',r.id,true,'teacher');assert.equal(f.db.prepare('SELECT count(*) n FROM outbox').get().n,0);});
test('Ràng buộc cơ sở dữ liệu ngăn ghi trùng trực tiếp',async()=>{const f=await fixture(),r=await submit(f,f.a,'demo:001',crypto.randomUUID());await f.app.decide('demo',r.id,true,'teacher');assert.throws(()=>f.db.prepare('INSERT INTO attendance(request_id,space,student_id,session_id,code,name,grade,class,confirmed_at,teacher) SELECT request_id,space,student_id,session_id,code,name,grade,class,confirmed_at,teacher FROM attendance').run(),/UNIQUE/);});
test('1000 học sinh, tìm kiếm và thống kê nhanh',async t=>{const f=await fixture(),start=performance.now();await f.app.seed('admin');const r=await f.app.roster('demo');assert.equal(r.length,1002);assert.equal(new Set(r.map(s=>s.code)).size,1002);assert.ok((await f.app.roster('demo',{q:'hoang thi anh'})).length>0);assert.equal((await f.app.dashboard('demo')).total,1002);t.diagnostic(`Nhập + đọc + tổng hợp 1.000 học sinh: ${Math.round(performance.now()-start)} ms`);});
test('Danh sách mã trùng bị chặn trước khi nhập',async()=>{const f=await fixture();await assert.rejects(f.app.saveStudents('demo',[{code:'x',name:'A',grade:'7',class:'7A'},{code:'x',name:'B',grade:'7',class:'7A'}],'admin'),/Mã học sinh trùng/);assert.equal((await f.app.roster('demo')).length,2);});
test('CSV tiếng Việt, trường có dấu phẩy, xuất XLSX thật',()=>{assert.deepEqual(parseCsv('\uFEFFMã học sinh,Họ tên\r\n001,"Hoàng, Ánh"'),[['Mã học sinh','Họ tên'],['001','Hoàng, Ánh']]);const x=makeXlsx([['Họ tên'],['Nguyễn Văn Đạt']]);assert.equal(new DataView(x.buffer).getUint32(0,true),0x04034b50);});
test('Không tự chọn bữa, không gửi bữa của ngày cũ',async()=>{const f=await fixture();await assert.rejects(f.app.submit(f.a,'demo:001',crypto.randomUUID()),/chọn đúng bữa/);await assert.rejects(f.app.submit(f.a,'demo:001',crypto.randomUUID(),'demo:2026-10-29:sang'),/chọn đúng bữa/);assert.equal(f.db.prepare('SELECT count(*) n FROM requests').get().n,0);});

test('Thu hồi thiết bị không cho duyệt yêu cầu đang chờ',async()=>{const f=await fixture(),r=await submit(f,f.a,'demo:001',crypto.randomUUID());await f.app.run('UPDATE devices SET active=0 WHERE id=?',f.a.id);await assert.rejects(f.app.decide('demo',r.id,true,'teacher'),/session_no_longer_active/);assert.equal(f.db.prepare('SELECT count(*) n FROM attendance').get().n,0);});
test('Hai bữa đồng thời vẫn giữ bản ghi và giáo viên xác nhận độc lập',async()=>{const f=await fixture(),a=await submit(f,f.a,'demo:001',crypto.randomUUID(),'sang'),b=await submit(f,f.b,'demo:001',crypto.randomUUID(),'trua');await f.app.decide('demo',a.id,true,'teacher-a');await f.app.decide('demo',b.id,true,'teacher-b');const board=await f.app.dashboard('demo');assert.equal(board.meals.sang.count,1);assert.equal(board.meals.trua.count,1);assert.equal(board.meals.toi.count,0);});
