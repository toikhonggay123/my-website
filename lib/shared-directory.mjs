import {AppError,hashToken,sortNames} from './mealcheck.mjs';

const actions=new Set(['student.create','student.update','class.create','class.update']);
function field(value,label,max=150){
  if(typeof value!=='string'||!value.trim()||value.trim().length>max)throw new AppError('Kiểm tra lại '+label+'.');
  return value.trim().normalize('NFC');
}

export async function directoryAccess(req,env,policy){
  if(!['local','cloud-live'].includes(policy.mode)||!env.MEALCHECK_DIRECTORY_KEY)throw new AppError('Không tìm thấy chức năng.',404);
  const supplied=req.headers.get('authorization')?.replace(/^Bearer /,'')||'';
  if(!supplied||await hashToken(supplied)!==await hashToken(env.MEALCHECK_DIRECTORY_KEY)){
    throw new AppError('Kết nối danh sách chung chưa được xác thực.',403);
  }
}

export async function directorySnapshot(app,space){
  const results=await app.db.batch([
    app.q("SELECT value FROM settings WHERE key='directory:instance'"),
    app.q('SELECT revision FROM directory_revisions WHERE space=?',space),
    app.q('SELECT id,grade,name FROM directory_classes WHERE space=? ORDER BY id LIMIT 501',space),
    app.q(`SELECT s.id,s.code,s.name,s.active,c.id AS class_id
      FROM students s JOIN directory_classes c ON c.space=s.space AND c.grade=s.grade AND c.name=s.class
      WHERE s.space=? ORDER BY s.id LIMIT 5001`,space)
  ]);
  if(results[2].results.length>500||results[3].results.length>5000){
    throw new AppError('Danh sách chung vượt giới hạn 500 lớp hoặc 5.000 học sinh.',409);
  }
  return {schemaVersion:1,sourceId:results[0].results[0].value,space,
    revision:results[1].results[0].revision,classes:results[2].results,students:results[3].results};
}

export async function directoryRoster(app,space){
  const ready=await app.one("SELECT name FROM sqlite_master WHERE type='table' AND name='directory_classes'");
  if(!ready)return {students:await app.roster(space,{includeInactive:true}),classes:[],revision:null};
  const snapshot=await directorySnapshot(app,space),classes=new Map(snapshot.classes.map(row=>[row.id,row]));
  return {classes:snapshot.classes,revision:snapshot.revision,students:sortNames(snapshot.students.map(row=>({
    id:row.id,code:row.code,name:row.name,active:row.active,grade:classes.get(row.class_id).grade,class:classes.get(row.class_id).name
  })))};
}

export async function directoryMutation(app,space,input){
  if(!input||!actions.has(input.action)||!/^[a-f0-9-]{36}$/.test(input.operationId||'')||
    !Number.isSafeInteger(input.revision)||input.revision<0)throw new AppError('Yêu cầu danh sách chung không hợp lệ.');
  const action=input.action,student=action.startsWith('student.'),create=action.endsWith('.create');
  const name=field(input.name,'họ tên hoặc tên lớp');
  const grade=student?null:field(input.grade,'khối',40);
  const classId=student?field(input.class_id,'lớp',80):null;
  const code=student&&create?field(input.code,'mã học sinh'):null;
  const active=student?(input.active===0?0:1):null;
  const id=create?(student?space+':'+code:crypto.randomUUID().replaceAll('-','')):field(input.id,'mã hồ sơ',200);
  const payload={action,name,grade,classId,code,active,id:create?null:id};
  const requestHash=await hashToken(JSON.stringify(payload));
  const previous=await app.one('SELECT request_hash,entity_id FROM directory_operations WHERE id=? AND space=?',input.operationId,space);
  if(previous){
    if(previous.request_hash!==requestHash)throw new AppError('Mã thao tác đã được dùng cho dữ liệu khác.',409);
    return {id:previous.entity_id,snapshot:await directorySnapshot(app,space)};
  }
  const nonce=crypto.randomUUID();
  const guarded='EXISTS (SELECT 1 FROM directory_operations WHERE id=? AND nonce=?)';
  let valid='1=1',args=[];
  if(student){
    valid='EXISTS (SELECT 1 FROM directory_classes WHERE space=? AND id=?)';
    args=[space,classId];
    if(active){
      valid+=` AND (SELECT count(*) FROM students s JOIN directory_classes c
        ON c.space=s.space AND c.grade=s.grade AND c.name=s.class
        WHERE c.space=? AND c.id=? AND s.active=1 AND s.id<>?)<100`;
      args.push(space,classId,id);
    }
  }
  if(create){
    valid+=' AND (SELECT count(*) FROM '+(student?'students':'directory_classes')+' WHERE space=?)<?';
    args.push(space,student?1000:100);
  }
  if(!create){
    valid+=' AND EXISTS (SELECT 1 FROM '+(student?'students':'directory_classes')+' WHERE space=? AND id=?)';
    args.push(space,id);
  }
  const statements=[app.q(`INSERT INTO directory_operations(id,space,request_hash,nonce,entity_id,created_at)
    SELECT ?,?,?,?,?,? FROM directory_revisions WHERE space=? AND revision=? AND ${valid}
    ON CONFLICT(id) DO NOTHING`,input.operationId,space,requestHash,nonce,id,app.now(),space,input.revision,...args)];
  if(student&&create){
    statements.push(app.q(`INSERT INTO students(id,space,code,name,grade,class,active)
      SELECT ?,?,?,?,c.grade,c.name,? FROM directory_classes c WHERE c.space=? AND c.id=? AND ${guarded}`,
    id,space,code,name,active,space,classId,input.operationId,nonce));
  }else if(student){
    statements.push(app.q(`UPDATE students SET name=?,active=?,
      grade=(SELECT grade FROM directory_classes WHERE space=? AND id=?),
      class=(SELECT name FROM directory_classes WHERE space=? AND id=?)
      WHERE space=? AND id=? AND ${guarded}`,
    name,active,space,classId,space,classId,space,id,input.operationId,nonce));
  }else if(create){
    statements.push(app.q(`INSERT INTO directory_classes(id,space,grade,name)
      SELECT ?,?,?,? WHERE ${guarded}`,id,space,grade,name,input.operationId,nonce));
  }else{
    statements.push(app.q(`UPDATE directory_classes SET grade=?,name=? WHERE space=? AND id=? AND ${guarded}`,
      grade,name,space,id,input.operationId,nonce));
  }
  statements.push(app.q('UPDATE directory_operations SET applied=CASE WHEN changes()=1 THEN 1 ELSE 0 END WHERE id=? AND nonce=?',input.operationId,nonce));
  statements.push(app.q(`INSERT INTO audit(space,at,actor,action,result)
    SELECT ?,?,'ClassHub','Cập nhật danh sách chung',? WHERE ${guarded}`,
  space,app.now(),action,input.operationId,nonce));
  try{await app.db.batch(statements);}catch(error){
    if(/UNIQUE|CHECK/.test(String(error)))throw new AppError('Mã học sinh hoặc lớp đã tồn tại, hoặc dữ liệu vừa thay đổi. Hãy tải lại.',409);
    throw error;
  }
  const saved=await app.one('SELECT request_hash,entity_id FROM directory_operations WHERE id=? AND space=?',input.operationId,space);
  if(!saved||saved.request_hash!==requestHash)throw new AppError('Danh sách vừa thay đổi. Hãy tải lại trước khi lưu.',409);
  return {id:saved.entity_id,snapshot:await directorySnapshot(app,space)};
}
