import {createScanStore} from '../lib/scan-storage.mjs';
import {drainScans,SCAN_SYNC_TAG} from '../lib/offline-queue.mjs';

const store=createScanStore(self.indexedDB);
self.addEventListener('sync',event=>{
 if(event.tag!==SCAN_SYNC_TAG)return;
 event.waitUntil((async()=>{
  const changes=[];
  const retry=await drainScans(store,(type,detail)=>changes.push({type,detail}));
  if(changes.length){
   const clients=await self.clients.matchAll({type:'window'});
   for(const client of clients){
    if(['/mealcheck','/quan-tri'].includes(new URL(client.url).pathname))client.postMessage({type:'mealcheck-scan-sync',changes});
   }
  }
  if(retry)throw Error('Scan sync needs a later retry');
 })());
});
