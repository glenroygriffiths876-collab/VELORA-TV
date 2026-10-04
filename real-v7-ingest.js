// Velora V7 — Mass Ingest control plane
const V7_BACKEND_KEY='velora_backend_base';
const V7_DEFAULT_BACKEND='https://velora-tv-api-production.up.railway.app';

function v7BackendBase(){
  return (localStorage.getItem(V7_BACKEND_KEY)||V7_DEFAULT_BACKEND).trim().replace(/\/$/,'');
}
function v7Api(path){
  const base=v7BackendBase();
  return (base||location.origin)+path;
}
async function v7Request(path,options={}){
  const r=await fetch(v7Api(path),{...options,headers:{'content-type':'application/json',...(options.headers||{})}});
  const ct=r.headers.get('content-type')||'';
  const body=ct.includes('application/json')?await r.json():{error:await r.text()};
  if(!r.ok)throw new Error(body.error||('HTTP '+r.status));
  return body;
}
function v7StatusBadge(ok,text){
  return '<span class="v7Status '+(ok?'ok':'off')+'"><i></i>'+esc(text)+'</span>';
}
async function v7CheckBackend(){
  const box=document.getElementById('v7EngineStatus');if(box)box.innerHTML=v7StatusBadge(false,'Checking…');
  try{
    const d=await v7Request('/api/system/status',{headers:{}});
    if(box)box.innerHTML=v7StatusBadge(true,'V7 online')+
      '<small>'+d.stats.providers+' providers • '+d.stats.channels+' channels • '+d.stats.movies+' movies • '+d.stats.series+' series</small>';
    const stat=document.getElementById('v7MassStats');
    if(stat)stat.innerHTML=
      '<div><b>'+Number(d.stats.channels||0).toLocaleString()+'</b><span>Channels</span></div>'+
      '<div><b>'+Number(d.stats.movies||0).toLocaleString()+'</b><span>Movies</span></div>'+
      '<div><b>'+Number(d.stats.series||0).toLocaleString()+'</b><span>Series</span></div>'+
      '<div><b>'+Number(d.stats.sourceAssets||0).toLocaleString()+'</b><span>Source assets</span></div>'+
      '<div><b>'+Number(d.stats.duplicatesMerged||0).toLocaleString()+'</b><span>Duplicates merged</span></div>'+
      '<div><b>'+Number(d.stats.unhealthySources||0).toLocaleString()+'</b><span>Unhealthy</span></div>';
    return d;
  }catch(e){
    if(box)box.innerHTML=v7StatusBadge(false,'Backend offline')+'<small>'+esc(e.message||'Not connected')+'</small>';
    return null;
  }
}
function v7ProviderToLocal(p){
  return {id:p.id,name:p.name,type:p.type,territory:p.territory||'WORLD',priority:Number(p.priority||50),status:p.status||'active',lastSync:p.lastSync||'',refreshMinutes:p.refreshMinutes||30};
}
function v7ApplySnapshot(d){
  if(!d)return;
  state.providers=(d.providers||[]).map(v7ProviderToLocal);
  state.channels=(d.channels||[]).map(x=>({
    ...x,
    sources:(x.sources||[]).map(s=>({...s,sourceId:s.sourceId||s.providerId,sourceName:s.sourceName||s.providerName}))
  }));
  state.catalog=(d.catalog||[]).map(x=>({
    ...x,
    sources:(x.sources||[]).map(s=>({...s,sourceId:s.sourceId||s.providerId,sourceName:s.sourceName||s.providerName}))
  }));
  persist();renderAll();
}
async function v7LoadSnapshot(showToast=true){
  try{
    const d=await v7Request('/api/catalogue',{headers:{}});
    v7ApplySnapshot(d);
    if(showToast)toast('Loaded '+(d.stats?.channels||0)+' channels and '+(d.stats?.vod||0)+' VOD titles');
    return d;
  }catch(e){if(showToast)toast('Backend snapshot failed: '+e.message);throw e}
}
function v7Busy(btn,on,label){
  if(!btn)return;
  if(on){btn.dataset.oldText=btn.textContent;btn.disabled=true;btn.textContent=label||'Working…'}
  else{btn.disabled=false;btn.textContent=btn.dataset.oldText||btn.textContent}
}
async function v7ConnectXtream(){
  const btn=document.getElementById('v7XtreamConnect');
  const payload={
    name:document.getElementById('v7Name')?.value.trim()||'Main Provider',
    serverUrl:document.getElementById('v7Server')?.value.trim(),
    username:document.getElementById('v7User')?.value.trim(),
    password:document.getElementById('v7Pass')?.value||'',
    territory:(document.getElementById('v7Territory')?.value.trim()||'WORLD').toUpperCase(),
    priority:Number(document.getElementById('v7Priority')?.value||80),
    refreshMinutes:Number(document.getElementById('v7Refresh')?.value||30)
  };
  if(!payload.serverUrl||!payload.username||!payload.password)return toast('Enter server URL, username and password.');
  v7Busy(btn,true,'Importing entire provider…');
  try{
    const d=await v7Request('/api/providers/xtream/connect',{method:'POST',body:JSON.stringify(payload)});
    await v7LoadSnapshot(false);renderAdmin();
    toast('Imported '+d.channels.length+' channels and '+d.catalog.length+' movies/series');
  }catch(e){toast(e.message||'Provider import failed')}
  finally{v7Busy(btn,false);v7CheckBackend()}
}
async function v7ConnectM3U(){
  const btn=document.getElementById('v7M3uConnect');
  const payload={
    name:document.getElementById('v7M3uName')?.value.trim()||'Remote M3U',
    playlistUrl:document.getElementById('v7M3uUrl')?.value.trim(),
    territory:(document.getElementById('v7M3uTerritory')?.value.trim()||'WORLD').toUpperCase(),
    priority:Number(document.getElementById('v7M3uPriority')?.value||60),
    refreshMinutes:Number(document.getElementById('v7M3uRefresh')?.value||30)
  };
  if(!payload.playlistUrl)return toast('Enter the remote M3U/M3U8 URL.');
  v7Busy(btn,true,'Importing playlist…');
  try{
    const d=await v7Request('/api/providers/m3u/connect',{method:'POST',body:JSON.stringify(payload)});
    await v7LoadSnapshot(false);renderAdmin();toast('Imported '+d.channels.length+' channels');
  }catch(e){toast(e.message||'M3U import failed')}
  finally{v7Busy(btn,false);v7CheckBackend()}
}
async function v7SyncAll(){
  const btn=document.getElementById('v7SyncAll');v7Busy(btn,true,'Refreshing every provider…');
  try{
    const d=await v7Request('/api/providers/sync-all',{method:'POST',body:'{}'});
    await v7LoadSnapshot(false);renderAdmin();
    const ok=d.results.filter(x=>x.ok).length;
    toast('Refresh complete: '+ok+'/'+d.results.length+' providers synced');
  }catch(e){toast(e.message||'Sync failed')}
  finally{v7Busy(btn,false);v7CheckBackend()}
}
async function v7HealthScan(){
  const btn=document.getElementById('v7HealthScan');v7Busy(btn,true,'Checking streams…');
  try{
    const d=await v7Request('/api/health/scan',{method:'POST',body:JSON.stringify({limit:500})});
    toast('Health scan: '+d.up+' up • '+d.down+' down • '+d.checked+' checked');v7CheckBackend();
  }catch(e){toast(e.message||'Health scan failed')}
  finally{v7Busy(btn,false)}
}
function v7SaveBackend(){
  const u=document.getElementById('v7BackendUrl')?.value.trim()||V7_DEFAULT_BACKEND;
  localStorage.setItem(V7_BACKEND_KEY,u.replace(/\/$/,''));
  toast('Backend URL saved');
  v7CheckBackend();
}

const v7PreviousAdmin=renderAdmin;
renderAdmin=function(){
  v7PreviousAdmin();
  const page=document.querySelector('#view-admin .contentPage');if(!page)return;
  const backend=v7BackendBase();
  const section=document.createElement('section');
  section.className='v7IngestShell';
  section.innerHTML=`
    <div class="v7IngestHero">
      <div><span class="heroEyebrow">VELORA INGEST V7</span><h1>Mass Catalogue Engine</h1><p>One connection can ingest thousands of live channels, movies and series, normalize them, merge duplicates, keep credentials on the server and refresh automatically.</p></div>
      <div id="v7EngineStatus">${v7StatusBadge(false,'Checking…')}</div>
    </div>

    <div class="v7MassStats" id="v7MassStats">
      <div><b>—</b><span>Channels</span></div><div><b>—</b><span>Movies</span></div><div><b>—</b><span>Series</span></div>
      <div><b>—</b><span>Source assets</span></div><div><b>—</b><span>Duplicates merged</span></div><div><b>—</b><span>Unhealthy</span></div>
    </div>

    <div class="v7Actions">
      <button class="primary" id="v7LoadSnapshot">Load backend catalogue</button>
      <button class="ghost" id="v7SyncAll">↻ Sync all providers</button>
      <button class="ghost" id="v7HealthScan">♡ Health scan (500)</button>
    </div>

    <div class="v7Grid">
      <section class="panel">
        <h2>Backend connection</h2>
        <p>GitHub Pages is the customer frontend. Point it at the V7 Node backend when deployed.</p>
        <div class="formGrid">
          <input id="v7BackendUrl" value="${esc(backend)}" placeholder="https://api.your-velora-domain.com">
          <button class="ghost full" id="v7SaveBackend">Save backend URL</button>
        </div>
        <small class="v7Hint">Leave blank when running <code>node server.mjs</code> on the same origin.</small>
      </section>

      <section class="panel">
        <h2>Mass Xtream import</h2>
        <p>Imports Live TV + VOD movies + series in one sync.</p>
        <div class="formGrid">
          <input id="v7Name" value="Main Provider" placeholder="Provider name">
          <input id="v7Server" placeholder="https://provider.example">
          <input id="v7User" placeholder="Username">
          <input id="v7Pass" type="password" placeholder="Password">
          <input id="v7Territory" value="WORLD" placeholder="Territory">
          <input id="v7Priority" type="number" min="1" max="100" value="80" placeholder="Priority">
          <input id="v7Refresh" type="number" min="5" value="30" placeholder="Refresh minutes">
          <button class="primary full" id="v7XtreamConnect">Import entire provider</button>
        </div>
      </section>

      <section class="panel">
        <h2>Remote M3U auto-refresh</h2>
        <p>Connect a playlist URL once. V7 re-downloads it on its refresh schedule.</p>
        <div class="formGrid">
          <input id="v7M3uName" value="Remote Playlist" placeholder="Provider name">
          <input id="v7M3uUrl" placeholder="https://provider.example/playlist.m3u">
          <input id="v7M3uTerritory" value="WORLD" placeholder="Territory">
          <input id="v7M3uPriority" type="number" min="1" max="100" value="60" placeholder="Priority">
          <input id="v7M3uRefresh" type="number" min="5" value="30" placeholder="Refresh minutes">
          <button class="primary full" id="v7M3uConnect">Connect & import playlist</button>
        </div>
      </section>

      <section class="panel v7Pipeline">
        <h2>What V7 does automatically</h2>
        <div class="v7FeatureList">
          <span>✓ Live + Movies + Series</span><span>✓ Scheduled re-sync</span><span>✓ Duplicate title merge</span>
          <span>✓ Multiple sources per title</span><span>✓ Source priority</span><span>✓ Stream health checks</span>
          <span>✓ Server-side credentials</span><span>✓ Persistent catalogue</span><span>✓ Playback proxy</span>
        </div>
      </section>
    </div>
  `;
  page.prepend(section);
  setTimeout(v7CheckBackend,0);
};

document.addEventListener('click',e=>{
  if(e.target.id==='v7SaveBackend'){e.preventDefault();v7SaveBackend();return}
  if(e.target.id==='v7XtreamConnect'){e.preventDefault();v7ConnectXtream();return}
  if(e.target.id==='v7M3uConnect'){e.preventDefault();v7ConnectM3U();return}
  if(e.target.id==='v7SyncAll'){e.preventDefault();v7SyncAll();return}
  if(e.target.id==='v7HealthScan'){e.preventDefault();v7HealthScan();return}
  if(e.target.id==='v7LoadSnapshot'){e.preventDefault();v7LoadSnapshot();return}
},true);

if(state.user&&document.getElementById('view-admin')?.classList.contains('active'))renderAdmin();
