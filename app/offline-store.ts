import {coalescedTask,drainScans,enqueueScan,SCAN_SYNC_TAG} from '@/lib/offline-queue.mjs';
import {createScanStore} from '@/lib/scan-storage.mjs';

type SyncRegistration=ServiceWorkerRegistration&{sync?:{register:(tag:string)=>Promise<void>}};
export const scanStore=createScanStore(globalThis.indexedDB);
export const queueChanged=()=>window.dispatchEvent(new Event('mealcheck-outbox-change'));
export function scheduleBackgroundScans(registration?:ServiceWorkerRegistration){
 const registrationPromise=registration?Promise.resolve(registration):navigator.serviceWorker?.getRegistration();
 void registrationPromise?.then(reg=>reg?.active&&(reg as SyncRegistration).sync?.register(SCAN_SYNC_TAG)).catch(()=>{});
}
export async function saveScan(scan:{token:string;space:string;sessionId:string}){
 const row=await enqueueScan(scanStore,scan);
 window.dispatchEvent(new CustomEvent('mealcheck-scan-saved',{detail:{space:row.space,requestId:row.id,sessionId:row.sessionId,capturedAt:row.createdAt}}));
 queueChanged();
 scheduleBackgroundScans();
 return row;
}
export const flushScans=coalescedTask(()=>drainScans(scanStore,(type:string,detail:unknown)=>
 window.dispatchEvent(new CustomEvent(type,{detail})),()=>navigator.onLine).finally(queueChanged));

export function readDevicePref(key:string,fallback:any){try{return JSON.parse(localStorage.getItem('mealcheck:'+key)||'null')??fallback;}catch{return fallback;}}
export function saveDevicePref(key:string,value:any){try{localStorage.setItem('mealcheck:'+key,JSON.stringify(value));}catch{}}
