import {AppError,localClock} from './mealcheck.mjs';

const attendanceColumns=['seq','request_id','space','student_id','session_id','code','name','grade','class','confirmed_at','teacher'];
const requestColumns=['id','space','student_id','session_id','device_id','status','created_at','processed_at','actor','reason','lock_until'];
const outboxColumns=['id','attendance_seq','status','attempts','next_at','error'];
const object=columns=>`json_object(${columns.map(c=>`'${c}',${c}`).join(',')})`;
const sessions='SELECT id FROM meal_sessions WHERE space=? AND date=?';
const backupKey=(space,id)=>{if(!['live','demo'].includes(space)||!/^\d{13}-[a-f0-9-]{36}$/.test(id||''))throw new AppError('Bản sao không hợp lệ.');return `reset-backup:${space}:${id}`;};

export async function resetPreview(app,space){
 const date=localClock(app.now()).date;
 const row=await app.one(`SELECT count(*) attendance,(SELECT count(*) FROM requests WHERE space=? AND session_id IN (${sessions})) requests FROM attendance WHERE space=? AND session_id IN (${sessions})`,space,space,date,space,space,date);
 return {date,...row};
}
export async function resetWithBackup(app,space,confirmedDate,actor){
 if(!['live','demo'].includes(space))throw new AppError('Môi trường không hợp lệ.');
 const now=app.now(),date=localClock(now).date,id=now+'-'+crypto.randomUUID(),key=backupKey(space,id);
 if(confirmedDate!==date)throw new AppError('Ngày đã thay đổi. Vui lòng tải lại và xác nhận đặt lại hôm nay.',409);
 // Snapshot and deletion share one transaction. Failure to save the snapshot rolls everything back.
 const results=await app.db.batch([
  app.q(`INSERT INTO settings(key,value) SELECT ?,json_object('version',1,'space',?,'date',?,'at',?,'actor',?,
   'attendance',(SELECT json_group_array(${object(attendanceColumns)}) FROM attendance WHERE space=? AND session_id IN (${sessions})),
   'requests',(SELECT json_group_array(${object(requestColumns)}) FROM requests WHERE space=? AND session_id IN (${sessions})),
   'outbox',(SELECT json_group_array(${object(outboxColumns)}) FROM outbox WHERE attendance_seq IN (SELECT seq FROM attendance WHERE space=? AND session_id IN (${sessions}))))`,key,space,date,now,actor,space,space,date,space,space,date,space,space,date),
  app.q(`INSERT INTO audit(space,at,actor,action,result) SELECT ?,?,?,?,?||count(*)||' lượt · bản sao '||? FROM attendance WHERE space=? AND session_id IN (${sessions})`,space,now,actor,'Đặt lại điểm danh hôm nay',date+' · ',id,space,space,date),
  app.q(`UPDATE requests SET status='expired',processed_at=?,actor=?,reason='Đã đặt lại điểm danh',lock_until=0 WHERE space=? AND status='pending' AND session_id IN (${sessions})`,now,actor,space,space,date),
  app.q(`UPDATE devices SET lock_until=0 WHERE space=? AND id IN (SELECT device_id FROM requests WHERE space=? AND session_id IN (${sessions}))`,space,space,space,date),
  app.q(`DELETE FROM outbox WHERE attendance_seq IN (SELECT seq FROM attendance WHERE space=? AND session_id IN (${sessions}))`,space,space,date),
  app.q(`DELETE FROM attendance WHERE space=? AND session_id IN (${sessions})`,space,space,date)
 ]);
 // Re-run today's idempotent setup on the next request after a bulk change.
 app.forgetInit?.(space);
 // Keep terminal request rows as immutable references for safe, additive recovery.
 return {date,removed:results[5].meta.changes,backupId:id};
}
export async function resetBackups(app,space){
 return app.all(`SELECT substr(s.key,length(?)+1) id,json_extract(s.value,'$.date') date,json_extract(s.value,'$.at') at,
 json_array_length(s.value,'$.attendance') attendance,json_array_length(s.value,'$.requests') requests,
 EXISTS(SELECT 1 FROM settings r WHERE r.key=replace(s.key,'reset-backup:','reset-restored:')) restored
 FROM settings s WHERE s.key LIKE ? ORDER BY s.key DESC LIMIT 20`,`reset-backup:${space}:`,`reset-backup:${space}:%`);
}
export async function restoreReset(app,space,id,actor){
 const key=backupKey(space,id),marker=key.replace('reset-backup:','reset-restored:');
 const meta=await app.one("SELECT json_extract(value,'$.version') version,json_extract(value,'$.space') space,json_extract(value,'$.date') date,json_array_length(value,'$.attendance') attendance FROM settings WHERE key=? AND json_valid(value)",key);
 if(!meta||meta.version!==1||meta.space!==space)throw new AppError('Không tìm thấy bản sao hợp lệ.',404);
 if(await app.one('SELECT key FROM settings WHERE key=?',marker))throw new AppError('Bản sao này đã được khôi phục.',409);
 // Attendance refers to retained terminal requests. Uniqueness keeps newer check-ins intact.
 const columns=attendanceColumns.filter(c=>c!=='seq');
 try{
  const results=await app.db.batch([
   app.q('INSERT INTO settings(key,value) VALUES(?,?)',marker,JSON.stringify({at:app.now(),actor})),
   app.q(`INSERT OR IGNORE INTO attendance(${columns.join(',')})
    SELECT ${columns.map(c=>`json_extract(j.value,'$.${c}')`).join(',')} FROM settings b,json_each(b.value,'$.attendance') j
    JOIN requests r ON r.id=json_extract(j.value,'$.request_id') AND r.status='approved'
    JOIN meal_sessions m ON m.id=r.session_id AND m.space=? AND m.date=?
    JOIN students s ON s.id=r.student_id AND s.space=?
    WHERE b.key=? AND json_extract(j.value,'$.space')=? AND r.student_id=json_extract(j.value,'$.student_id') AND r.session_id=json_extract(j.value,'$.session_id')`,space,meta.date,space,key,space),
   app.q("INSERT INTO audit(space,at,actor,action,result) SELECT ?,?,?,?,?||changes()||' lượt · bản sao '||?",space,app.now(),actor,'Khôi phục sau đặt lại',meta.date+' · ',id)
  ]);
  app.forgetInit?.(space);
  return {date:meta.date,restored:results[1].meta.changes,skipped:meta.attendance-results[1].meta.changes};
 }catch(e){if(String(e).includes('UNIQUE constraint failed: settings.key'))throw new AppError('Bản sao này vừa được khôi phục.',409);throw e;}
}
