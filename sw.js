const CACHE='velora-shell-v14';
const SHELL=['./','./index.html','./styles.css','./real-v5.css','./app.js','./real-v5-data.js','./real-v5-home.js','./real-v5-live.js','./real-v5-runtime.js','./real-v6.css','./real-v6-media.js','./real-v6-ui.js','./real-v7.css?v=12','./real-v7-ingest.js?v=12','./real-v8-vod.css?v=2','./real-v8-vod.js?v=2','./manifest.json'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);
  if(u.origin!==location.origin||u.pathname.startsWith('/api/'))return;
  e.respondWith(fetch(e.request).then(res=>{
    const copy=res.clone();
    caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{});
    return res;
  }).catch(()=>caches.match(e.request)));
});
