import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {enqueueScan,syncScans} from '../lib/offline-queue.mjs';
const fixture=()=>{const rows=new Map();return {get:async k=>rows.get(k),all:async()=>[...rows.values()],put:async r=>rows.set(r.key,structuredClone(r)),remove:async k=>rows.delete(k)};};
const scan={space:'demo',token:'AFYLLX:1:opaque-test-ciphertext',sessionId:'demo:2026-10-31:sang'};
test('offline QR remains pending without claiming success, deduplicates per meal and survives a lost server reply',async()=>{
 const store=fixture(),first=await enqueueScan(store,scan,1);assert.equal((await enqueueScan(store,scan,2)).id,first.id);assert.equal((await store.all()).length,1);
 let ack=0,calls=0;
 await syncScans(store,async()=>{calls++;throw Error('connection lost after server recorded');},()=>ack++);assert.equal(ack,0);assert.equal((await store.all()).length,1);
 await syncScans(store,async row=>{assert.equal(row.id,first.id);calls++;return {ok:true,status:200,data:{status:'already',duplicate:true}};},()=>ack++);
 assert.equal(calls,2);assert.equal(ack,1);assert.equal((await store.all()).length,0);
});
test('server errors retain pending scans; revoked/tampered/previous-day scans stay failed for review',async()=>{
 const store=fixture();await enqueueScan(store,scan);
 await syncScans(store,async()=>({ok:false,status:503}));assert.equal((await store.all())[0].state,'pending');
 await syncScans(store,async()=>({ok:false,status:409,data:{error:'Phiên cũ hoặc thiết bị đã thu hồi'}}));assert.equal((await store.all())[0].state,'failed');
 let calls=0;await syncScans(store,async()=>{calls++;});assert.equal(calls,0);assert.equal((await store.all()).length,1);
});
test('different spaces/meals stay separate; nothing sends while offline; failed local storage never acknowledges',async()=>{
 const store=fixture();await enqueueScan(store,scan);await enqueueScan(store,{...scan,sessionId:'demo:2026-10-31:trua'});assert.equal((await store.all()).length,2);
 let calls=0;await syncScans(store,async()=>{calls++;},()=>{},()=>false);assert.equal(calls,0);
 await assert.rejects(()=>enqueueScan(store,{...scan,sessionId:'live:2026-10-31:sang'}));
 await assert.rejects(()=>enqueueScan({...store,put:async()=>{throw Error('storage full');}},{...scan,sessionId:'demo:2026-10-31:toi'}),/storage full/);
});
test('PWA cache explicitly excludes APIs and mutations, manifest has Android/iOS assets',()=>{
 const sw=fs.readFileSync('public/sw.js','utf8');assert.match(sw,/req.method!=='GET'/);assert.match(sw,/url.pathname.startsWith\('\/api\/'\)/);
 const manifest=JSON.parse(fs.readFileSync('public/manifest.webmanifest','utf8'));assert.equal(manifest.display,'standalone');assert.equal(manifest.scope,'/');assert.ok(manifest.start_url.startsWith('/quan-tri'));
 for(const size of ['192x192','512x512'])assert.ok(manifest.icons.some(icon=>icon.sizes===size&&fs.existsSync('public'+icon.src)));
 assert.ok(fs.existsSync('public/icons/apple-touch-icon.png'));
});
test('temporary HTTP failures remain pending and retry with the original id',async()=>{
 for(const status of [408,425,429]){
  const store=fixture(),row=await enqueueScan(store,scan);let ack=0;
  await syncScans(store,async()=>({ok:false,status,data:{error:'Thử lại sau'}}),()=>ack++);
  assert.equal((await store.all())[0].state,'pending');assert.equal(ack,0);
  await syncScans(store,async retry=>{assert.equal(retry.id,row.id);return {ok:true,status:200,data:{status:'recorded'}};},()=>ack++);
  assert.equal(ack,1);assert.equal((await store.all()).length,0);
 }
});
