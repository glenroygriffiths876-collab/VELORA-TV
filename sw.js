const CACHE='velora-shell-v48';
const SHELL=['./','./index.html','./styles.css','./real-v5.css','./app.js','./real-v5-data.js','./real-v5-home.js','./real-v5-live.js?v=2','./real-v5-runtime.js','./real-v6.css','./real-v6-media.js?v=2','./real-v6-ui.js','./real-v7.css?v=19','./real-v7-ingest.js?v=23','./real-v8-vod.css?v=2','./real-v8-vod.js?v=2','./real-v9-client.css?v=2','./real-v9-client.js?v=2','./tv-mode.css?v=1','./tv-mode.js?v=1','./auth.css?v=1','./auth-client.js?v=4','./ux-v11.css?v=1','./ux-v11.js?v=1','./ux-v12.css?v=1','./ux-v12.js?v=3','./ux-v13.css?v=2','./ux-v13.js?v=2','./ux-v14.css?v=2','./ux-v14.js?v=3','./ux-v15.css?v=1','./ux-v15.js?v=3','./ux-v16-live-tuning.js?v=2','./ux-v17-quiet-scan.js?v=2','./manifest.json','./install.css?v=2','./install.js?v=2','./icons/icon.svg','./icons/icon-32.png','./icons/icon-180.png','./icons/icon-192.png'];
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
