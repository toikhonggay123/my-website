import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {deploymentPolicy,deploymentSpace,allowDemoOperation,deploymentCookies} from '../lib/deployment.mjs';
const host='mealcheck-live.example.test',env={MEALCHECK_DEPLOYMENT:'cloud-live',MEALCHECK_PUBLIC_HOST:host};
test('public live cloud uses only live data and rejects demo seeding',()=>{
 const url=new URL('https://'+host+'/api/board'),policy=deploymentPolicy(url,env);
 assert.equal(policy.publicCloud,true);assert.equal(policy.demoOnly,false);assert.equal(policy.liveOnly,true);
 assert.equal(deploymentSpace(url,policy),'live');
 url.searchParams.set('space','demo');assert.throws(()=>deploymentSpace(url,policy),/thử nghiệm/);
 for(const method of ['POST','GET'])assert.throws(()=>allowDemoOperation(policy,'seed',method),/thử nghiệm/);
 assert.doesNotThrow(()=>allowDemoOperation(policy,'students','POST'));
 assert.throws(()=>deploymentPolicy(new URL('https://other.example.test'),env),/Địa chỉ/);
 assert.throws(()=>deploymentPolicy(new URL('http://'+host),env),/Địa chỉ/);
});
test('public hosts do not enroll anonymous student kiosks; local enrollment and enrolled kiosks keep working',()=>{
 const live=deploymentPolicy(new URL('https://'+host),env),demo=deploymentPolicy(new URL('https://demo.example.test'),{MEALCHECK_DEPLOYMENT:'cloud-demo',MEALCHECK_PUBLIC_HOST:'demo.example.test'});
 for(const policy of [live,demo])for(const method of ['POST','GET']){
  assert.throws(()=>allowDemoOperation(policy,'device/start',method),e=>e.status===404&&/Không tìm thấy chức năng/.test(e.message));
 }
 for(const route of ['kiosk/state','kiosk/roster','kiosk/request','qr/scanner/start'])assert.doesNotThrow(()=>allowDemoOperation(live,route,'POST'));
 const local=deploymentPolicy(new URL('http://127.0.0.1:3000/api/device/start'));
 assert.doesNotThrow(()=>allowDemoOperation(local,'device/start','POST'));
 // The route guard runs before cookies are read or a device row is inserted.
 const source=fs.readFileSync(new URL('../app/api/[...path]/route.ts',import.meta.url),'utf8');
 assert.ok(source.indexOf('allowDemoOperation(policy,route,req.method)')<source.indexOf("route==='device/start'"));
});
test('Workers Logs are enabled for live and runtime code never logs request data itself',()=>{
 const config=JSON.parse(fs.readFileSync(new URL('../wrangler.cloud.jsonc',import.meta.url),'utf8'));
 assert.deepEqual(config.observability,{enabled:true,head_sampling_rate:1});
 // Tokens, cookies, rosters and bodies must not reach logs through console.* calls.
 const files=dir=>fs.readdirSync(new URL('../'+dir,import.meta.url),{recursive:true}).filter(f=>/\.(m?js|tsx?)$/.test(f)).map(f=>dir+'/'+f.replace(/\\/g,'/'));
 for(const file of [...files('app'),...files('lib'),...files('worker')]){
  assert.doesNotMatch(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'),/\bconsole\.(log|info|warn|error|debug|trace|dir)\s*\(/,file);
 }
});
test('live cloud scanner cookies do not reuse stale demo identities; local revocation identity stays unchanged',()=>{
 const live=deploymentPolicy(new URL('https://'+host),env);
 assert.deepEqual(deploymentCookies(live),{device:'mc_device_live',scanner:'mc_scanner_live'});
 assert.deepEqual(deploymentCookies({liveOnly:false}),{device:'mc_device',scanner:'mc_scanner'});
});
