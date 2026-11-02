import {resetWithBackup} from './reset-backup.mjs';
export const MEALS = ['sang','trua','toi'];
export const LABELS = { sang:'Bữa sáng', trua:'Bữa trưa', toi:'Bữa tối' };
export const SCHOOL = 'Trường Phổ thông Dân tộc Nội trú Xã Na Rì';
export class AppError extends Error { constructor(message,status=400){super(message);this.status=status;} }
export function localClock(ms=Date.now()) {
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(ms)).map(x=>[x.type,x.value]));
  return {date:`${parts.year}-${parts.month}-${parts.day}`,time:`${parts.hour}:${parts.minute}`};
}
export const normalize = s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase();
const collator = new Intl.Collator('vi');
export const sortNames = rows=>rows.sort((a,b)=>collator.compare(a.name.trim().split(/\s+/).at(-1),b.name.trim().split(/\s+/).at(-1))||collator.compare(a.name,b.name));
export const hashToken = async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,'0')).join('');
export const randomToken = ()=>crypto.randomUUID()+crypto.randomUUID();
export class MealCheck {
  constructor(db,now=()=>Date.now()){this.db=db;this.now=now;}
  q(sql,...args){return this.db.prepare(sql).bind(...args);}
  async all(sql,...args){return (await this.q(sql,...args).all()).results;}
  one(sql,...args){return this.q(sql,...args).first();}
  run(sql,...args){return this.q(sql,...args).run();}
  async init(space){
    if(!['live','demo'].includes(space))throw new AppError('Môi trường không hợp lệ.');
    const {date}=localClock(this.now());
    await this.db.batch(MEALS.flatMap(meal=>[
      this.q('INSERT OR IGNORE INTO schedules(id,space,meal) VALUES(?,?,?)',`${space}:${meal}`,space,meal),
      this.q('INSERT OR IGNORE INTO meal_sessions(id,space,date,meal) VALUES(?,?,?,?)',`${space}:${date}:${meal}`,space,date,meal)
    ]));
    await this.run("UPDATE requests SET status='expired',processed_at=?,actor='system',reason='Phiên đã sang ngày mới',lock_until=? WHERE space=? AND status='pending' AND session_id NOT IN (SELECT id FROM meal_sessions WHERE date=?)",this.now(),this.now()+await this.lockMs(space),space,date);
  }
  async lockMs(space){const s=await this.one('SELECT value FROM settings WHERE key=?',`lock:${space}`);return (s?Number(s.value):5)*1000;}
  async log(space,actor,action,result='Thành công'){await this.run('INSERT INTO audit(space,at,actor,action,result) VALUES(?,?,?,?,?)',space,this.now(),actor,action,result);}
  async device(token){if(!token)return null;return this.one('SELECT id,space,name,active,lock_until FROM devices WHERE hash=? AND active=1',await hashToken(token));}
  async enrollDevice(space,name,actor){
    name=String(name||'').trim();if(!name||name.length>80)throw new AppError('Nhập tên thiết bị, tối đa 80 ký tự.');
    const token=randomToken(),id=crypto.randomUUID();await this.run('INSERT INTO devices(id,space,name,hash) VALUES(?,?,?,?)',id,space,name,await hashToken(token));await this.log(space,actor,'Tạo thiết bị',name);return {id,token,name,space};
  }
  async sessionState(space){
    await this.init(space);const {date,time}=localClock(this.now());
    const rows=await this.all('SELECT m.*,s.enabled,s.start,s.end FROM meal_sessions m JOIN schedules s ON s.id=m.space||\':\'||m.meal WHERE m.space=? AND m.date=?',space,date);
    // All three meals remain available all day. The pupil selects the meal.
    for(const r of rows)r.open=true;
    return {date,time,sessions:rows,active:null,conflict:false,alwaysOpen:true};
  }
  async setSchedule(space,rows,lock,actor){
    lock=Number(lock);if(!Number.isInteger(lock)||lock<1||lock>60)throw new AppError('Thời gian khóa từ 1 đến 60 giây.');
    if(!Array.isArray(rows)||rows.length!==3||new Set(rows.map(r=>r.meal)).size!==3)throw new AppError('Cần cấu hình đủ ba bữa.');
    for(const r of rows){if(!MEALS.includes(r.meal))throw new AppError('Bữa ăn không hợp lệ.');if(r.enabled&&(!/^\d{2}:\d{2}$/.test(r.start)||!/^\d{2}:\d{2}$/.test(r.end)||r.start>=r.end||r.end>'23:59'||r.start>'23:59'||r.start.slice(3)>'59'||r.end.slice(3)>'59'))throw new AppError('Giờ mở/đóng phải hợp lệ, trong cùng ngày.');}
    const enabled=rows.filter(r=>r.enabled).sort((a,b)=>a.start.localeCompare(b.start));for(let i=1;i<enabled.length;i++)if(enabled[i].start<enabled[i-1].end)throw new AppError('Khung giờ các bữa không được chồng lấn.');
    await this.db.batch([...rows.map(r=>this.q('UPDATE schedules SET enabled=?,start=?,end=? WHERE id=?',r.enabled?1:0,r.start||null,r.end||null,`${space}:${r.meal}`)),this.q('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',`lock:${space}`,String(lock))]);await this.log(space,actor,'Cập nhật khung giờ và khóa thiết bị');
  }
  async control(space,meal,open,actor){
    if(!MEALS.includes(meal))throw new AppError('Bữa ăn không hợp lệ.');const {date}=localClock(this.now());await this.init(space);
    await this.db.batch(open?[this.q("UPDATE meal_sessions SET override='closed' WHERE space=? AND date=?",space,date),this.q("UPDATE meal_sessions SET override='open' WHERE id=?",`${space}:${date}:${meal}`)]:[this.q("UPDATE meal_sessions SET override=? WHERE id=?",open===null?null:'closed',`${space}:${date}:${meal}`)]);
    await this.log(space,actor,`${open===null?'Tự động':open?'Mở':'Đóng'} ${LABELS[meal]}`);
  }
  async roster(space,filter={}){
    let rows=await this.all('SELECT id,code,name,grade,class,active FROM students WHERE space=?'+(filter.includeInactive?'':' AND active=1'),space);
    if(filter.grade)rows=rows.filter(r=>r.grade===filter.grade);if(filter.class)rows=rows.filter(r=>r.class===filter.class);if(filter.q)rows=rows.filter(r=>normalize(r.name+' '+r.code).includes(normalize(filter.q)));
    return sortNames(rows);
  }
  async saveStudents(space,rows,actor){
    if(!Array.isArray(rows)||!rows.length||rows.length>5000)throw new AppError('Danh sách phải có từ 1 đến 5.000 dòng.');const seen=new Set();
    for(const r of rows){if(!r||typeof r!=='object'||Array.isArray(r))throw new AppError('Dòng học sinh không hợp lệ.');for(const k of ['code','name','grade','class']){r[k]=String(r[k]??'').trim();if(!r[k]||r[k].length>150)throw new AppError(`Thiếu hoặc sai trường ${k}.`);}if(seen.has(r.code))throw new AppError(`Mã học sinh trùng: ${r.code}`);seen.add(r.code);r.active=r.active===0?0:1;}
    // Same stable student ID across reimports; historical attendance retains a snapshot.
    const statements=[];
    // 14 rows = 98 bound parameters, below D1's 100-variable statement limit.
    for(let i=0;i<rows.length;i+=14){const part=rows.slice(i,i+14);statements.push(this.q('INSERT INTO students(id,space,code,name,grade,class,active) VALUES '+part.map(()=>'(?,?,?,?,?,?,?)').join(',')+' ON CONFLICT(space,code) DO UPDATE SET name=excluded.name,grade=excluded.grade,class=excluded.class,active=excluded.active',...part.flatMap(r=>[`${space}:${r.code}`,space,r.code,r.name,r.grade,r.class,r.active])));}
    // D1 batches have a finite statement budget. Validate the complete input first.
    for(let i=0;i<statements.length;i+=50)await this.db.batch(statements.slice(i,i+50));await this.log(space,actor,'Nhập/cập nhật học sinh',String(rows.length));return rows.length;
  }
  async seed(actor){
    const first=['An','Ánh','Bình','Chi','Dũng','Đạt','Giang','Hà','Hằng','Hùng','Khánh','Lan','Linh','Minh','Nam','Ngọc','Phương','Quân','Sơn','Thảo','Trang','Trung','Tú','Uyên','Vi','Yến'];
    const last=['Nguyễn','Hoàng','Nông','Lý','Triệu','Đặng','Bế','Ma','Dương','Hà'];
    return this.saveStudents('demo',Array.from({length:1000},(_,i)=>({code:`TEST${String(i+1).padStart(4,'0')}`,name:`${last[i%last.length]} ${i%2?'Thị':'Văn'} ${first[Math.floor(i/10)%first.length]}`,grade:String(6+Math.floor(i/200)),class:`${6+Math.floor(i/200)}A${1+Math.floor(i%200/40)}`})),actor);
  }
  async submit(device,studentId,id,expectedSession){
    if(!/^[a-zA-Z0-9-]{16,80}$/.test(id||''))throw new AppError('Mã yêu cầu không hợp lệ.');
    const existing=await this.one('SELECT * FROM requests WHERE id=?',id);if(existing){if(existing.device_id!==device.id||existing.student_id!==studentId||existing.session_id!==expectedSession)throw new AppError('Mã yêu cầu đã được dùng.',409);return existing;}
    const state=await this.sessionState(device.space),session=state.sessions.find(s=>s.id===expectedSession);
    if(!session)throw new AppError('Vui lòng chọn đúng bữa ăn của ngày hiện tại.',409);
    const now=this.now();let result;
    try{result=await this.run(`INSERT INTO requests(id,space,student_id,session_id,device_id,created_at)
      SELECT ?,?,?,?,?,? FROM devices d JOIN students s ON s.id=? JOIN meal_sessions m ON m.id=?
      WHERE d.id=? AND d.active=1 AND d.lock_until<=? AND s.space=d.space AND s.active=1
      AND m.space=d.space AND m.date=?
      AND NOT EXISTS(SELECT 1 FROM attendance WHERE student_id=s.id AND session_id=m.id)`,id,device.space,studentId,session.id,device.id,now,studentId,session.id,device.id,now,state.date);
    }catch(e){if(String(e).includes('UNIQUE')){const retry=await this.one('SELECT * FROM requests WHERE id=?',id);if(retry?.device_id===device.id&&retry.student_id===studentId)return retry;throw new AppError('Học sinh hoặc thiết bị đang có yêu cầu chờ duyệt.',409);}throw e;}
    if(!result.meta.changes)throw new AppError('Đã điểm danh, thiết bị đang khóa hoặc ngày đã thay đổi. Vui lòng tải lại.',409);return this.one('SELECT * FROM requests WHERE id=?',id);
  }
  async approvalRequired(space){return (await this.one('SELECT value FROM settings WHERE key=?',`approval:${space}`))?.value==='required';}
  async setApproval(space,required,actor){
    if(typeof required!=='boolean')throw new AppError('Chế độ duyệt không hợp lệ.');
    await this.run('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',`approval:${space}`,required?'required':'automatic');
    await this.log(space,actor,required?'Bật duyệt điểm danh':'Tắt duyệt điểm danh');
  }
  async autoConfirm(device,request){
    if(request.device_id!==device.id)throw new AppError('Yêu cầu không thuộc thiết bị này.',403);
    if(request.status!=='pending')return request;
    const now=this.now(),lock=now+await this.lockMs(device.space);
    // Existing database triggers atomically write attendance, audit, outbox and cooldown.
    await this.run("UPDATE requests SET status='approved',processed_at=?,actor='Học sinh tự điểm danh',reason='Đã ghi nhận điểm danh',lock_until=? WHERE id=? AND device_id=? AND status='pending'",now,lock,request.id,device.id);
    return this.one('SELECT * FROM requests WHERE id=?',request.id);
  }
  async checkIn(device,studentId,id,sessionId){
    const request=await this.submit(device,studentId,id,sessionId);
    return await this.approvalRequired(device.space)?request:this.autoConfirm(device,request);
  }
  async decide(space,id,approve,actor){
    const state=await this.sessionState(space),r=await this.one('SELECT * FROM requests WHERE id=? AND space=?',id,space);if(!r)throw new AppError('Không tìm thấy yêu cầu.',404);
    if(r.status!=='pending')throw new AppError('Yêu cầu này đã được xử lý.',409);
    const now=this.now(),lock=now+await this.lockMs(space);
    if(approve&&!state.sessions.some(s=>s.id===r.session_id)){await this.run("UPDATE requests SET status='expired',processed_at=?,lock_until=?,actor=?,reason='Đã sang ngày mới' WHERE id=? AND status='pending'",now,lock,actor,id);throw new AppError('Đã sang ngày mới. Yêu cầu hết hiệu lực.',409);}
    const student=await this.one('SELECT active FROM students WHERE id=?',r.student_id);if(approve&&!student?.active)throw new AppError('Học sinh đã bị vô hiệu hóa.',409);
    const result=await this.run("UPDATE requests SET status=?,processed_at=?,actor=?,reason=?,lock_until=? WHERE id=? AND status='pending'",approve?'approved':'rejected',now,actor,approve?'Giáo viên đã xác nhận':'Giáo viên từ chối',lock,id);
    if(!result.meta.changes)throw new AppError('Yêu cầu vừa được giáo viên khác xử lý.',409);
    return this.one('SELECT * FROM requests WHERE id=?',id);
  }
  async kiosk(device,meal=''){
    const state=await this.sessionState(device.space),approvalRequired=await this.approvalRequired(device.space);
    state.active=state.sessions.find(s=>s.meal===meal)||null;
    let request=await this.one('SELECT r.*,s.name,s.class,s.grade FROM requests r JOIN students s ON s.id=r.student_id WHERE r.device_id=? ORDER BY r.created_at DESC LIMIT 1',device.id);
    // Recover a pending submission after a lost response, and release old waiting screens.
    if(request?.status==='pending'&&!approvalRequired)request={...request,...await this.autoConfirm(device,request)};
    const d=await this.one('SELECT id,name,space,lock_until FROM devices WHERE id=?',device.id);
    const confirmed=state.active?await this.all('SELECT student_id FROM attendance WHERE session_id=?',state.active.id):[];
    return {...state,approvalRequired,device:d,request,confirmed:confirmed.map(x=>x.student_id),now:this.now(),school:SCHOOL};
  }
  async queue(space){return this.all("SELECT r.*,s.name,s.code,s.grade,s.class,d.name device_name,m.meal FROM requests r JOIN students s ON s.id=r.student_id JOIN devices d ON d.id=r.device_id JOIN meal_sessions m ON m.id=r.session_id WHERE r.space=? AND r.status='pending' ORDER BY r.created_at",space);}
  async records(space,from,to,meal='',grade='',cl=''){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||from>to)throw new AppError('Khoảng ngày không hợp lệ.');
    const rows=await this.all('SELECT a.*,m.date,m.meal FROM attendance a JOIN meal_sessions m ON m.id=a.session_id WHERE a.space=? AND m.date>=? AND m.date<=? AND (?=\'\' OR m.meal=?) AND (?=\'\' OR a.grade=?) AND (?=\'\' OR a.class=?) ORDER BY m.date DESC,a.confirmed_at DESC LIMIT 50001',space,from,to,meal,meal,grade,grade,cl,cl);
    if(rows.length>50000)throw new AppError('Báo cáo vượt 50.000 lượt. Hãy chọn khoảng ngày ngắn hơn hoặc lọc theo khối/lớp để xuất đủ dữ liệu.');
    return rows;
  }
  async resetToday(space,confirmedDate,actor){
    return resetWithBackup(this,space,confirmedDate,actor);
  }
  async dashboard(space,date){
    const state=await this.sessionState(space);date=date||state.date;
    const total=(await this.one('SELECT count(*) n FROM students WHERE space=? AND active=1',space)).n;
    const records=await this.records(space,date,date),byClass=await this.all('SELECT grade,class,count(*) total FROM students WHERE space=? AND active=1 GROUP BY grade,class ORDER BY grade,class',space);
    const meals=Object.fromEntries(MEALS.map(meal=>{const n=records.filter(r=>r.meal===meal).length;return [meal,{count:n,missing:Math.max(0,total-n),rate:total?n/total:0}];}));
    for(const c of byClass)for(const meal of MEALS)c[meal]=records.filter(r=>r.class===c.class&&r.grade===c.grade&&r.meal===meal).length;
    return {...state,date,total,meals,byClass};
  }
}
