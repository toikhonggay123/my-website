import test from 'node:test';
import assert from 'node:assert/strict';
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
test('live cloud scanner cookies do not reuse stale demo identities; local revocation identity stays unchanged',()=>{
 const live=deploymentPolicy(new URL('https://'+host),env);
 assert.deepEqual(deploymentCookies(live),{device:'mc_device_live',scanner:'mc_scanner_live'});
 assert.deepEqual(deploymentCookies({liveOnly:false}),{device:'mc_device',scanner:'mc_scanner'});
});
