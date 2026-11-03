const BUILD='development';
const CACHE='mealcheck-pwa-v9-'+BUILD;
const PUBLIC=['/brand/edtech-mark.png','/icons/edtech-favicon-32.png','/offline.html','/manifest.webmanifest','/icons/edtech-icon-192.png','/icons/edtech-icon-512.png','/icons/edtech-icon-maskable-512.png','/icons/edtech-apple-touch-icon.png','/install-qr.svg'];
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const response=await fetch('/precache.json',{cache:'no-store'});if(!response.ok)throw Error('PWA asset list unavailable');
 const assets=await response.json();if(!Array.isArray(assets)||!assets.length||assets.some(path=>typeof path!=='string'||!/^\/_next\/static\/[-\w/.]+\.(js|css)$/.test(path)))throw Error('Invalid PWA asset list');
 const cache=await caches.open(CACHE);await cache.addAll([...PUBLIC,'/quan-tri','/cai-dat',...assets]);
})()));
self.addEventListener('activate',event=>event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('mealcheck-pwa-')&&key!==CACHE).map(key=>caches.delete(key)))),self.clients.claim()])));
self.addEventListener('message',event=>{if(event.data==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 // Never cache API responses, student data, encrypted cards, or mutation requests.
 if(req.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
 if(req.mode==='navigate'&&['/quan-tri','/cai-dat'].includes(url.pathname)){
  event.respondWith(fetch(req).then(response=>{if(response.ok&&response.headers.get('content-type')?.includes('text/html')){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(url.pathname,copy)));}return response;}).catch(async()=>await caches.match(url.pathname)||await caches.match('/offline.html')));return;
 }
 if(PUBLIC.includes(url.pathname)||url.pathname.startsWith('/_next/static/'))event.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(response=>{if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(async cache=>{await cache.put(req,copy);const keys=await cache.keys();if(keys.length>100)await cache.delete(keys.find(key=>new URL(key.url).pathname.startsWith('/_next/static/'))||keys[0]);}));}return response;})));
});
