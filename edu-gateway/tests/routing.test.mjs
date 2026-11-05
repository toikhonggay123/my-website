import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{isMealCheckPath} from '../worker/index.mjs';
test('portal and its product page do not collide with the real application',()=>{
 for(const path of ['/','/he-sinh-thai','/san-pham/mealcheck','/contact','/assets/portal.js','/brand/afyllx-edu-mark.png','/mealcheck-guide'])assert.equal(isMealCheckPath(path),false,path);
 for(const path of ['/mealcheck','/mealcheck/','/mealcheck/cai-dat','/api/health','/api/qr/scan','/_next/static/scanner.js','/icons/edtech-icon-192.png','/sw.js','/manifest.webmanifest','/precache.json','/install-qr.svg','/quan-tri','/cai-dat','/xuat-excel'])assert.equal(isMealCheckPath(path),true,path);
});
test('API proxy preserves the original request, CSRF origin, query, body, cookie and response',async()=>{
 const req=new Request('https://edu.afyllx.com/api/qr/scan?space=live',{method:'POST',headers:{Origin:'https://edu.afyllx.com',Cookie:'qa=fixture','Content-Type':'application/json'},body:JSON.stringify({id:'fixture-only'})});
 const res=new Response('fixture',{headers:{'Set-Cookie':'qa=next; Path=/; HttpOnly','Content-Disposition':'attachment; filename=report.xls'}});
 const out=await worker.fetch(req,{MEALCHECK:{fetch:async incoming=>{assert.equal(incoming,req);assert.equal(incoming.headers.get('Origin'),'https://edu.afyllx.com');assert.deepEqual(await incoming.json(),{id:'fixture-only'});return res;}},ASSETS:{fetch:()=>assert.fail('API reached SPA assets')}});
 assert.equal(out,res);assert.match(out.headers.get('Set-Cookie'),/HttpOnly/);assert.match(out.headers.get('Content-Disposition'),/report.xls/);
});
test('SPA navigation reaches portal assets; application outage never becomes a successful HTML response',async()=>{
 const asset=new Response('<h1>Edu</h1>');assert.equal(await worker.fetch(new Request('https://edu.afyllx.com/san-pham/mealcheck'),{ASSETS:{fetch:async()=>asset}}),asset);
 const failed=await worker.fetch(new Request('https://edu.afyllx.com/api/health'),{ASSETS:{fetch:()=>assert.fail('API fell through')}});assert.equal(failed.status,503);assert.equal(failed.headers.get('Cache-Control'),'no-store');
});
test('ClassHub keeps its namespace while the service receives the original origin and API payload',async()=>{
 const origin='https://edu.afyllx.com';
 const request=new Request(origin+'/classhub/api/v1/activate?example=1',{
  method:'POST',headers:{Origin:origin,Cookie:'fixture=session','Content-Type':'application/json'},
  body:JSON.stringify({fixture:true}),
 });
 const response=new Response('fixture',{headers:{'Set-Cookie':'fixture=session; Path=/classhub; Secure; HttpOnly'}});
 const env={
  CLASSHUB:{fetch:async incoming=>{
   assert.equal(incoming.url,origin+'/api/v1/activate?example=1');
   assert.equal(incoming.method,'POST');
   assert.equal(incoming.headers.get('Origin'),origin);
   assert.equal(incoming.headers.get('Cookie'),'fixture=session');
   assert.deepEqual(await incoming.json(),{fixture:true});
   return response;
  }},
  ASSETS:{fetch:async()=>new Response('portal')},
  MEALCHECK:{fetch:()=>assert.fail('ClassHub reached MealCheck')},
 };
 assert.equal(await worker.fetch(request,env),response);
 for(const [path,target] of [['/classhub','/'],['/classhub/','/'],['/classhub/assets/app.js','/assets/app.js'],['/classhub/w/example','/w/example']]){
  const result=await worker.fetch(new Request(origin+path),{...env,CLASSHUB:{fetch:incoming=>new Response(new URL(incoming.url).pathname)}});
  assert.equal(await result.text(),target);
 }
 assert.equal(await (await worker.fetch(new Request(origin+'/classhub-not-an-app'),env)).text(),'portal');
});
