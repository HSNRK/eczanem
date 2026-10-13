const CACHE='eczanem-v2';
self.addEventListener('install',e=>{self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET'||!e.request.url.startsWith(self.location.origin))return;
  const url=new URL(e.request.url);
  if(url.pathname.endsWith('/')||url.pathname.endsWith('index.html')){
    e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));
    return;
  }
  e.respondWith(caches.open(CACHE).then(c=>c.match(e.request).then(hit=>hit||fetch(e.request).then(res=>{c.put(e.request,res.clone());return res}))));
});
self.addEventListener('push',e=>{let d={title:'ECZANEM',body:''};try{d=JSON.parse(e.data?e.data.text():'{}')}catch(e){}e.waitUntil(self.registration.showNotification(d.title||'ECZANEM',{body:d.body||'',icon:'logo.png',badge:'logo.png'}))});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(l=>{if(l[0]){l[0].focus();if(l[0].navigate)l[0].navigate('./')}else self.clients.openWindow('./')}))});