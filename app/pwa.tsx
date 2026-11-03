'use client';
import {useEffect,useRef,useState} from 'react';
import {Download,Smartphone,WifiOff,RefreshCw,Share2,ChevronDown} from 'lucide-react';
import {flushScans,scanStore} from './offline-store';
const installUrl='https://afyllx.com/cai-dat';

export function InstallApp({expanded=false,compact=false}:{expanded?:boolean;compact?:boolean}){
 const [platform,setPlatform]=useState('android'),[installed,setInstalled]=useState(false),[help,setHelp]=useState(expanded),[message,setMessage]=useState('');
 const [checked,setChecked]=useState(false);
 const prompt=useRef<any>(null);
 useEffect(()=>{
  setPlatform(/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)?'ios':'android');
  const display=matchMedia('(display-mode: standalone)'),check=()=>setInstalled(display.matches||(navigator as any).standalone===true);
  const before=(event:Event)=>{event.preventDefault();prompt.current=event;};
  check();setChecked(true);const onInstalled=()=>setInstalled(true);const modern=typeof display.addEventListener==='function';if(modern)display.addEventListener('change',check);else display.addListener?.(check);window.addEventListener('beforeinstallprompt',before);window.addEventListener('appinstalled',onInstalled);
  return()=>{if(modern)display.removeEventListener('change',check);else display.removeListener?.(check);window.removeEventListener('beforeinstallprompt',before);window.removeEventListener('appinstalled',onInstalled);};
 },[]);
 async function install(){setHelp(true);if(platform==='android'&&prompt.current){try{await prompt.current.prompt();const choice=await prompt.current.userChoice;setMessage(choice.outcome==='accepted'?'Đã gửi yêu cầu cài ứng dụng.':'Bạn có thể cài lại bằng nút bên trên.');prompt.current=null;}catch{setMessage('Mở menu trình duyệt để cài ứng dụng.');}}}
 async function share(){try{if(navigator.share)await navigator.share({title:'AFYLLX MealCheck',url:installUrl});else{await navigator.clipboard.writeText(installUrl);setMessage('Đã sao chép link cài app.');}}catch{setMessage('Link cài app: '+installUrl);}}
 if(compact&&(!checked||installed))return null;
 const content = <section className={'pwa-install '+(expanded?'expanded':'')} aria-label="Cài ứng dụng Android và iPhone"><a className="pwa-qr" href="/cai-dat" aria-label="Mở QR và hướng dẫn cài ứng dụng"><img src="/install-qr.svg" width="92" height="92" alt="QR cài AFYLLX MealCheck trên Android và iPhone"/></a><div className="pwa-install-copy"><h2>{installed?'Ứng dụng đã được cài':'Ứng dụng MealCheck'}</h2><a className="pwa-install-link" href="/cai-dat">Android · iPhone</a></div><div className="pwa-actions"><button className="primary" onClick={()=>void install()}><Download size={17}/>{installed?'Hướng dẫn cài app':platform==='ios'?'Hướng dẫn cài trên iPhone':'Cài ứng dụng'}</button><button className="secondary" onClick={()=>void share()}><Share2 size={17}/>Chia sẻ link</button></div>{help&&<div className="pwa-install-help"><div className="pwa-platforms"><button className={platform==='android'?'active':''} onClick={()=>setPlatform('android')}><Smartphone size={16}/>Android</button><button className={platform==='ios'?'active':''} onClick={()=>setPlatform('ios')}><Smartphone size={16}/>iPhone / iPad</button></div>{platform==='ios'?<ol><li>Mở link bằng <b>Safari</b>.</li><li>Bấm <b>Chia sẻ</b>, chọn <b>Thêm vào Màn hình chính</b>.</li><li>Bật <b>Mở như ứng dụng web</b> nếu có, rồi bấm <b>Thêm</b>.</li><li>Mở icon MealCheck và cho phép camera khi bắt đầu quét.</li></ol>:<ol><li>Mở link bằng <b>Chrome</b> trên Android.</li><li>Bấm <b>Cài ứng dụng</b> ở trên; nếu chưa hiện hộp cài, mở menu <b>⋮ → Cài đặt ứng dụng / Thêm vào màn hình chính</b>.</li><li>Mở icon MealCheck và cho phép camera khi bắt đầu quét.</li></ol>}<p>Mở máy quét khi có mạng lần đầu. Lượt quét mất mạng chỉ được xác nhận sau khi đồng bộ. Dữ liệu chờ nằm trên điện thoại này.</p></div>}{message&&<p className="pwa-share-message" role="status">{message}</p>}</section>;
 return compact?<details className="home-install"><summary><Smartphone size={16} aria-hidden="true"/>Cài ứng dụng<span>Android · iPhone</span><ChevronDown size={16} aria-hidden="true"/></summary>{content}</details>:content;
}

export function PwaRuntime(){
 const [online,setOnline]=useState(true),[pending,setPending]=useState(0),[failed,setFailed]=useState<any[]>([]),[detail,setDetail]=useState(false),[note,setNote]=useState(''),[update,setUpdate]=useState<ServiceWorkerRegistration|null>(null);
 useEffect(()=>{
  let alive=true;let registration:ServiceWorkerRegistration|null=null;const workerCleanup:(()=>void)[]=[];
  const refresh=async()=>{try{const rows=await scanStore.all();if(alive){setPending(rows.filter((r:any)=>r.state==='pending').length);setFailed(rows.filter((r:any)=>r.state==='failed'));}}catch{}};
  const connect=()=>{setOnline(navigator.onLine);if(navigator.onLine){void flushScans().catch(()=>{});void registration?.update().catch(()=>{});}void refresh();};
  const serverOffline=()=>setOnline(false),serverOnline=()=>setOnline(true);
  const ack=()=>{setOnline(true);setNote('Đã đồng bộ lượt quét và ghi nhận trên máy chủ.');window.setTimeout(()=>{if(alive)setNote('');},4000);};
  connect();window.addEventListener('online',connect);window.addEventListener('offline',connect);window.addEventListener('mealcheck-server-offline',serverOffline);window.addEventListener('mealcheck-server-online',serverOnline);window.addEventListener('mealcheck-outbox-change',refresh);window.addEventListener('mealcheck-scan-ack',ack);
  const visible=()=>{if(!document.hidden)connect();};document.addEventListener('visibilitychange',visible);
  const interval=setInterval(()=>{if(!document.hidden&&navigator.onLine)void flushScans().catch(()=>{});},10000);
  if('serviceWorker'in navigator&&window.isSecureContext){
   void navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).then(reg=>{
    if(!alive)return;registration=reg;if(reg.waiting)setUpdate(reg);
    const tracked=new Set<ServiceWorker>();
    const track=()=>{
     const worker=reg.installing;if(!worker||tracked.has(worker))return;tracked.add(worker);
     const changed=()=>{if(alive&&worker.state==='installed'&&navigator.serviceWorker.controller)setUpdate(reg);};
     worker.addEventListener('statechange',changed);workerCleanup.push(()=>worker.removeEventListener('statechange',changed));changed();
    };
    reg.addEventListener('updatefound',track);workerCleanup.push(()=>reg.removeEventListener('updatefound',track));track();
   }).catch(()=>{});
  }
  return()=>{alive=false;clearInterval(interval);window.removeEventListener('online',connect);window.removeEventListener('offline',connect);window.removeEventListener('mealcheck-server-offline',serverOffline);window.removeEventListener('mealcheck-server-online',serverOnline);window.removeEventListener('mealcheck-outbox-change',refresh);window.removeEventListener('mealcheck-scan-ack',ack);document.removeEventListener('visibilitychange',visible);workerCleanup.forEach(cleanup=>cleanup());};
 },[]);
 async function applyUpdate(){const waiting=update?.waiting;if(!waiting){setUpdate(null);return;}window.dispatchEvent(new Event('mealcheck-camera-pause'));navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload(),{once:true});waiting.postMessage('SKIP_WAITING');}
 return <>{(!online||pending>0||failed.length>0)&&<aside className="pwa-network" role="status">{online?<RefreshCw size={17}/>:<WifiOff size={17}/>}<span>{online?'Đã có mạng':'Mất mạng'}{pending>0?` · ${pending} lượt chờ đồng bộ`:!online?' · Lượt quét sẽ được lưu trên máy':''}{failed.length>0?` · ${failed.length} lượt cần kiểm tra`:''}</span><button onClick={()=>{setDetail(!detail);if(online)void flushScans().catch(()=>{});}}>Xem lượt chờ</button>{detail&&<div className="pwa-queue-detail"><p>Chỉ lượt được máy chủ xác nhận mới có trong lịch sử. Giữ app mở khi có mạng để đồng bộ. Không gỡ app hoặc xóa dữ liệu trình duyệt khi còn lượt chờ.</p>{failed.map(row=><div key={row.key}><b>{row.sessionId.split(':').slice(1).join(' · ')}</b><p>{row.error}</p><button onClick={()=>void scanStore.remove(row.key).then(()=>window.dispatchEvent(new Event('mealcheck-outbox-change')))}>Bỏ lượt lỗi khỏi máy</button></div>)}</div>}</aside>}{note&&<div className="pwa-sync-note" role="status">{note}</div>}{update&&<aside className="pwa-update">Có phiên bản MealCheck mới.<button onClick={()=>void applyUpdate()}>Cập nhật ứng dụng</button></aside>}</>;
}
