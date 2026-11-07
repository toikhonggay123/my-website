import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {shield,classifyRequest,clientKey,SHIELD_BUCKETS,ENROLL_GLOBAL_BINDING} from '../lib/shield.mjs';

const origin='https://edu.afyllx.com';
// Fixed-window fake of the Workers Rate Limiting binding.
function limiter(limit){const seen=new Map(),keys=[];return {keys,async limit({key}){keys.push(key);const n=(seen.get(key)||0)+1;seen.set(key,n);return {success:n<=limit};}};}
const req=(path,{method='GET',ip='203.0.113.7'}={})=>new Request(origin+path,{method,headers:ip?{'CF-Connecting-IP':ip}:{}});

test('routes are classified so polling, scans, exports and enrollment get separate budgets',()=>{
 const c=(p,m='GET')=>classifyRequest(new URL(origin+p),m);
 assert.equal(c('/mealcheck'),'page');assert.equal(c('/_next/x.js'),'page');
 assert.equal(c('/api/board'),'read');assert.equal(c('/api/records'),'read');assert.equal(c('/api/qr/card-preview'),'read');
 assert.equal(c('/api/qr/scan','POST'),'write');assert.equal(c('/api/decide','POST'),'write');
 for(const p of ['export','export/today','daily','audit','qr/cards','devices'])assert.equal(c('/api/'+p),'heavy');
 assert.equal(c('/api/device/start','POST'),'enroll');assert.equal(c('/api/qr/scanner/start/','POST'),'enroll');
});

test('client keys group IPv6 by /64 and keep IPv4 per address',()=>{
 assert.equal(clientKey('203.0.113.7'),'203.0.113.7');
 assert.equal(clientKey('2001:db8:1:2:aaaa::1'),'2001:db8:1:2::/64');
 assert.equal(clientKey('2001:0DB8:0001:0002:ffff:1:2:3'),'2001:db8:1:2::/64');
 assert.equal(clientKey('2001:db8::1'),'2001:db8:0:0::/64');
 assert.equal(clientKey('::ffff:198.51.100.9'),'198.51.100.9');
 assert.equal(clientKey(''),'unknown');assert.equal(clientKey(null),'unknown');
 assert.match(clientKey('not-an-ip'),/^raw:/);
});

test('without bindings (local loopback app) the shield never blocks',async()=>{
 for(let i=0;i<50;i++)assert.equal(await shield(req('/api/board'),{}),null);
});

test('a flooding client gets 429 with Retry-After while another client continues',async()=>{
 const env={RL_READ:limiter(3)};
 for(let i=0;i<3;i++)assert.equal(await shield(req('/api/board'),env),null);
 const res=await shield(req('/api/board'),env);
 assert.equal(res.status,429);assert.equal(res.headers.get('Retry-After'),String(SHIELD_BUCKETS.read.period));
 assert.equal(res.headers.get('Cache-Control'),'no-store');assert.match((await res.json()).error,/Quá nhiều/);
 assert.equal(await shield(req('/api/board',{ip:'198.51.100.1'}),env),null);
 assert.ok(env.RL_READ.keys.every(k=>k.startsWith('read:')));
});

test('scan writes are limited separately from reads, so polling cannot starve scans',async()=>{
 const env={RL_READ:limiter(1),RL_WRITE:limiter(5)};
 await shield(req('/api/board'),env);assert.equal((await shield(req('/api/board'),env)).status,429);
 assert.equal(await shield(req('/api/qr/scan',{method:'POST'}),env),null);
});

test('blocked pages answer as plain text, not JSON',async()=>{
 const res=await shield(req('/mealcheck'),{RL_PAGE:limiter(0)});
 assert.equal(res.status,429);assert.match(res.headers.get('Content-Type'),/text\/plain/);
});

test('a distributed flood on device/start hits the global cap without blocking scanner enrollment',async()=>{
 const env={RL_ENROLL:limiter(100),[ENROLL_GLOBAL_BINDING]:limiter(2)};
 for(let i=0;i<2;i++)assert.equal(await shield(req('/api/device/start',{method:'POST',ip:'192.0.2.'+i}),env),null);
 assert.equal((await shield(req('/api/device/start',{method:'POST',ip:'192.0.2.99'}),env)).status,503);
 assert.equal(await shield(req('/api/qr/scanner/start',{method:'POST',ip:'192.0.2.99'}),env),null);
});

test('limiter outages fail open; oversized URLs and odd API methods are rejected cheaply',async()=>{
 assert.equal(await shield(req('/api/board'),{RL_READ:{limit:async()=>{throw Error('down');}}}),null);
 assert.equal((await shield(req('/api/board?q='+'x'.repeat(5000)),{})).status,414);
 assert.equal((await shield(req('/api/board',{method:'DELETE'}),{})).status,405);
});

test('live cloud config declares every shield binding with a supported period',()=>{
 const config=JSON.parse(fs.readFileSync('wrangler.cloud.jsonc','utf8'));
 const names=new Map((config.ratelimits||[]).map(r=>[r.name,r]));
 for(const name of [...Object.values(SHIELD_BUCKETS).map(b=>b.binding),ENROLL_GLOBAL_BINDING]){
  const r=names.get(name);assert.ok(r,name+' missing');assert.ok([10,60].includes(r.simple.period));assert.ok(r.simple.limit>0);
 }
 for(const b of Object.values(SHIELD_BUCKETS))assert.equal(names.get(b.binding).simple.period,b.period);
 assert.equal(new Set(config.ratelimits.map(r=>r.namespace_id)).size,config.ratelimits.length);
 const local=JSON.parse(fs.readFileSync('wrangler.jsonc','utf8'));assert.equal(local.ratelimits,undefined,'local loopback app stays unlimited');
});
