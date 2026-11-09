'use client';
import {useEffect,useRef,useState} from 'react';
import {X,ArrowLeft,Zap,ZapOff,SlidersHorizontal,SwitchCamera,ChevronDown,Camera,Maximize,Minimize,AlertCircle,Download,Printer,RefreshCw,ScanLine,Upload,LoaderCircle} from 'lucide-react';
import {MotionPresence} from './liquid-motion';
import './qr-scanner.css';
import {createCameraDecoder} from './qr-camera-decoder';
import {ScannerReceipts} from './scanner-receipts';
import {cameraRegion,videoFramePump} from '@/lib/camera-region.mjs';
import {StudentQRCard,type StudentCard} from './student-qr-card';
import {MEALS,LABELS as MEAL_LABELS,SCHOOL,localClock} from '@/lib/mealcheck.mjs';
import {saveScan,flushScans,readDevicePref,saveDevicePref} from './offline-store';
import {scannerClock,scannerDate,sessionForScan} from '@/lib/scanner-session.mjs';
type Row=Record<string,any>;
const LABELS:Record<string,string>=MEAL_LABELS;
async function api(path:string,body?:any,signal?:AbortSignal):Promise<any>{const r=await fetch('/api/'+path,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',signal});const data:any=await r.json();if(!r.ok)throw Object.assign(Error(data.error||'Không kết nối được máy chủ.'),{status:r.status});return data;}
function ErrorNote({text}:{text:string}){return text?<div className="alert" role="alert"><AlertCircle size={18}/><span>{text}</span></div>:null;}
type Readiness='checking'|'ready'|'missing-key'|'unavailable';

export function QRScanner({space,onNavigate}:{space:string;onNavigate?:(tab:string)=>void}){
 const [meal,setMeal]=useState(''),[running,setRunning]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false),[facing,setFacing]=useState('environment'),[readiness,setReadiness]=useState<Readiness>('checking'),[full,setFull]=useState(false),[immersive,setImmersive]=useState(false),[options,setOptions]=useState(false),[torch,setTorch]=useState(false),[torchSupported,setTorchSupported]=useState(false),[torchBusy,setTorchBusy]=useState(false);
 const stage=useRef<HTMLDivElement>(null),audio=useRef<AudioContext|null>(null);
 const video=useRef<HTMLVideoElement>(null),canvas=useRef<HTMLCanvasElement>(null),stream=useRef<MediaStream|null>(null),alive=useRef(true),processing=useRef(false),last=useRef({token:'',at:0}),session=useRef(''),runId=useRef(0),decoderRef=useRef<Awaited<ReturnType<typeof createCameraDecoder>>|null>(null);
 const selectedMeal=useRef(''),autoStarted=useRef(false),starting=useRef(false),serverClock=useRef<ReturnType<typeof scannerClock>|null>(null);
 const ready=useRef(false),retrySetup=useRef<()=>void>(()=>{}),resumeCamera=useRef(false),startCamera=useRef<()=>void>(()=>{});
 startCamera.current=()=>void start();
 const [scanDate,setScanDate]=useState('');
 const scanTarget=useRef<HTMLDivElement>(null),historyOpen=useRef(false),stopFrames=useRef<(()=>void)|null>(null);
 useEffect(()=>{document.body.classList.add('mealcheck-scanning');return()=>document.body.classList.remove('mealcheck-scanning');},[]);
 const suffix='?space='+space;
 useEffect(()=>{const failed=(event:Event)=>{const detail=(event as CustomEvent).detail;if(detail?.space!==space||detail.sessionId!==session.current)return;setError(detail.error||'Máy chủ chưa ghi nhận lượt quét. Kiểm tra lượt chờ để thử lại.');chime('error');};window.addEventListener('mealcheck-scan-failed',failed);return()=>window.removeEventListener('mealcheck-scan-failed',failed);},[space]);
 useEffect(()=>{let lock:WakeLockSentinel|null=null,cancelled=false,acquiring=false;const request=async()=>{if(!running||document.hidden||!navigator.wakeLock||acquiring||(lock&&!lock.released))return;acquiring=true;try{const acquired=await navigator.wakeLock.request('screen');if(cancelled){await acquired.release();return;}lock=acquired;}catch{}finally{acquiring=false;}};void request();document.addEventListener('visibilitychange',request);window.addEventListener('focus',request);return()=>{cancelled=true;document.removeEventListener('visibilitychange',request);window.removeEventListener('focus',request);void lock?.release().catch(()=>{});};},[running]);
 useEffect(()=>{document.body.classList.toggle('scanner-immersive',immersive);const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!historyOpen.current)setImmersive(false);};window.addEventListener('keydown',escape);return()=>{document.body.classList.remove('scanner-immersive');window.removeEventListener('keydown',escape);};},[immersive]);
 function unlockSound(){try{if(!audio.current)audio.current=new AudioContext();void audio.current.resume().catch(()=>{});}catch{}}
 function chime(kind:string){try{if(!audio.current)audio.current=new AudioContext();const ctx=audio.current;void ctx.resume().catch(()=>{});const gain=ctx.createGain(),osc=ctx.createOscillator();gain.gain.setValueAtTime(.09,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.18);osc.frequency.setValueAtTime(kind==='error'?220:kind==='duplicate'?440:880,ctx.currentTime);osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.2);}catch{}}
 useEffect(()=>{const change=()=>setFull(document.fullscreenElement===stage.current);document.addEventListener('fullscreenchange',change);return()=>{document.removeEventListener('fullscreenchange',change);void audio.current?.close();};},[]);
 async function fullscreen(){try{if(immersive){setImmersive(false);return;}if(document.fullscreenElement)await document.exitFullscreen();else if(stage.current?.requestFullscreen)await stage.current.requestFullscreen().catch(()=>setImmersive(true));else setImmersive(!immersive);}catch(e:any){setError(e.message);}}

 function stop(){stopFrames.current?.();stopFrames.current=null;starting.current=false;if(alive.current){setTorch(false);setTorchSupported(false);}runId.current++;decoderRef.current?.close();decoderRef.current=null;stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;if(video.current)video.current.srcObject=null;if(alive.current){setRunning(false);setBusy(false);}}
 useEffect(()=>{
  alive.current=true;
  let disposed=false,request:AbortController|null=null;
  const readyKey='scannerReady:'+space,remembered=readDevicePref(readyKey,null);
  if(Number.isFinite(remembered?.offset))serverClock.current=scannerClock(Date.now()+remembered.offset);
  const date=scannerDate(serverClock.current),saved=readDevicePref('meal:'+space,null);
  setScanDate(date);
  if(saved?.date===date&&MEALS.includes(saved.meal))changeMeal(saved.meal);
  const setState=(state:Readiness)=>{ready.current=state==='ready';setReadiness(state);};
  if(remembered?.date)setState('ready');
  async function prepare(){
   if(disposed||request)return;
   if(!navigator.onLine){
    if(!ready.current)setState('unavailable');
    return;
   }
   const controller=new AbortController();
   request=controller;
   const timeout=setTimeout(()=>controller.abort(),5000);
   try{
    const config=await api('qr/config',undefined,controller.signal);
    if(disposed)return;
    if(!config.configured){saveDevicePref(readyKey,null);setState('missing-key');return;}
    const r=await api('qr/scanner/start'+suffix,{},controller.signal);
    if(disposed)return;
    if(Number.isFinite(r.serverNow))serverClock.current=scannerClock(r.serverNow);
    setScanDate(r.date);
    saveDevicePref(readyKey,{date:r.date,offset:Number.isFinite(r.serverNow)?r.serverNow-Date.now():null});
    setState('ready');
    window.dispatchEvent(new Event('mealcheck-server-online'));
    void flushScans().catch(()=>{});
   }catch(e:any){
    if(disposed)return;
    if(e.status===401||e.status===403){saveDevicePref(readyKey,null);setState('unavailable');setError(e.message);}
    else{
     if(!ready.current)setState('unavailable');
     window.dispatchEvent(new Event('mealcheck-server-offline'));
    }
   }finally{clearTimeout(timeout);request=null;}
  }
  const refresh=()=>void prepare(),visible=()=>{if(!document.hidden)refresh();};
  retrySetup.current=refresh;
  window.addEventListener('online',refresh);
  document.addEventListener('visibilitychange',visible);
  refresh();
  return()=>{disposed=true;request?.abort();window.removeEventListener('online',refresh);document.removeEventListener('visibilitychange',visible);alive.current=false;stop();};
 },[space]);
 useEffect(()=>{
  const pause=()=>{resumeCamera.current=false;stop();};
  const visibility=()=>{
   if(document.hidden){resumeCamera.current=!!stream.current||starting.current;stop();}
   else if(resumeCamera.current){resumeCamera.current=false;startCamera.current();}
  };
  window.addEventListener('mealcheck-camera-pause',pause);
  document.addEventListener('visibilitychange',visibility);
  return()=>{window.removeEventListener('mealcheck-camera-pause',pause);document.removeEventListener('visibilitychange',visibility);};
 },[]);
 // One automatic attempt per visit. A manual stop or denied permission must not
 // cause another prompt; returning to the scanner creates a fresh visit.
 useEffect(()=>{if(readiness!=='ready')return;const open=()=>{if(document.hidden||!alive.current||autoStarted.current)return;autoStarted.current=true;startCamera.current();};open();document.addEventListener('visibilitychange',open);return()=>document.removeEventListener('visibilitychange',open);},[readiness]);
 function changeMeal(next:string){
  if(!MEALS.includes(next)||processing.current)return;
  selectedMeal.current=next;
  // All meals are prepared together. Keep the server date and camera stream,
  // while changing the session used by the next decoded frame.
  const date=scannerDate(serverClock.current);
  session.current=`${space}:${date}:${next}`;
  last.current={token:'',at:0};setMeal(next);setError('');
  saveDevicePref('meal:'+space,{date,meal:next});
 }
 async function record(token:string){
  if(processing.current||!ready.current)return;
  if(last.current.token===token)return;
  processing.current=true;last.current={token,at:Date.now()};setBusy(true);setError('');
  try{
   const next=sessionForScan(space,selectedMeal.current,session.current,serverClock.current);
   if(next.needsPreparation){session.current=next.id;setScanDate(next.date);saveDevicePref('meal:'+space,{date:next.date,meal:selectedMeal.current});}
   await saveScan({token,space,sessionId:next.id});
   if(alive.current){chime('success');try{navigator.vibrate?.(45);}catch{}}
   if(navigator.onLine)void flushScans().catch(()=>{});
  }
  catch(e:any){if(alive.current){setError(e.message);chime('error');}}
  finally{processing.current=false;if(alive.current)setBusy(false);}
 }
 async function start(nextFacing=facing,restart=false){
  unlockSound();
  if(!ready.current||starting.current||(stream.current&&!restart))return;
  setError('');stop();starting.current=true;setBusy(true);
  const run=runId.current;
  try{
   if(!navigator.mediaDevices?.getUserMedia)throw Error('Trình duyệt chưa hỗ trợ camera. Mở ứng dụng bằng Chrome/Safari tại localhost hoặc HTTPS, rồi thử lại.');
   const decoder=await createCameraDecoder(canvas.current!,()=>{const v=video.current,guide=scanTarget.current;return v&&guide?cameraRegion(v.videoWidth,v.videoHeight,v.getBoundingClientRect(),guide.getBoundingClientRect()):null;});if(!alive.current||run!==runId.current){decoder.close();return;}decoderRef.current=decoder;
   const media=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:nextFacing},width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30,max:30}},audio:false});
   if(!alive.current||run!==runId.current){decoder.close();media.getTracks().forEach(t=>t.stop());return;}
   stream.current=media;setRunning(true);video.current!.srcObject=media;await video.current!.play();if(!alive.current||run!==runId.current)return;const track=media.getVideoTracks()[0];setTorchSupported(!!(track.getCapabilities?.() as any)?.torch);if((track.getCapabilities?.() as any)?.focusMode?.includes('continuous'))void track.applyConstraints({advanced:[{focusMode:'continuous'}]} as any).catch(()=>{});
   stopFrames.current=videoFramePump(video.current!,async()=>{
    if(!stream.current||!alive.current||run!==runId.current||historyOpen.current)return;
    const v=video.current;if(!ready.current||!selectedMeal.current||!v||v.readyState<2||processing.current)return;
    const frameMeal=selectedMeal.current,token=await decoder.decode(v);
    if(!stream.current||!alive.current||run!==runId.current||frameMeal!==selectedMeal.current)return;
    if(token){if(last.current.token===token)last.current.at=Date.now();else void record(token);}
    else if(Date.now()-last.current.at>400)last.current={token:'',at:0};
   },{onError:()=>{if(alive.current&&run===runId.current){stop();setError('Không đọc được hình ảnh camera. Mở lại camera để tiếp tục.');}}});
  }catch(e:any){if(!alive.current||run!==runId.current)return;stop();setBusy(false);const messages:Row={NotAllowedError:'Camera chưa được cho phép. Bật quyền Camera cho ứng dụng trong cài đặt trình duyệt rồi thử lại.',NotFoundError:'Không tìm thấy camera. Kiểm tra camera của thiết bị rồi thử lại.',NotReadableError:'Camera đang được ứng dụng khác sử dụng. Đóng ứng dụng đó rồi thử lại.'};setError(messages[e.name]||e.message||'Không mở được camera.');}
  finally{if(alive.current&&run===runId.current){starting.current=false;setBusy(false);}}
 }
 function changeCamera(next:string){if(busy)return;setFacing(next);if(running)void start(next,true);}
 async function toggleTorch(){const track=stream.current?.getVideoTracks()[0],run=runId.current;if(!track||!torchSupported||torchBusy)return;setTorchBusy(true);try{await track.applyConstraints({advanced:[{torch:!torch}]} as any);if(run===runId.current&&alive.current)setTorch(!torch);}catch{setError('Không bật được đèn trên camera này.');}finally{if(alive.current)setTorchBusy(false);}}
 function leave(target:string){stop();setOptions(false);if(document.fullscreenElement===stage.current)void document.exitFullscreen().catch(()=>{});setImmersive(false);onNavigate?.(target);}
 return <div ref={stage} onPointerDown={unlockSound} className={'qr-scanner scanner-view '+(immersive?'immersive':'')}>
  <section className={'camera-stage scan-scene '+(running?'active':'')} aria-label="Camera quét điểm danh">
   <div className="scanner-launch-fx" aria-hidden="true"><div className="scanner-launch-sheen"/><div className="scanner-launch-badge"><strong className="scanner-launch-title">CheckIn</strong><ScanLine aria-hidden="true"/></div></div>
   <video ref={video} muted playsInline className="scan-video" style={{display:running?'block':'none'}}/>
   <div className="scan-scrim" aria-hidden="true"/>
   <div className="scan-layout">
    <header className="scan-top"><button className="scan-icon" aria-label="Về tổng quan" onClick={()=>leave('overview')}><ArrowLeft size={25}/></button><h2>Quét mã QR</h2><div className="scan-top-actions"><button className="scan-icon" aria-label={torch?'Tắt đèn flash':'Bật đèn flash'} title={running?(torchSupported?'Đèn flash':'Camera này không hỗ trợ đèn flash'):'Mở camera để sử dụng đèn flash'} aria-pressed={torch} disabled={!running||!torchSupported||torchBusy} onClick={()=>void toggleTorch()}>{torch?<ZapOff size={24}/>:<Zap size={24}/>}</button><button className={'scan-icon '+(options?'selected':'')} aria-label="Tùy chọn camera" aria-expanded={options} aria-controls="scan-options" onClick={()=>setOptions(!options)}><SlidersHorizontal size={24}/></button></div></header>
    <MotionPresence open={options} variant="popover">{options&&<section className="scan-options" id="scan-options" aria-label="Tùy chọn camera"><label>Camera<select aria-label="Camera quét QR" value={facing} disabled={busy} onChange={e=>changeCamera(e.target.value)}><option value="environment">Camera sau</option><option value="user">Camera trước</option></select></label><button onClick={()=>void fullscreen()}>{full||immersive?<Minimize size={18}/>:<Maximize size={18}/>} {full||immersive?'Thoát toàn màn hình':'Toàn màn hình'}</button><button onClick={()=>leave('guide')}>Hướng dẫn sử dụng</button></section>}</MotionPresence>
    <div className="scan-intro"><h1 className="scan-wordmark">CheckIn</h1><p className="scan-hint">Hướng camera điện thoại vào mã QR trên thẻ học sinh.</p></div>
    <div className="scan-target-area"><div ref={scanTarget} className="scan-target"><div className="scan-target-border" aria-hidden="true"/>{running&&<span className="scan-sweep" aria-hidden="true"/>}{!running&&<div className="scan-standby"><ScanLine size={40} strokeWidth={1.4}/><p>{readiness==='missing-key'?'Chờ bổ sung khóa QR':readiness==='checking'?'Đang chuẩn bị máy quét…':readiness==='unavailable'?'Kết nối mạng để chuẩn bị máy quét':!meal?'Chọn buổi để bắt đầu':'Sẵn sàng quét thẻ'}</p>{readiness==='unavailable'&&<button className="scan-start" onClick={()=>retrySetup.current()}>Thử kết nối lại</button>}{readiness==='ready'&&<button className="scan-start" disabled={busy} onClick={()=>void start()}>{busy?<LoaderCircle className="spin" size={17}/>:<Camera size={18}/>}{busy?'Đang mở camera…':'Mở camera quét'}</button>}</div>}

    </div><div className="scan-live-status" role="status">{busy?<><LoaderCircle size={14} className="spin"/>{running?'Đang ghi nhận…':'Đang mở camera…'}</>:running?(readiness==='ready'?(meal?'Đang quét':'Chọn buổi để bắt đầu điểm danh'):'Máy quét đang chờ chuẩn bị'):''}</div></div>
    <div className="scan-bottom"><ScannerReceipts space={space} meal={meal} date={scanDate} target={scanTarget} onOpenChange={open=>{historyOpen.current=open;}}/><div className="scan-messages">{readiness==='missing-key'&&<p className="scan-message">Người quản lý cần bổ sung đúng khóa QR cũ để quét các thẻ hiện có.</p>}{error&&<p className="scan-message scan-error" role="alert"><AlertCircle size={17}/><span>{error}</span><button aria-label="Đóng thông báo camera" onClick={()=>setError('')}><X size={18}/></button></p>}</div>
     <div className="scan-meal-bar"><label className="scan-meal"><span>Buổi hôm nay</span><span className="scan-meal-value">{meal?LABELS[meal]:'Chọn buổi'}<ChevronDown size={17}/></span><select aria-label="Buổi quét QR" value={meal} disabled={busy} onChange={e=>changeMeal(e.target.value)}><option value="" disabled>Chọn buổi</option>{MEALS.map(m=><option key={m} value={m}>{LABELS[m]}</option>)}</select></label><button className="scan-icon" aria-label="Đổi camera" disabled={busy} onClick={()=>changeCamera(facing==='environment'?'user':'environment')} title="Đổi camera"><SwitchCamera size={25}/></button></div>

    </div>
   </div>
  </section><canvas ref={canvas} hidden/>
 </div>;
}

export function QRStudentCards({space,students,initialFilter=null,sample=false}:{space:string;students:Row[];initialFilter?:{grade:string;class:string}|null;sample?:boolean}){
 const [grade,setGrade]=useState(initialFilter?.grade||''),[cl,setClass]=useState(initialFilter?.class||''),[cards,setCards]=useState<StudentCard[]>([]),[missing,setMissing]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(''),[confirm,setConfirm]=useState<Row|null>(null);
 const suffix='?space='+space;
 useEffect(()=>{setCards([]);setError('');setConfirm(null);setMissing(0);},[space]);
 useEffect(()=>{setCards([]);setMissing(0);setConfirm(null);},[grade,cl]);
 useEffect(()=>{if(initialFilter)void load();},[space]);
 const grades=Array.from(new Set(students.filter(s=>s.active).map(s=>s.grade))).sort((a,b)=>a.localeCompare(b,'vi',{numeric:true}));
 const classes=Array.from(new Set(students.filter(s=>s.active&&(!grade||s.grade===grade)).map(s=>s.class))).sort((a,b)=>a.localeCompare(b,'vi',{numeric:true}));
 async function render(rows:(Omit<StudentCard,'image'>&{token:string})[]):Promise<StudentCard[]>{const QRCode=(await import('qrcode')).default;return Promise.all(rows.map(async r=>({...r,image:await QRCode.toDataURL(r.token,{width:600,margin:4,errorCorrectionLevel:'M'})})));}
 async function load(){setBusy(true);setError('');try{const r=await api('qr/cards/issued'+suffix,{grade,class:cl});setCards(await render(r.cards));setMissing(r.missing);}catch(e:any){setError(e.message);}finally{setBusy(false);}}
 async function issueMissing(){if(!window.confirm('Cấp QR cho học sinh chưa có mã trong bộ lọc hiện tại? Các mã đã cấp được giữ nguyên.'))return;setBusy(true);setError('');try{const r=await api('qr/cards'+suffix,{grade,class:cl});setCards(await render(r.cards));setMissing(0);}catch(e:any){setError(e.message);}finally{setBusy(false);}}
 async function reissue(){if(!confirm)return;setBusy(true);setError('');try{const r=await api('qr/reissue'+suffix,{studentId:confirm.id});const [card]=await render([r.card]);setCards(rows=>rows.map(row=>row.id===card.id?card:row));setConfirm(null);}catch(e:any){setError(e.message);}finally{setBusy(false);}}
 return <div className="qr-cards-page"><div className="toolbar qr-card-controls"><label>Khối<select aria-label="Khối thẻ QR" value={grade} disabled={busy} onChange={e=>{setGrade(e.target.value);setClass('');}}><option value="">Tất cả khối</option>{grades.map(g=><option key={g}>{g}</option>)}</select></label><label>Lớp<select aria-label="Lớp thẻ QR" value={cl} disabled={busy} onChange={e=>setClass(e.target.value)}><option value="">Tất cả lớp</option>{classes.map(c=><option key={c}>{c}</option>)}</select></label><button className="primary" disabled={busy} onClick={()=>void load()}>{busy?<LoaderCircle className="spin" size={18}/>:<RefreshCw size={18}/>}Tải thẻ đã cấp</button><button className="secondary" disabled={busy||!cards.length} onClick={()=>window.print()}><Printer size={18}/>In / Lưu PDF ({cards.length})</button></div><ErrorNote text={error}/>{missing>0&&<p className="info qr-card-controls">{missing} học sinh chưa có QR đã cấp. <button className="secondary" disabled={busy} onClick={()=>void issueMissing()}>Cấp QR còn thiếu</button></p>}{cards.length?<><p className="qr-count">{cards.length} thẻ học sinh · {sample?'Dữ liệu mẫu ngẫu nhiên':'Dữ liệu chính thức'}</p><div className="student-id-grid">{cards.map(card=><StudentQRCard key={card.id} card={card} demo={sample||space==='demo'} onReissue={busy?undefined:()=>setConfirm(card)}/>)}</div></>:<section className="panel"><div className="camera-placeholder"><ScanLine size={44}/><h3>Chưa tải thẻ QR</h3></div></section>}<MotionPresence open={!!confirm} onDismiss={busy?undefined:()=>setConfirm(null)}>{confirm&&<div className="modal-backdrop"><div className="modal"><h2>Cấp lại QR cho {confirm.name}?</h2><p>Thẻ QR cũ sẽ không còn dùng được. Hãy phát thẻ mới cho học sinh sau khi cấp lại.</p><div className="button-row"><button className="primary" disabled={busy} onClick={()=>void reissue()}>Cấp lại QR</button><button className="secondary" disabled={busy} onClick={()=>setConfirm(null)}>Giữ mã hiện tại</button></div></div></div>}</MotionPresence></div>;
}
