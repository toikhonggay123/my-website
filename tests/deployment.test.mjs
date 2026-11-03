import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {deploymentPolicy,deploymentSpace,allowDemoOperation} from '../lib/deployment.mjs';
const host='mealcheck-demo.example.test',demo={MEALCHECK_DEPLOYMENT:'cloud-demo',MEALCHECK_PUBLIC_HOST:host};
test('local policy remains loopback-only and defaults to real local data',()=>{
  for(const hostname of ['localhost','127.0.0.1','[::1]']){
    const url=new URL('http://'+hostname+':3000/api/identity'),policy=deploymentPolicy(url);
    assert.equal(policy.demoOnly,false);assert.equal(deploymentSpace(url,policy),'live');
  }
  assert.throws(()=>deploymentPolicy(new URL('https://'+host)),/localhost/);
  assert.throws(()=>deploymentPolicy(new URL('http://192.168.1.2')),/localhost/);
});
test('cloud demo requires an explicit HTTPS host and cannot select live',()=>{
  const url=new URL('https://'+host+'/api/board'),policy=deploymentPolicy(url,demo);
  assert.equal(policy.demoOnly,true);assert.equal(deploymentSpace(url,policy),'demo');
  url.searchParams.set('space','live');assert.throws(()=>deploymentSpace(url,policy),/giả lập/);
  url.searchParams.set('space','invalid');assert.throws(()=>deploymentSpace(url,policy),/không hợp lệ/);
  assert.throws(()=>deploymentPolicy(new URL('https://other.example.test'),demo),/Địa chỉ/);
  assert.throws(()=>deploymentPolicy(new URL('http://'+host),demo),/Địa chỉ/);
  assert.throws(()=>deploymentPolicy(new URL('https://'+host),{MEALCHECK_DEPLOYMENT:'cloud-demo'}),/Địa chỉ/);
  assert.throws(()=>deploymentPolicy(new URL('http://localhost'),{MEALCHECK_DEPLOYMENT:'unknown'}),/Cấu hình/);
});
test('cloud demo rejects roster uploads while retaining synthetic seed and QR operations',()=>{
  const policy=deploymentPolicy(new URL('https://'+host),demo);
  assert.throws(()=>allowDemoOperation(policy,'students','POST'),/không nhận danh sách/);
  for(const [route,method] of [['students','GET'],['seed','POST'],['qr/scan','POST']])assert.doesNotThrow(()=>allowDemoOperation(policy,route,method));
  assert.doesNotThrow(()=>allowDemoOperation({demoOnly:false},'students','POST'));
});

test('configured live domain and legacy host work while unlisted hosts and HTTP remain blocked',()=>{
  const config=JSON.parse(fs.readFileSync(new URL('../wrangler.cloud.jsonc',import.meta.url),'utf8'));
  assert.equal(config.vars.MEALCHECK_PUBLIC_HOST,'edu.afyllx.com');
  assert.ok(config.routes.some(route=>route.pattern==='afyllx.com'&&route.custom_domain===true));
  // Edu root belongs to the portal gateway, which calls this Worker over a service binding.
  assert.equal(config.routes.some(route=>route.pattern==='edu.afyllx.com'),false);
  for(const hostname of ['edu.afyllx.com','afyllx.com','my-website.fyllxestonia.workers.dev']){
    const policy=deploymentPolicy(new URL('https://'+hostname+'/api/health'),config.vars);
    assert.equal(policy.liveOnly,true);
    assert.throws(()=>deploymentPolicy(new URL('http://'+hostname),config.vars),/Địa chỉ/);
  }
  for(const hostname of ['other.example.test','afyllx.com.evil.test','edu.afyllx.com.evil.test','www.afyllx.com','other.afyllx.com']){
    assert.throws(()=>deploymentPolicy(new URL('https://'+hostname),config.vars),/Địa chỉ/);
  }
});

test('host aliases are explicit and cannot replace the required primary host or local restrictions',()=>{
  const env={MEALCHECK_DEPLOYMENT:'cloud-live',MEALCHECK_PUBLIC_HOST:'primary.example.test',MEALCHECK_PUBLIC_HOST_ALIASES:' legacy.example.test, , other.example.test '};
  for(const host of ['primary.example.test','legacy.example.test','other.example.test']){
    assert.equal(deploymentPolicy(new URL('https://'+host),env).liveOnly,true);
  }
  assert.throws(()=>deploymentPolicy(new URL('https://legacy.example.test'),{...env,MEALCHECK_PUBLIC_HOST:''}),/Địa chỉ/);
  assert.throws(()=>deploymentPolicy(new URL('https://legacy.example.test'),{...env,MEALCHECK_DEPLOYMENT:'local'}),/localhost/);
});
