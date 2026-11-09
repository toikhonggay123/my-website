import { env } from 'cloudflare:workers';
import { MealCheck, AppError, localClock, normalize, SCHOOL } from '@/lib/mealcheck.mjs';
import { makeXlsx } from '@/lib/files.mjs';
import { makeDailyXls } from '@/lib/daily-report.mjs';
import {resetPreview,resetBackups,restoreReset} from '@/lib/reset-backup.mjs';
import {localAdminUser} from '@/lib/access.mjs';
import {deploymentPolicy,deploymentSpace,allowDemoOperation,deploymentCookies} from '@/lib/deployment.mjs';
import { studentCards, issuedStudentCards, reissueStudentCard, scanStudentCard } from '@/lib/qr.mjs';
import { discardRequestBody, readJsonBody } from '@/lib/http-body.mjs';
import {directoryAccess,directorySnapshot,directoryMutation,directoryRoster} from '@/lib/shared-directory.mjs';
import {importStudents} from '@/lib/student-upload.mjs';
export const dynamic='force-dynamic';
// This Worker has exactly one DB binding; a fixed scope keeps the per-isolate
// day-setup memo even if the binding object differs between requests.
const INIT_SCOPE={};
const json=(data:any,status=200,headers:any={})=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',...headers}});
function cookie(req:Request,name='mc_device'){return req.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1);}
async function handle(req:Request,{params}:any){
 try{
  if(!env.DB)throw new AppError('Cơ sở dữ liệu chưa sẵn sàng.',503);
  const app=new MealCheck(env.DB,undefined,{initScope:INIT_SCOPE}),url=new URL(req.url),{path}=await params,route=path.join('/');
  if(req.method==='POST'&&req.headers.get('origin')!==url.origin)throw new AppError('Nguồn yêu cầu không hợp lệ.',403);
  const contentLength=Number(req.headers.get('content-length')||0);if(contentLength>2_000_000)throw new AppError('Tệp quá lớn.',413);
  const policy=deploymentPolicy(url,env),space=deploymentSpace(url,policy);
  allowDemoOperation(policy,route,req.method);
  if(route==='health'&&req.method==='GET')return json({app:'AFYLLX MealCheck',deployment:policy.mode,demoOnly:policy.demoOnly,database:true,disposableTestDatabase:!policy.publicCloud&&env.MEALCHECK_QA_MODE==='true'});
  if(route==='v1/shared-directory'){
    await directoryAccess(req,env,policy);
    if(req.method==='GET')return json(await directorySnapshot(app,space));
    if(req.method==='POST')return json(await directoryMutation(app,space,await readJsonBody(req)));
    throw new AppError('Không tìm thấy chức năng.',404);
  }
  // A new disposable QA database cannot recognize cookies from a previous QA run.
  // This helper never exists on the real local application and does not bypass revocation there.
  if(route==='qa/browser-reset'&&req.method==='GET'){
    if(policy.publicCloud||env.MEALCHECK_QA_MODE!=='true')throw new AppError('Không tìm thấy chức năng.',404);
    const headers=new Headers({'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});
    for(const name of ['mc_scanner','mc_scanner_live','mc_scanner_demo'])headers.append('Set-Cookie',name+'=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
    return Response.json({qaBrowserReset:true},{headers});
  }
  const cookies=deploymentCookies(policy),token=cookie(req,cookies.device),device=await app.device(token),user=policy.publicCloud?{...localAdminUser(),id:policy.demoOnly?'demo-admin':'cloud-admin',name:policy.demoOnly?'Quản trị bản demo':'Quản trị nhà trường',email:policy.demoOnly?'Quản trị bản demo':'Quản trị nhà trường'}:localAdminUser();
  if(route==='identity'&&req.method==='GET')return json({localAdmin:!policy.publicCloud,publicCloud:policy.publicCloud,publicDemo:policy.demoOnly,defaultSpace:policy.defaultSpace,deployment:policy.mode,sampleRoster:(await app.one('SELECT value FROM settings WHERE key=?',policy.defaultSpace+':roster_kind'))?.value==='synthetic',user});
  const body:any=req.method==='POST'?await readJsonBody(req):{};
  if(route==='device/start'&&req.method==='POST'){
    // Browser identity is issued by the server; pupils never enter a device code.
    if(device)return json({device});
    if(token)throw new AppError('Thiết bị này đã bị tạm dừng. Vui lòng báo giáo viên.',403);
    if(policy.demoOnly&&body.space==='live')throw new AppError('Bản công khai chỉ sử dụng dữ liệu giả lập.',403);
    if(policy.liveOnly&&body.space==='demo')throw new AppError('Môi trường thử nghiệm đã được tắt.',403);
    const requestedSpace=policy.demoOnly||body.space==='demo'?'demo':'live';
    const d=await app.enrollDevice(requestedSpace,'Điểm danh · '+crypto.randomUUID().slice(0,6),'student-device');
    return json({device:await app.device(d.token)},200,{'Set-Cookie':`${cookies.device}=${d.token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000${url.protocol==='https:'?'; Secure':''}`});
  }
  if(route.startsWith('kiosk/')){
    if(!device)throw new AppError('Thiết bị chưa được đăng ký hoặc đã bị thu hồi.',403);
    if(route==='kiosk/state'&&req.method==='GET')return json(await app.kiosk(device,url.searchParams.get('meal')||''));
    if(route==='kiosk/roster'&&req.method==='GET')return json(await app.roster(device.space));
    if(route==='kiosk/request'&&req.method==='POST'){if(typeof body.sessionId!=='string')throw new AppError('Thiếu buổi điểm danh đang xác nhận.');const r=await app.checkIn(device,body.studentId,body.id,body.sessionId);return json(r);}
    throw new AppError('Không tìm thấy chức năng.',404);
  }
  // Read one already-issued card for the Edu portal. Never initialize sessions,
  // issue a QR or decrypt/reissue a card while rendering a marketing page.
  if(route==='qr/card-preview'&&req.method==='GET'){
    const card=await app.one('SELECT s.id,s.code,s.name,s.grade,s.class,q.token FROM students s JOIN student_qr q ON q.student_id=s.id AND q.space=s.space WHERE s.space=? AND s.active=1 ORDER BY s.grade,s.class,s.code LIMIT 1',space);
    return json({card:card||null,school:SCHOOL});
  }
  // Scans prepare the current day lazily if no scanner has opened since midnight.
  // init is memoized per isolate and local date, so polling routes do not write.
  if(route!=='qr/scan')await app.init(space);
  const admin=()=>{if(user.role!=='admin')throw new AppError('Chỉ quản trị viên được thực hiện.',403);};
  const date=url.searchParams.get('date')||localClock().date,from=url.searchParams.get('from')||date,to=url.searchParams.get('to')||date;
  const actor=user.email;
  const scannerCookie=policy.mode==='local'?cookies.scanner+'_'+space:cookies.scanner;
  const scannerToken=()=>cookie(req,scannerCookie)||(scannerCookie!==cookies.scanner?cookie(req,cookies.scanner):undefined);
  const scannerHeader=(raw:string)=>({'Set-Cookie':`${scannerCookie}=${raw}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000${url.protocol==='https:'?'; Secure':''}`});
  if(route==='qr/config'&&req.method==='GET')return json({configured:/^[A-Za-z0-9_-]{43}$/.test(env.MEALCHECK_QR_KEY||'')});
  if(route==='qr/scanner/start'&&req.method==='POST'){
    const raw=scannerToken(),scanner=await app.device(raw);
    if(raw&&!scanner)throw new AppError('Thiết bị quét đã bị thu hồi. Vui lòng liên hệ quản trị.',403);
    if(raw&&scanner?.space===space)return json({scanner,date:localClock().date,serverNow:app.now()},200,cookie(req,scannerCookie)?{}:scannerHeader(raw));
    const enrolled=await app.enrollDevice(space,'Máy quét QR · '+crypto.randomUUID().slice(0,6),actor);
    return json({scanner:await app.device(enrolled.token),date:localClock().date,serverNow:app.now()},200,scannerHeader(enrolled.token));
  }
  if(route==='qr/scan'&&req.method==='POST'){
    const raw=scannerToken(),scanner=await app.device(raw);
    if(!raw||(scanner&&scanner.space!==space))return json({code:'scanner_not_ready',error:'Mở máy quét của môi trường hiện tại để đồng bộ.'},403);
    if(!scanner)throw new AppError('Thiết bị quét đã bị thu hồi. Vui lòng liên hệ quản trị.',403);
    const result=await scanStudentCard(app,env,scanner,body.token,body.id,body.sessionId,actor);
    return json(result);
  }
  if(route==='board'&&req.method==='GET')return json(await app.dashboard(space,date));
  if(route==='queue'&&req.method==='GET')return json(await app.queue(space));
  if(route==='decide'&&req.method==='POST'){if(typeof body.approve!=='boolean')throw new AppError('Quyết định không hợp lệ.');const r=await app.decide(space,body.id,body.approve,actor);return json(r);}
  if(route==='records'&&req.method==='GET')return json(await app.records(space,from,to,url.searchParams.get('meal')||'',url.searchParams.get('grade')||'',url.searchParams.get('class')||''));
  if(route==='students'&&req.method==='GET')return json(url.searchParams.get('directory')==='1'
    ?await directoryRoster(app,space):await app.roster(space,{includeInactive:true}));
  if(route==='export/today'&&policy.publicCloud&&req.method==='GET')return new Response(null,{status:303,headers:{Location:'/xuat-excel','Cache-Control':'no-store'}});
  if(['daily','daily/today','export/today'].includes(route)&&req.method==='GET'){
    const reportDate=route==='daily'?date:localClock().date;
    const data={date:reportDate,space,students:await app.roster(space,{includeInactive:true}),records:await app.records(space,reportDate,reportDate)};
    if(route!=='export/today')return json(data);
    return new Response(makeDailyXls(data) as any,{headers:{'Content-Type':'application/vnd.ms-excel','Content-Disposition':`attachment; filename="CheckIn-${space}-${reportDate}.xls"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  }
  if(route==='export'&&req.method==='GET'){
    const query=normalize(url.searchParams.get('q')||'');
    const records=(await app.records(space,from,to,url.searchParams.get('meal')||'',url.searchParams.get('grade')||'',url.searchParams.get('class')||'')).filter((r:any)=>normalize(r.name+' '+r.code).includes(query));
    const rows=[['Ngày','Buổi','Mã học sinh','Họ tên','Khối','Lớp','Giờ xác nhận','Giáo viên','Trạng thái'],...records.map((r:any)=>[r.date,r.meal,r.code,r.name,r.grade,r.class,new Date(r.confirmed_at).toISOString(),r.teacher,'Đã xác nhận'])];
    if(url.searchParams.get('format')==='xlsx')return new Response(makeXlsx(rows,'DIEM_DANH') as any,{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="CheckIn-${from}.xlsx"`,'Cache-Control':'no-store'}});
    const safe=(v:any)=>{let s=String(v);if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};return new Response('\uFEFF'+rows.map(row=>row.map(safe).join(',')).join('\r\n'),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="CheckIn-${from}.csv"`,'Cache-Control':'no-store'}});
  }
  admin();
  if(route==='attendance/reset-preview'&&req.method==='GET')return json(await resetPreview(app,space));
  if(route==='attendance/reset-backups'&&req.method==='GET')return json(await resetBackups(app,space));
  if(route==='attendance/restore-reset'&&req.method==='POST')return json(await restoreReset(app,space,body.backupId,actor));
  if(route==='attendance/reset-today'&&req.method==='POST')return json(await app.resetToday(space,body.confirmDate,actor));
  if(route==='qr/cards'&&req.method==='POST')return json({cards:await studentCards(app,env,space,{grade:body.grade||'',class:body.class||''})});
  if(route==='qr/cards/issued'&&req.method==='POST')return json(await issuedStudentCards(app,space,{grade:body.grade||'',class:body.class||''}));
  if(route==='qr/reissue'&&req.method==='POST')return json({card:await reissueStudentCard(app,env,space,body.studentId,actor)});
  if(route==='approval'&&req.method==='POST'){await app.setApproval(space,body.required,actor);return json({approvalRequired:body.required});}
  if(route==='seed'&&req.method==='POST')return json({count:await app.seed(actor)});
  if(req.method==='POST'&&(route==='students/import'||route==='students/import/qr')){
    if(route==='students/import/qr'&&!['add','upsert'].includes(body.mode))throw new AppError('Kiểu nhập học sinh không hợp lệ.');
    const result=await importStudents(app,env,space,body.rows,actor,{updateExisting:route==='students/import/qr'&&body.mode==='upsert'});
    return json(route==='students/import'?{added:result.added,skipped:result.skipped}:result);
  }
  if(route==='students'&&req.method==='POST')return json({count:await app.saveStudents(space,body.rows,actor)});
  if(route==='schedule'&&req.method==='POST'){await app.setSchedule(space,body.rows,body.lockSeconds,actor);return json({ok:true});}
  if(route==='control'&&req.method==='POST'){await app.control(space,body.meal,body.open,actor);return json({ok:true});}
  if(route==='devices'&&req.method==='GET')return json(await app.all('SELECT d.id,d.space,d.name,d.active,d.lock_until,(SELECT max(r.created_at) FROM requests r WHERE r.device_id=d.id) last_used FROM devices d WHERE d.space=? ORDER BY last_used DESC,d.name',space));
  if(route==='devices/revoke'&&req.method==='POST'){await app.run('UPDATE devices SET active=0 WHERE id=? AND space=?',body.id,space);await app.log(space,actor,'Thu hồi thiết bị',body.id);return json({ok:true});}
  if(route==='audit'&&req.method==='GET')return json(await app.all('SELECT * FROM audit WHERE space=? ORDER BY seq DESC LIMIT 500',space));
  throw new AppError('Không tìm thấy chức năng.',404);
 }catch(e:any){await discardRequestBody(req);const known=e instanceof AppError;return json({error:known?e.message:'Không thể xử lý yêu cầu. Vui lòng thử lại.',...(!known?{reference:crypto.randomUUID()}: {})},known?e.status:500);}
}
export const GET=handle;export const POST=handle;
