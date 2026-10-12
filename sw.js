const CACHE='eczanem-v1';
self.addEventListener('install',e=>{self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET'||!e.request.url.startsWith(self.location.origin))return;
  e.respondWith(caches.open(CACHE).then(c=>c.match(e.request).then(hit=>hit||fetch(e.request).then(res=>{c.put(e.request,res.clone());return res}))));
});