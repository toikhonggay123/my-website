import {AppError,localClock} from './mealcheck.mjs';
const PREFIX='AFYLLX:1:', aad=new TextEncoder().encode('AFYLLX MealCheck student QR v1');
const b64=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const unb64=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
async function keyFor(env){
  if(!/^[A-Za-z0-9_-]{43}$/.test(env.MEALCHECK_QR_KEY||''))throw new AppError('Chưa cấu hình khóa mã hóa QR của nhà trường.',503);
  return crypto.subtle.importKey('raw',unb64(env.MEALCHECK_QR_KEY),{name:'AES-GCM'},false,['encrypt','decrypt']);
}
export async function encryptStudentToken(env,student){
  const key=await keyFor(env),iv=crypto.getRandomValues(new Uint8Array(12));
  const data=new TextEncoder().encode(JSON.stringify({s:student.space,id:student.id}));
  const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad},key,data));
  return PREFIX+b64(new Uint8Array([...iv,...encrypted]));
}
export async function decryptStudentToken(env,token){
  const key=await keyFor(env);
  try{
    if(typeof token!=='string'||!token.startsWith(PREFIX)||token.length>600||!/^[-\w]+$/.test(token.slice(PREFIX.length)))throw Error('format');
    const bytes=unb64(token.slice(PREFIX.length));if(bytes.length<29)throw Error('length');
    const clear=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.slice(0,12),additionalData:aad},key,bytes.slice(12));
    const data=JSON.parse(new TextDecoder().decode(clear));
    if(!['live','demo'].includes(data.s)||typeof data.id!=='string'||!data.id||data.id.length>200)throw Error('payload');
    return data;
  }catch{throw new AppError('QR không hợp lệ hoặc không thuộc nhà trường.',400);}
}
export async function studentCards(app,env,space,filter={}){
  await keyFor(env);
  const students=await app.roster(space,filter),existing=new Map((await app.all('SELECT student_id,token FROM student_qr WHERE space=?',space)).map(r=>[r.student_id,r.token])),missing=[];
  for(const s of students){
    if(!existing.has(s.id))missing.push({id:s.id,token:await encryptStudentToken(env,{...s,space})});
  }
  const statements=[];
  // 25 rows × 4 parameters stays within D1's 100-variable limit.
  for(let i=0;i<missing.length;i+=25){const rows=missing.slice(i,i+25);statements.push(app.q('INSERT OR IGNORE INTO student_qr(student_id,space,token,created_at) VALUES '+rows.map(()=>'(?,?,?,?)').join(','),...rows.flatMap(r=>[r.id,space,r.token,app.now()])));}
  for(let i=0;i<statements.length;i+=50)await app.db.batch(statements.slice(i,i+50));
  const issued=new Map((await app.all('SELECT student_id,token FROM student_qr WHERE space=?',space)).map(r=>[r.student_id,r.token]));
  return students.map(s=>({...s,token:issued.get(s.id)}));
}
// Display/reprint issued ciphertext verbatim; no key generation or decryption is needed.
export async function issuedStudentCards(app,space,filter={}){
 const students=await app.roster(space,filter),issued=new Map((await app.all('SELECT student_id,token FROM student_qr WHERE space=?',space)).map(r=>[r.student_id,r.token]));
 return {cards:students.filter(s=>issued.has(s.id)).map(s=>({...s,token:issued.get(s.id)})),missing:students.filter(s=>!issued.has(s.id)).length,total:students.length};
}
export async function reissueStudentCard(app,env,space,id,actor){
  const s=await app.one('SELECT * FROM students WHERE id=? AND space=? AND active=1',id,space);if(!s)throw new AppError('Không tìm thấy học sinh đang hoạt động.',404);
  const token=await encryptStudentToken(env,s);
  await app.run('INSERT INTO student_qr(student_id,space,token,created_at) VALUES(?,?,?,?) ON CONFLICT(student_id) DO UPDATE SET token=excluded.token,created_at=excluded.created_at',s.id,space,token,app.now());
  await app.log(space,actor,'Cấp lại QR học sinh',s.code);return {...s,token};
}
export async function scanStudentCard(app,env,device,token,requestId,sessionId,actor){
  const scanner=await app.one('SELECT id FROM devices WHERE id=? AND space=? AND active=1',device.id,device.space);
  if(!scanner)throw new AppError('Thiết bị quét đã bị thu hồi.',403);
  const data=await decryptStudentToken(env,token);
  if(data.s!==device.space)throw new AppError('QR không thuộc môi trường dữ liệu đang chọn.',400);
  const row=await app.one('SELECT s.id,s.code,s.name,s.grade,s.class,s.active,q.token FROM students s JOIN student_qr q ON q.student_id=s.id AND q.space=s.space WHERE s.id=? AND s.space=?',data.id,device.space);
  if(row?.token!==token)throw new AppError('QR đã được cấp lại hoặc chưa được phát hành. Vui lòng lấy thẻ mới.',400);
  const {token:privateToken,...student}=row;
  if(!student?.active)throw new AppError('Học sinh đã bị vô hiệu hóa hoặc không còn trong danh sách.',409);
  const date=localClock(app.now()).date,session=await app.one('SELECT id,meal,date FROM meal_sessions WHERE id=? AND space=? AND date=?',sessionId,device.space,date);
  if(!session)throw new AppError('Chọn bữa ăn của ngày hiện tại trước khi quét.',409);
  const current=()=>app.one('SELECT confirmed_at,teacher FROM attendance WHERE student_id=? AND session_id=?',student.id,session.id);
  const result=(record,duplicate)=>({student,meal:session.meal,date:session.date,confirmedAt:record.confirmed_at,teacher:record.teacher,duplicate,status:duplicate?'already':'recorded'});
  const existing=await current();if(existing)return result(existing,true);
  if(!/^[a-zA-Z0-9-]{16,80}$/.test(requestId||''))throw new AppError('Mã lần quét không hợp lệ.');
  try{
    // A teacher scanning a student's card is the confirmation, including an older pending pupil request.
    const pending=await app.one("SELECT id FROM requests WHERE student_id=? AND session_id=? AND status='pending'",student.id,session.id),id=pending?.id||requestId,now=app.now();
    const statements=[];
    if(!pending)statements.push(app.q(`INSERT INTO requests(id,space,student_id,session_id,device_id,created_at)
      SELECT ?,?,?,?,?,? FROM devices d JOIN students s ON s.id=? JOIN meal_sessions m ON m.id=?
      WHERE d.id=? AND d.space=? AND d.active=1 AND s.space=d.space AND s.active=1
      AND m.space=d.space AND m.date=? AND NOT EXISTS(SELECT 1 FROM attendance WHERE student_id=s.id AND session_id=m.id)`,id,device.space,student.id,session.id,device.id,now,student.id,session.id,device.id,device.space,date));
    statements.push(app.q("UPDATE requests SET status='approved',processed_at=?,actor=?,reason='Giáo viên quét QR xác nhận',lock_until=? WHERE id=? AND student_id=? AND session_id=? AND status='pending'",now,actor,0,id,student.id,session.id));
    // Keep insertion, approval, immutable attendance, audit and outbox in one D1 transaction.
    statements.push(app.q('UPDATE devices SET lock_until=0 WHERE id=?',device.id));
    await app.db.batch(statements);
    const record=await current();if(!record)throw new AppError('Chưa ghi nhận được điểm danh. Vui lòng quét lại.',409);
    return result(record,false);
  }catch(error){const record=await current();if(record)return result(record,true);throw error;}
}
