'use client';
import {useEffect,useRef,useState} from 'react';
import {X,ArrowLeft,Zap,ZapOff,SlidersHorizontal,SwitchCamera,ImageUp,CircleCheck,ChevronDown,Camera,CameraOff,Maximize,Minimize,AlertCircle,Download,Printer,RefreshCw,ScanLine,Upload,LoaderCircle} from 'lucide-react';
import './camera-feedback.css';
import {MotionPresence} from './liquid-motion';
import './qr-scanner.css';
import {createCameraDecoder} from './qr-camera-decoder';
import {openQrImage} from './qr-image';
import {StudentQRCard,type StudentCard} from './student-qr-card';
import {MEALS,LABELS as MEAL_LABELS,SCHOOL,localClock} from '@/lib/mealcheck.mjs';
import {saveScan,flushScans,readDevicePref,saveDevicePref} from './offline-store';
type Row=Record<string,any>;
const LABELS:Record<string,string>=MEAL_LABELS;
async function api(path:string,body?:any):Promise<any>{const r=await fetch('/api/'+path,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});const data:any=await r.json();if(!r.ok)throw Error(data.error||'Không kết nối được máy chủ.');return data;}
function ErrorNote({text}:{text:string}){return text?<div className="alert" role="alert"><AlertCircle size={18}/><span>{text}</span></div>:null;}

export function QRScanner({space,onRecord,onNavigate}:{space:string;onRecord:()=>void;onNavigate?:(tab:string)=>void}){
 const [meal,setMeal]=useState(''),[running,setRunning]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<Row|null>(null),[busy,setBusy]=useState(false),[facing,setFacing]=useState('environment'),[configured,setConfigured]=useState<boolean|null>(null),[full,setFull]=useState(false),[immersive,setImmersive]=useState(false),[queued,setQueued]=useState(''),[options,setOptions]=useState(false),[torch,setTorch]=useState(false),[torchSupported,setTorchSupported]=useState(false),[torchBusy,setTorchBusy]=useState(false);
 const stage=useRef<HTMLDivElement>(null),audio=useRef<AudioContext|null>(null);
 const video=useRef<HTMLVideoElement>(null),canvas=useRef<HTMLCanvasElement>(null),stream=useRef<MediaStream|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null),alive=useRef(true),processing=useRef(false),last=useRef({token:'',at:0}),session=useRef(''),feedbackId=useRef(0),runId=useRef(0),decoderRef=useRef<Awaited<ReturnType<typeof createCameraDecoder>>|null>(null);
 const selectedMeal=useRef(''),autoStarted=useRef(false),starting=useRef(false);
 const suffix='?space='+space;
 useEffect(()=>{const ack=(event:Event)=>{const detail=(event as CustomEvent).detail;if(detail.space!==space)return;if(detail.result.meal!==selectedMeal.current){onRecord();return;}setResult({...detail.result,feedbackId:++feedbackId.current});setQueued('');chime(detail.result.duplicate?'duplicate':'success');try{navigator.vibrate?.(detail.result.duplicate?[50,40,50]:80);}catch{}onRecord();};window.addEventListener('mealcheck-scan-ack',ack);return()=>window.removeEventListener('mealcheck-scan-ack',ack);},[space,onRecord]);
 useEffect(()=>{let lock:WakeLockSentinel|null=null,cancelled=false,acquiring=false;const request=async()=>{if(!running||document.hidden||!navigator.wakeLock||acquiring||(lock&&!lock.released))return;acquiring=true;try{const acquired=await navigator.wakeLock.request('screen');if(cancelled){await acquired.release();return;}lock=acquired;}catch{}finally{acquiring=false;}};void request();document.addEventListener('visibilitychange',request);window.addEventListener('focus',request);return()=>{cancelled=true;document.removeEventListener('visibilitychange',request);window.removeEventListener('focus',request);void lock?.release().catch(()=>{});};},[running]);
 useEffect(()=>{document.body.classList.toggle('scanner-immersive',immersive);const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setImmersive(false);};window.addEventListener('keydown',escape);return()=>{document.body.classList.remove('scanner-immersive');window.removeEventListener('keydown',escape);};},[immersive]);
 function unlockSound(){try{if(!audio.current)audio.current=new AudioContext();void audio.current.resume().catch(()=>{});}catch{}}
 function chime(kind:string){try{if(!audio.current)audio.current=new AudioContext();const ctx=audio.current;void ctx.resume().catch(()=>{});const gain=ctx.createGain(),osc=ctx.createOscillator();gain.gain.setValueAtTime(.09,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.18);osc.frequency.setValueAtTime(kind==='error'?220:kind==='duplicate'?440:880,ctx.currentTime);osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.2);}catch{}}
 useEffect(()=>{const change=()=>setFull(document.fullscreenElement===stage.current);document.addEventListener('fullscreenchange',change);return()=>{document.removeEventListener('fullscreenchange',change);void audio.current?.close();};},[]);
 async function fullscreen(){try{if(immersive){setImmersive(false);return;}if(document.fullscreenElement)await document.exitFullscreen();else if(stage.current?.requestFullscreen)await stage.current.requestFullscreen().catch(()=>setImmersive(true));else setImmersive(!immersive);}catch(e:any){setError(e.message);}}

 function stop(){starting.current=false;if(alive.current){setTorch(false);setTorchSupported(false);}runId.current++;decoderRef.current?.close();decoderRef.current=null;stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;if(timer.current)clearTimeout(timer.current);timer.current=null;if(video.current)video.current.srcObject=null;if(alive.current){setRunning(false);setBusy(false);}}
 useEffect(()=>{alive.current=true;const saved=readDevicePref('meal:'+space,null);if(saved?.date===localClock().date&&MEALS.includes(saved.meal))changeMeal(saved.meal);if(!navigator.onLine)setConfigured(!!readDevicePref('scannerReady:'+space,null));else void api('qr/config').then(r=>{if(alive.current)setConfigured(r.configured);}).catch(e=>{if(alive.current){if(e instanceof TypeError&&readDevicePref('scannerReady:'+space,null))setConfigured(true);else setError(e instanceof TypeError?'Kết nối mạng để chuẩn bị máy quét lần đầu trên thiết bị này.':e.message);}});return()=>{alive.current=false;stop();};},[space]);
 useEffect(()=>{const pause=()=>stop();const visibility=()=>{if(document.hidden)stop();};window.addEventListener('mealcheck-camera-pause',pause);document.addEventListener('visibilitychange',visibility);return()=>{window.removeEventListener('mealcheck-camera-pause',pause);document.removeEventListener('visibilitychange',visibility);};},[]);
 // One automatic attempt per visit. A manual stop or denied permission must not
 // cause another prompt; returning to the scanner creates a fresh visit.
 useEffect(()=>{if(configured===null)return;const open=()=>{if(document.hidden||!alive.current||autoStarted.current)return;autoStarted.current=true;void start();};open();document.addEventListener('visibilitychange',open);return()=>document.removeEventListener('visibilitychange',open);},[configured]);
 useEffect(()=>{if(!result)return;const dismiss=setTimeout(()=>setResult(null),3000);return()=>clearTimeout(dismiss);},[result]);
 function changeMeal(next:string){
  if(!MEALS.includes(next)||processing.current)return;
  selectedMeal.current=next;
  // All meals are prepared together. Keep the server date and camera stream,
  // while changing the session used by the next decoded frame.
  if(session.current){const date=session.current.split(':')[1];session.current=`${space}:${date}:${next}`;}
  last.current={token:'',at:0};setMeal(next);setResult(null);setError('');setQueued('');
  saveDevicePref('meal:'+space,{date:localClock().date,meal:next});
 }
 async function prepare(requireMeal=true){
  const nextMeal=selectedMeal.current;
  if(requireMeal&&!nextMeal)throw Error('Chọn bữa ăn trước khi quét.');
  if(navigator.onLine){let r;try{r=await api('qr/scanner/start'+suffix,{});}catch(e){if(!(e instanceof TypeError)||!readDevicePref('scannerReady:'+space,null))throw e;r={date:localClock().date};}session.current=`${space}:${r.date}:${nextMeal}`;saveDevicePref('scannerReady:'+space,{date:r.date});}
  else{const saved=readDevicePref('scannerReady:'+space,null);if(!saved)throw Error('Mở máy quét một lần khi có mạng trên thiết bị này trước.');session.current=`${space}:${localClock().date}:${nextMeal}`;}
  if(nextMeal)saveDevicePref('meal:'+space,{date:localClock().date,meal:nextMeal});
 }
 async function record(token:string,manual=false){
  if(processing.current)return;
  if(!manual&&last.current.token===token)return;
  processing.current=true;last.current={token,at:Date.now()};setBusy(true);setError('');
  try{await saveScan({token,space,sessionId:session.current});if(!alive.current)return;setResult(null);setQueued('Đã lưu lượt quét trên máy · Chờ máy chủ xác nhận.');if(navigator.onLine)void flushScans().catch(()=>{});}
  catch(e:any){if(alive.current){setError(e.message);setResult(null);chime('error');}}
  finally{processing.current=false;if(alive.current)setBusy(false);}
 }
 async function start(){
  unlockSound();
  if(starting.current||busy||running)return;
  setError('');setResult(null);stop();starting.current=true;setBusy(true);
  const run=runId.current;
  try{
   if(!navigator.mediaDevices?.getUserMedia)throw Error('Trình duyệt chưa hỗ trợ camera. Mở ứng dụng bằng Chrome/Safari tại localhost hoặc HTTPS, hoặc dùng ảnh QR.');
   if(configured===true)await prepare(false);if(!alive.current||run!==runId.current)return;
   const decoder=await createCameraDecoder(canvas.current!);if(!alive.current||run!==runId.current){decoder.close();return;}decoderRef.current=decoder;
   const media=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:facing},width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30,max:30}},audio:false});
   if(!alive.current||run!==runId.current){decoder.close();media.getTracks().forEach(t=>t.stop());return;}
   stream.current=media;setRunning(true);video.current!.srcObject=media;await video.current!.play();if(!alive.current||run!==runId.current)return;const track=media.getVideoTracks()[0];setTorchSupported(!!(track.getCapabilities?.() as any)?.torch);if((track.getCapabilities?.() as any)?.focusMode?.includes('continuous'))void track.applyConstraints({advanced:[{focusMode:'continuous'}]} as any).catch(()=>{});
   const tick=async()=>{if(!stream.current||!alive.current||run!==runId.current)return;const v=video.current;
    if(configured===true&&selectedMeal.current&&v&&v.readyState>=2&&!processing.current){try{const frameSession=session.current;const token=await decoder.decode(v);if(!stream.current||!alive.current||run!==runId.current)return;if(frameSession===session.current){if(token)void record(token);else last.current={token:'',at:0};}}catch{if(alive.current&&run===runId.current){stop();setError('Không đọc được hình ảnh camera. Mở lại camera hoặc chọn ảnh QR.');}return;}}
    if(stream.current&&alive.current)timer.current=setTimeout(()=>{const current=video.current as any;if(current?.requestVideoFrameCallback)current.requestVideoFrameCallback(()=>void tick());else void tick();},32);
   };void tick();
  }catch(e:any){if(!alive.current||run!==runId.current)return;stop();setBusy(false);const messages:Row={NotAllowedError:'Camera chưa được cho phép. Bật quyền Camera cho ứng dụng trong cài đặt trình duyệt rồi thử lại.',NotFoundError:'Không tìm thấy camera. Có thể dùng nút Chọn ảnh QR.',NotReadableError:'Camera đang được ứng dụng khác sử dụng. Đóng ứng dụng đó rồi thử lại.'};setError(messages[e.name]||e.message||'Không mở được camera.');}
  finally{if(alive.current&&run===runId.current){starting.current=false;setBusy(false);}}
 }
 async function readImage(file:File){unlockSound();setError('');setResult(null);stop();setBusy(true);try{if(file.size>10_000_000)throw Error('Ảnh QR tối đa 10 MB.');await prepare();const image=await openQrImage(file);try{const c=canvas.current!;const scale=Math.min(1,1600/Math.max(image.width,image.height));c.width=Math.max(1,Math.round(image.width*scale));c.height=Math.max(1,Math.round(image.height*scale));const ctx=c.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(image.source,0,0,c.width,c.height);const pixels=ctx.getImageData(0,0,c.width,c.height),decoder=(await import('jsqr')).default,code=decoder(pixels.data,c.width,c.height,{inversionAttempts:'attemptBoth'});if(!code?.data)throw Error('Không tìm thấy QR rõ nét trong ảnh.');await record(code.data,true);}finally{image.close();}}catch(e:any){setError(e.message);}finally{setBusy(false);}}
 async function toggleTorch(){const track=stream.current?.getVideoTracks()[0],run=runId.current;if(!track||!torchSupported||torchBusy)return;setTorchBusy(true);try{await track.applyConstraints({advanced:[{torch:!torch}]} as any);if(run===runId.current&&alive.current)setTorch(!torch);}catch{setError('Không bật được đèn trên camera này.');}finally{if(alive.current)setTorchBusy(false);}}
 function leave(target:string){stop();setOptions(false);if(document.fullscreenElement===stage.current)void document.exitFullscreen().catch(()=>{});setImmersive(false);onNavigate?.(target);}
 return <div ref={stage} onPointerDown={unlockSound} className={'qr-scanner scanner-view '+(immersive?'immersive':'')}>
  <section className={'camera-stage scan-scene '+(running?'active':'')} aria-label="Camera quét điểm danh">
   <div className="scanner-launch-fx" aria-hidden="true"><div className="scanner-launch-sheen"/><div className="scanner-launch-badge"><img src="/brand/afyllx-logo.png" width="52" height="52" alt=""/><span><b>AFYLLX MealCheck</b><small>Quét QR điểm danh</small></span><ScanLine aria-hidden="true"/></div></div>
   <video ref={video} muted playsInline className="scan-video" style={{display:running?'block':'none'}}/>
   <div className="scan-scrim" aria-hidden="true"/>
   <div className="scan-layout">
    <header className="scan-top"><button className="scan-icon" aria-label="Về tổng quan" onClick={()=>leave('overview')}><ArrowLeft size={25}/></button><h2>Quét mã QR</h2><div className="scan-top-actions"><button className="scan-icon" aria-label={torch?'Tắt đèn flash':'Bật đèn flash'} title={running?(torchSupported?'Đèn flash':'Camera này không hỗ trợ đèn flash'):'Mở camera để sử dụng đèn flash'} aria-pressed={torch} disabled={!running||!torchSupported||torchBusy} onClick={()=>void toggleTorch()}>{torch?<ZapOff size={24}/>:<Zap size={24}/>}</button><button className={'scan-icon '+(options?'selected':'')} aria-label="Tùy chọn camera" aria-expanded={options} aria-controls="scan-options" onClick={()=>setOptions(!options)}><SlidersHorizontal size={24}/></button></div></header>
    <MotionPresence open={options} variant="popover">{options&&<section className="scan-options" id="scan-options" aria-label="Tùy chọn camera"><label>Camera<select aria-label="Camera quét QR" value={facing} disabled={running||busy} onChange={e=>setFacing(e.target.value)}><option value="environment">Camera sau</option><option value="user">Camera trước</option></select></label>{running&&<p>Tắt camera trước khi đổi camera.</p>}<button onClick={()=>void fullscreen()}>{full||immersive?<Minimize size={18}/>:<Maximize size={18}/>} {full||immersive?'Thoát toàn màn hình':'Toàn màn hình'}</button><button onClick={()=>leave('guide')}>Hướng dẫn sử dụng</button></section>}</MotionPresence>
    <div className="scan-intro"><p className="scan-wordmark"><strong>AFYLLX</strong> <span>MealCheck</span></p><p className="scan-hint">Hướng camera điện thoại vào mã QR trên thẻ học sinh.</p></div>
    <div className="scan-target-area"><div className="scan-target"><div className="scan-target-border" aria-hidden="true"/>{running&&<span className="scan-sweep" aria-hidden="true"/>}{!running&&!result&&<div className="scan-standby"><ScanLine size={40} strokeWidth={1.4}/><p>{configured===false?'Chờ bổ sung khóa QR':configured===null?'Đang chuẩn bị máy quét…':!meal?'Chọn bữa ăn để bắt đầu':'Sẵn sàng quét thẻ'}</p>{configured!==null&&<button className="scan-start" disabled={busy} onClick={()=>void start()}>{busy?<LoaderCircle className="spin" size={17}/>:<Camera size={18}/>}{busy?'Đang mở camera…':'Mở camera quét'}</button>}</div>}
     <MotionPresence open={!!result} variant="feedback">{result&&<div className={'camera-feedback '+(result.duplicate?'duplicate':'success')} role="status" aria-live="polite" aria-atomic="true"><div className="camera-feedback-glass"><span key={"ripple-"+result.feedbackId} className="camera-feedback-ripple" aria-hidden="true"/><CircleCheck key={result.feedbackId} className="camera-check" size={64} aria-hidden="true"/><div className="camera-feedback-copy"><p className="camera-feedback-label">{result.duplicate?'Đã điểm danh bữa này':'Điểm danh thành công'}</p><h3>{result.student.name}</h3><p>Lớp <b>{result.student.class}</b> · {LABELS[result.meal]}</p><p>Mã học sinh: <b>{result.student.code}</b></p><small>{result.duplicate?'Không tính thêm suất ăn.':'Đã lưu vào lịch sử.'}</small></div></div></div>}</MotionPresence>
    </div><div className="scan-live-status" role="status">{busy?<><LoaderCircle size={14} className="spin"/>{running?'Đang ghi nhận…':'Đang mở camera…'}</>:running?(configured===false?'Camera đã mở · Chờ bổ sung khóa QR':meal?'Đang quét':'Chọn bữa ăn để bắt đầu điểm danh'):''}</div></div>
    <div className="scan-bottom"><div className="scan-messages">{configured===false&&<p className="scan-message">Người quản lý cần bổ sung đúng khóa QR cũ để quét các thẻ hiện có.</p>}{queued&&<p className="scan-message pending" role="status">{queued}</p>}{error&&<p className="scan-message scan-error" role="alert"><AlertCircle size={17}/><span>{error}</span><button aria-label="Đóng thông báo camera" onClick={()=>setError('')}><X size={18}/></button></p>}</div>
     <div className="scan-meal-bar"><label className="scan-meal"><span>Bữa ăn hôm nay</span><span className="scan-meal-value">{meal?LABELS[meal]:'Chọn bữa ăn'}<ChevronDown size={17}/></span><select aria-label="Bữa ăn quét QR" value={meal} disabled={busy} onChange={e=>changeMeal(e.target.value)}><option value="" disabled>Chọn bữa ăn</option>{MEALS.map(m=><option key={m} value={m}>{LABELS[m]}</option>)}</select></label><button className="scan-icon" aria-label="Đổi camera" disabled={running||busy} onClick={()=>setFacing(facing==='environment'?'user':'environment')} title={running?'Tắt camera trước khi đổi':'Đổi camera'}><SwitchCamera size={25}/></button></div>
     <nav className="scan-dock" aria-label="Thao tác máy quét"><label className={'scan-dock-action scan-image '+(!meal||busy||configured!==true?'disabled':'')} onClick={unlockSound}><ImageUp size={29} strokeWidth={1.6}/><span>Chọn ảnh QR</span><input type="file" aria-label="Chọn ảnh QR để điểm danh" accept="image/*" disabled={!meal||busy||configured!==true} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void readImage(file);}}/></label><button className="scan-dock-action scan-camera-action" disabled={busy||configured===null} onClick={()=>running?stop():void start()}>{busy?<LoaderCircle className="spin" size={29}/>:running?<CameraOff size={29} strokeWidth={1.6}/>:<Camera size={29} strokeWidth={1.6}/>}<span>{running?'Tắt camera':'Mở camera'}</span></button></nav>
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
