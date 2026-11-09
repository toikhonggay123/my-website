import {AppError} from './mealcheck.mjs';
import {encryptStudentTokens} from './qr.mjs';

const fields=[['code','mã học sinh'],['name','họ và tên'],['grade','khối'],['class','lớp']];

export async function importStudents(app,env,space,rows,actor,{updateExisting=false}={}){
  if(!Array.isArray(rows)||!rows.length||rows.length>5000)throw new AppError('Danh sách phải có từ 1 đến 5.000 dòng.');
  const seen=new Set();
  const values=rows.map((row,index)=>{
    const student=fields.map(([key,label])=>{
      const value=typeof row?.[key]==='string'?row[key].trim():'';
      if(!value||value.length>150)throw new AppError(`Học sinh thứ ${index+1}: kiểm tra lại ${label}.`);
      return value;
    });
    if(seen.has(student[0]))throw new AppError(`Học sinh thứ ${index+1}: mã học sinh trùng trong danh sách.`);
    seen.add(student[0]);
    return [...student,updateExisting&&row.active===0?0:1];
  });
  const codes=JSON.stringify([...seen]);
  const hasDirectory=await app.one("SELECT 1 FROM sqlite_schema WHERE type='table' AND name='directory_classes'");
  const pending=await app.all(`SELECT j.value code,COALESCE(s.id,?||':'||j.value) id
    FROM json_each(?) j LEFT JOIN students s ON s.space=? AND s.code=j.value
    LEFT JOIN student_qr q ON q.student_id=s.id AND q.space=s.space WHERE q.student_id IS NULL`,space,codes,space);
  const signed=await encryptStudentTokens(env,space,pending.map(row=>row.id));

  const writing=updateExisting?'incoming':'fresh';
  const conflict=updateExisting?'DO UPDATE SET name=excluded.name,grade=excluded.grade,class=excluded.class,active=excluded.active':'DO NOTHING';
  const classLimit=hasDirectory?`AND (SELECT count(*) FROM directory_classes WHERE space=?) + (
    SELECT count(*) FROM (SELECT DISTINCT grade,class FROM ${writing} i WHERE NOT EXISTS (
      SELECT 1 FROM directory_classes c WHERE c.space=? AND c.grade=i.grade AND c.name=i.class
    ))
  )<=500`:'';
  const action=updateExisting?'Nhập/cập nhật học sinh':'Nhập bổ sung học sinh';
  const now=app.now();
  const qrWrites=[];
  // Split large token payloads below D1's per-value limit while keeping one transaction.
  for(let start=0;start<signed.length;start+=1000){
    const cards=signed.slice(start,start+1000).map(([id,token],index)=>[id,pending[start+index].code,token]);
    qrWrites.push(app.q(`INSERT INTO student_qr(student_id,space,token,created_at)
      SELECT s.id,s.space,json_extract(j.value,'$[2]'),? FROM json_each(?) j
      JOIN students s ON s.id=json_extract(j.value,'$[0]') AND s.code=json_extract(j.value,'$[1]') AND s.space=?
      WHERE 1 ON CONFLICT(student_id) DO NOTHING`,now,JSON.stringify(cards),space));
  }
  try{
    const [,written,...results]=await app.db.batch([
      // Enforce capacity in the same transaction. A NULL ID aborts the entire batch.
      app.q(`WITH incoming AS MATERIALIZED (
          SELECT json_extract(value,'$[0]') code,json_extract(value,'$[1]') name,
            json_extract(value,'$[2]') grade,json_extract(value,'$[3]') class,json_extract(value,'$[4]') active FROM json_each(?)
        ), fresh AS MATERIALIZED (
          SELECT i.* FROM incoming i WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.space=? AND s.code=i.code)
        )
        INSERT INTO students(id,space,code,name,grade,class,active)
        SELECT CASE WHEN (SELECT count(*) FROM students WHERE space=?)+(SELECT count(*) FROM fresh)<=5000
          ${classLimit} THEN ?||':'||code END,?,code,name,grade,class,active
        FROM ${writing} WHERE 1 ON CONFLICT(space,code) ${conflict}`,JSON.stringify(values),space,space,...(hasDirectory?[space,space]:[]),space,space),
      app.q(`INSERT INTO audit(space,at,actor,action,result)
        SELECT ?,?,?,?,CAST(changes() AS TEXT) WHERE changes()>0 RETURNING result`,space,now,actor,action),
      ...qrWrites,
      // If the roster changed between signing and the batch, fail closed without saving a partial import.
      app.q(`WITH missing AS (
          SELECT 1 FROM json_each(?) j LEFT JOIN students s ON s.space=? AND s.code=j.value
          LEFT JOIN student_qr q ON q.student_id=s.id AND q.space=s.space WHERE q.student_id IS NULL LIMIT 1
        )
        INSERT INTO audit(space,at,actor,action,result)
        SELECT ?,?,?,'Kiểm tra QR khi nhập học sinh',CASE WHEN NOT EXISTS(SELECT 1 FROM missing) THEN ? END
        WHERE ? OR EXISTS(SELECT 1 FROM missing)`,codes,space,space,now,actor,String(values.length),signed.length),
    ]);
    const count=Number(written.results?.[0]?.result??0);
    const qrIssued=results.slice(0,-1).reduce((total,result)=>total+result.meta.changes,0);
    return updateExisting?{count,qrIssued}:{added:count,skipped:values.length-count,qrIssued};
  }catch(error){
    const message=String(error);
    if(message.includes('NOT NULL constraint failed: students.id'))throw new AppError('Danh sách vượt giới hạn 5.000 học sinh hoặc 500 lớp.',409);
    if(message.includes('NOT NULL constraint failed: audit.result'))throw new AppError('Danh sách vừa thay đổi trong lúc nhập. Vui lòng thử lại.',409);
    throw error;
  }
}
