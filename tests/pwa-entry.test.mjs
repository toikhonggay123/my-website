import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function worker(){
 const listeners={},added=[],shell=new Response('<main>MealCheck</main>',{headers:{'Content-Type':'text/html'}});
 const context={URL,Promise,Error,self:{location:{origin:'https://edu.afyllx.com'},addEventListener:(type,handler)=>listeners[type]=handler},
  fetch:async url=>{if(url==='/precache.json')return new Response(JSON.stringify(['/_next/static/scanner.js']));throw Error('Offline');},
  caches:{open:async()=>({addAll:async urls=>added.push(...urls)}),match:async key=>key==='/mealcheck'?shell:undefined}};
 vm.runInNewContext(fs.readFileSync('public/sw.js','utf8'),context);
 return {listeners,added,shell};
}

test('PWA installation prepares the new entry and both legacy shells without caching APIs',async()=>{
 const {listeners,added}=worker();let done;listeners.install({waitUntil:promise=>done=promise});await done;
 for(const path of ['/mealcheck','/mealcheck/cai-dat','/quan-tri','/cai-dat','/_next/static/scanner.js'])assert.ok(added.includes(path),path);
 assert.ok(!added.some(path=>path.startsWith('/api/')));
});

test('new scanner deep link opens its cached dashboard offline while mutations bypass the cache',async()=>{
 const {listeners,shell}=worker();let response;
 listeners.fetch({request:{method:'GET',mode:'navigate',url:'https://edu.afyllx.com/mealcheck?tab=scanner'},respondWith:promise=>response=promise});
 assert.equal(await response,shell);
 for(const request of [
  {method:'POST',mode:'cors',url:'https://edu.afyllx.com/api/qr/scan'},
  {method:'GET',mode:'navigate',url:'https://edu.afyllx.com/api/students'},
  {method:'GET',mode:'navigate',url:'https://other.example.test/mealcheck'}
 ])listeners.fetch({request,respondWith:()=>assert.fail('Sensitive or cross-origin response intercepted')});
});
