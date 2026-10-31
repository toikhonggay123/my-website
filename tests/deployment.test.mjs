import test from 'node:test';
import assert from 'node:assert/strict';
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
