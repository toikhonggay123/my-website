import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {withSecurityHeaders,SECURITY_HEADERS,FRAME_ANCESTORS,HSTS} from '../lib/security-headers.mjs';

const https=new Request('https://edu.afyllx.com/mealcheck'),local=new Request('http://127.0.0.1:3000/quan-tri');

test('app pages cannot be framed by other sites and get baseline browser protections',async()=>{
 const res=withSecurityHeaders(new Response('<p>ok</p>',{status:200,headers:{'Content-Type':'text/html'}}),https);
 for(const [name,value] of Object.entries(SECURITY_HEADERS))assert.equal(res.headers.get(name),value);
 assert.equal(res.headers.get('Content-Security-Policy'),FRAME_ANCESTORS);
 assert.equal(res.headers.get('Strict-Transport-Security'),HSTS);
 assert.equal(res.headers.get('Content-Type'),'text/html');assert.equal(await res.text(),'<p>ok</p>');
});

test('HSTS is only sent over HTTPS so the loopback app keeps working on plain HTTP',()=>{
 const res=withSecurityHeaders(new Response('ok'),local);
 assert.equal(res.headers.get('Strict-Transport-Security'),null);
 assert.equal(res.headers.get('X-Frame-Options'),'SAMEORIGIN');
});

test('headers chosen by a handler are never overwritten, including an existing CSP',()=>{
 const res=withSecurityHeaders(new Response('ok',{headers:{'X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'",'Referrer-Policy':'no-referrer','Strict-Transport-Security':'max-age=60'}}),https);
 assert.equal(res.headers.get('X-Frame-Options'),'DENY');
 assert.equal(res.headers.get('Content-Security-Policy'),"default-src 'self'");
 assert.equal(res.headers.get('Referrer-Policy'),'no-referrer');
 assert.equal(res.headers.get('Strict-Transport-Security'),'max-age=60');
});

test('immutable redirects keep status and location; several cookies stay separate',async()=>{
 const redirect=withSecurityHeaders(Response.redirect('https://edu.afyllx.com/mealcheck',303),https);
 assert.equal(redirect.status,303);assert.equal(redirect.headers.get('Location'),'https://edu.afyllx.com/mealcheck');
 assert.equal(redirect.headers.get('X-Frame-Options'),'SAMEORIGIN');
 const headers=new Headers({'Content-Type':'application/json'});headers.append('Set-Cookie','a=1; Path=/; HttpOnly');headers.append('Set-Cookie','b=2; Path=/; HttpOnly');
 const res=withSecurityHeaders(new Response('{"ok":true}',{status:201,statusText:'Created',headers}),https);
 assert.equal(res.status,201);assert.equal(res.statusText,'Created');
 assert.deepEqual(res.headers.getSetCookie(),['a=1; Path=/; HttpOnly','b=2; Path=/; HttpOnly']);
 assert.deepEqual(await res.json(),{ok:true});
});

test('streamed bodies pass through without buffering and empty responses stay empty',async()=>{
 let pulls=0;const stream=new ReadableStream({pull(c){pulls++;if(pulls>2)c.close();else c.enqueue(new TextEncoder().encode('chunk'+pulls+';'));}});
 const res=withSecurityHeaders(new Response(stream),https);
 assert.ok(pulls<=1,'body is not consumed while adding headers');
 assert.equal(await res.text(),'chunk1;chunk2;');
 const empty=withSecurityHeaders(new Response(null,{status:204}),https);
 assert.equal(empty.status,204);assert.equal(empty.body,null);
});

test('the Worker applies the headers to every route and static assets carry the same frame policy',()=>{
 const worker=fs.readFileSync('worker/index.ts','utf8');
 assert.match(worker,/return withSecurityHeaders\(await route\(request,env,ctx\),request\)/);
 const assets=fs.readFileSync('public/_headers','utf8');
 assert.match(assets,/^\/\*\r?\n(?: {2}.+\r?\n)+/m);
 for(const line of ['X-Frame-Options: SAMEORIGIN',"Content-Security-Policy: "+FRAME_ANCESTORS,'X-Content-Type-Options: nosniff','Referrer-Policy: strict-origin-when-cross-origin'])assert.ok(assets.includes('  '+line),line);
});
