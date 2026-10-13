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
  const token=localStorage.getItem('velora_auth_token')||'';
  const publicRead=(!options.method||options.method==='GET')&&(path==='/api/catalogue'||path==='/api/discovery'||path==='/api/live/lineup');
  const headers=publicRead?{accept:'application/json'}:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})};
  const r=await fetch(v7Api(path),{...options,headers:{...headers,...(options.headers||{})}});
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
function v7MediaUrl(url){
  if(!url)return '';
  if(/^\/api\//.test(url))return v7BackendBase()+url;
  return url;
}
function v7ApplySnapshot(d,{persistSnapshot=true,background=false}={}){
  if(!d)return;
  state.providers=(d.providers||[]).map(v7ProviderToLocal);
  state.channels=(d.channels||[]).map(x=>({
    ...x,
    url:v7MediaUrl(x.url),
    sources:(x.sources||[]).map(src=>({...src,url:v7MediaUrl(src.url),sourceId:src.sourceId||src.providerId,sourceName:src.sourceName||src.providerName}))
  }));
  state.catalog=(d.catalog||[]).map(x=>({
    ...x,
    url:v7MediaUrl(x.url),
    sources:(x.sources||[]).map(src=>({...src,url:v7MediaUrl(src.url),sourceId:src.sourceId||src.providerId,sourceName:src.sourceName||src.providerName}))
  }));
  if(persistSnapshot)persist();
  window.veloraInstantGuide?.refresh?.();
  // A background catalogue refresh must not destroy/restart the current video.
  if(document.getElementById('inlineLive')&&document.getElementById('view-live')?.classList.contains('active')){
    drawChannelList(document.getElementById('channelSearch')?.value||'');
    window.veloraVerifiedGuide?.refresh?.();
    // On a first visit the official placeholder may precede the direct feed.
    // Upgrade only that same selected channel; never select a different name.
    const selected=state.currentChannel;
    if(selected&&!v7LiveCandidates(selected).length){
      const same=state.channels.find(x=>x.id===selected.id)||
        state.channels.find(x=>v7ChannelNameKey(x)===v7ChannelNameKey(selected));
      if(same&&v7LiveCandidates(same).length)selectChannel(same.id,true);
    }
  }else if(!background)renderAll();
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


function v7IsTVJ(c){
  const key=v7ChannelNameKey(c);
  return key==='tvj'||key==='television jamaica'||key==='tvj television jamaica';
}
function v7IsJamaicanChannel(c){
  const group=String(c?.group||'').trim().toLowerCase();
  const territory=String(c?.territory||'').trim().toUpperCase();
  const source=String(c?.sourceName||'').trim().toLowerCase();
  return /(^|\b)jamaica(n)?(\b|$)/i.test(group)
    || territory==='JM'
    || /(^|\b)jamaica(n)?(\b|$)/i.test(source);
}
function v7ChannelRecentlyHealthy(c){
  // A successful HTTP probe, an official TVJ name, or a source-health flag
  // cannot prove that a viewer received decodable video.
  if(!c||V7_SESSION_FAILED_IDS.has(c.id))return false;
  const played=Date.parse(c.lastPlaybackSuccessAt||0)||0;
  const failed=Date.parse(c.lastPlaybackFailureAt||0)||0;
  return played>failed&&Date.now()-played<2*3600000;
}
function v7DefaultBrowseChannels(){
  // Include all locally verified streams, including Jamaican feeds actually
  // playable from the viewer's network. No HTTP-only "healthy" shortcuts.
  if(window.veloraVerifiedChannels?.ids){
    const ids=new Set(window.veloraVerifiedChannels.ids());
    return filteredChannels().filter(c=>ids.has(c.id));
  }
  return filteredChannels().filter(v7ChannelRecentlyHealthy);
}
function v7SearchText(value){
  return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
    .replace(/[^a-z0-9]+/g,' ').replace(/\b(?:sci\s*fi|syfy)\b/g,'scifi').replace(/\s+/g,' ').trim();
}
function v7LiveMatches(q=''){
  const grp=state.currentFilter||'All',needle=v7SearchText(q);
  // Searching is intentional discovery, so search can reveal the Jamaican
  // channels hidden from the normal browse list.
  const base=needle?filteredChannels():v7DefaultBrowseChannels();
  return base.filter(c=>(grp==='All'||c.group===grp)&&(!needle||v7SearchText(c.name+' '+(c.group||'')+' '+(c.now||'')+' '+(c.sourceName||'')).includes(needle)));
}
drawChannelList=function(q=''){
  const el=document.getElementById('channelList');if(!el)return;
  const all=v7LiveMatches(q),limit=300,list=all.slice(0,limit);
  el.innerHTML=list.map(c=>`<button class="channelRow ${state.currentChannel?.id===c.id?'active':''}" data-channel="${esc(c.id)}">
    <span class="channelLogo textLogo">${esc(c.short||'TV')}</span>
    <span><b>${esc(c.name)}</b><small>${esc(c.group||'')} • ${esc(c.official?'Official source':c.sourceName||'Public/connected feed')}</small></span>
    <span class="channelNum">${esc(c.num||'')}</span>
  </button>`).join('')+
  (all.length>limit?`<div class="v7ListMore">Showing ${limit.toLocaleString()} of ${all.length.toLocaleString()} matches. Search or choose a category to narrow the list.</div>`:'');
};
drawGuide=function(){
  const el=document.getElementById('guideBody');if(!el)return;
  const all=v7DefaultBrowseChannels(),list=all.slice(0,400);
  el.innerHTML=`<div class="sourceGuideHead"><span>CHANNEL</span><span>NOW / ACCESS</span><span>SOURCE</span></div>`+
    list.map(c=>`<button class="sourceGuideRow" data-channel="${esc(c.id)}">
      <span><b>${esc(c.name)}</b><small>${esc(c.group||'')}</small></span>
      <span><b>${esc(c.now||'Live')}</b><small>${esc(c.access||'Connected/public stream')}</small></span>
      <span><b>${esc(c.sourceName||'Velora source')}</b><small>${c.official?'✓ Official':'Public / connected'}</small></span>
    </button>`).join('')+
    (all.length>list.length?`<div class="v7GuideMore">Guide preview shows ${list.length.toLocaleString()} of ${all.length.toLocaleString()} channels. Use the channel search and category filters for the complete catalogue.</div>`:'');
};

// Small shared shortlist arrives independently of the complete searchable catalogue.
let V7_DISCOVERY_PENDING=null;
window.veloraDiscoveryHints=new Map();
window.veloraSharedPool=new Map();
function v7ApplyDiscovery(d){
  if(!state.user||!Array.isArray(d.channels))return;
  window.veloraSharedPool=new Map((Array.isArray(d.sharedVerified)?d.sharedVerified:[])
    .filter(x=>x&&typeof x.id==='string'&&Number.isInteger(x.sourceIndex)&&
      x.sourceIndex>=0&&x.sourceIndex<64&&Number.isFinite(Date.parse(x.lastVerifiedAt))&&
      Date.now()-Date.parse(x.lastVerifiedAt)>=0&&Date.now()-Date.parse(x.lastVerifiedAt)<7*24*3600000)
    .map(x=>[x.id,x]));
  window.veloraDiscoveryHints=new Map(d.channels.map(c=>[c.id,Date.now()]));
  const merged=new Map((state.channels||[]).map(c=>[c.id,c]));
  for(const c of d.channels)merged.set(c.id,c);
  v7ApplySnapshot({providers:state.providers||[],channels:[...merged.values()],catalog:state.catalog||[]},{persistSnapshot:false,background:true});
}
window.v7RefreshDiscovery=function(){
  if(!state.user||document.hidden)return Promise.resolve(null);
  if(V7_DISCOVERY_PENDING)return V7_DISCOVERY_PENDING;
  const ac=new AbortController();const timer=setTimeout(()=>ac.abort(),8000);
  V7_DISCOVERY_PENDING=v7Request('/api/discovery',{signal:ac.signal})
    .then(d=>{v7ApplyDiscovery(d);return d})
    .catch(()=>null).finally(()=>{clearTimeout(timer);V7_DISCOVERY_PENDING=null});
  return V7_DISCOVERY_PENDING;
};
setInterval(()=>window.v7RefreshDiscovery(),30000);

let V7_FAST_LINEUP_PENDING=null;
let V7_FULL_CATALOGUE_READY=false;
window.v7FastLiveHydrate=function(){
  if(!state.user||V7_FULL_CATALOGUE_READY)return Promise.resolve(null);
  if(V7_FAST_LINEUP_PENDING)return V7_FAST_LINEUP_PENDING;
  const account=state.user.id;
  const ac=new AbortController();
  const timeout=setTimeout(()=>ac.abort(),8000);
  V7_FAST_LINEUP_PENDING=v7Request('/api/live/lineup',{headers:{},signal:ac.signal})
    .then(d=>{
      if(!state.user||state.user.id!==account||V7_FULL_CATALOGUE_READY||
        !Array.isArray(d.channels)||!d.channels.length)return null;
      v7ApplySnapshot({
        channels:d.channels,providers:state.providers||[],catalog:state.catalog||[]
      },{persistSnapshot:false,background:true});
      window.veloraInstantGuide?.refresh?.();
      // Retain a usable Live listing if the later VOD download fails.
      setTimeout(()=>{
        if(state.user?.id!==account||V7_FULL_CATALOGUE_READY)return;
        try{store.set('channels',state.channels)}catch{}
      },1200);
      return d;
    })
    .catch(()=>null)
    .finally(()=>{clearTimeout(timeout);V7_FAST_LINEUP_PENDING=null});
  return V7_FAST_LINEUP_PENDING;
};
let V7_HYDRATE_PENDING=null;
let V7_FULL_REFRESH_TIMER=null;
let V7_LAST_FULL_REFRESH=0;
async function v7RefreshFullCatalogue(account){
  try{
    const d=await v7Request('/api/catalogue',{headers:{}});
    if(state.user?.id!==account)return null;
    if((d.stats?.channels||0)>0||(d.stats?.vod||0)>0){
      V7_FULL_CATALOGUE_READY=true;
      V7_LAST_FULL_REFRESH=Date.now();
      // Update channel listings and movies without rebuilding a playing TV.
      v7ApplySnapshot(d,{persistSnapshot:true,background:true});
    }
    return d;
  }catch(e){
    console.warn('Velora full catalogue temporarily unavailable',e);
    return null;
  }
}
function v7ScheduleFullCatalogue(account){
  clearTimeout(V7_FULL_REFRESH_TIMER);
  V7_FULL_REFRESH_TIMER=setTimeout(()=>{
    if(state.user?.id===account)v7RefreshFullCatalogue(account);
  },6500);
}
function v7AutoHydrate(){
  if(!state.user)return Promise.resolve(null);
  if(V7_HYDRATE_PENDING)return V7_HYDRATE_PENDING;
  const account=state.user.id;
  // Shared leads refresh independently and may not interrupt the picture.
  if(typeof window!=='undefined')window.v7RefreshDiscovery?.();
  V7_HYDRATE_PENDING=(async()=>{
    try{
      if(V7_FULL_CATALOGUE_READY){
        // A second profile on this device can browse the resident directory.
        if(Date.now()-V7_LAST_FULL_REFRESH>3*60*1000)
          v7ScheduleFullCatalogue(account);
        return {cached:true};
      }
      const fast=typeof window!=='undefined'?await window.v7FastLiveHydrate?.():null;
      if(state.user?.id!==account)return null;
      if(fast?.channels?.length){
        // Live TV is usable first; VOD/provider metadata can arrive later.
        v7ScheduleFullCatalogue(account);
        return fast;
      }
      // The fast endpoint might be unavailable on an older backend.
      return await v7RefreshFullCatalogue(account);
    }finally{V7_HYDRATE_PENDING=null}
  })();
  return V7_HYDRATE_PENDING;
}
setTimeout(v7AutoHydrate,900);


function v7IsPublicDirectoryItem(x){
  return String(x?.sourceId||'').startsWith('public_') || (x?.sources||[]).some(s=>String(s.sourceId||s.providerId||'').startsWith('public_'));
}
let V7_SELECTION_TOKEN=0;
let V7_RETRY_TIMER=null;
const V7_SESSION_FAILED_IDS=new Set();
const v7OriginalFilteredChannels=filteredChannels;
function v7ChannelNameKey(x){
  return String(x?.name||'').toLowerCase()
    .replace(/\[[^\]]*\]|\([^)]*(?:p|hd|sd|uhd|geo|not 24\/7)[^)]*\)/g,' ')
    .replace(/\b(2160p|1080p|720p|576p|540p|480p|360p|4k|uhd|fhd|hd|sd)\b/g,' ')
    .replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
}
function v7ChannelQuarantined(x){
  if(String(x?.availability||'')!=='down')return false;
  const checked=Date.parse(x?.lastAvailabilityCheck||0)||0;
  return !!checked && Date.now()-checked<30*60000;
}
let V7_SORTED_CHANNELS_CACHE={channels:null,history:'',territory:'',at:0,items:null};
filteredChannels=function(){
  // Repeated guide refreshes and continuous scanning must not re-sort the
  // entire catalogue for each query, scan tick and remote button.
  const historyKey=(state.history||[]).slice(0,30).join('|');
  const now=Date.now(),cache=V7_SORTED_CHANNELS_CACHE;
  if(cache.channels===state.channels&&cache.history===historyKey&&
      cache.territory===state.territory&&now-cache.at<10000&&cache.items)
    return cache.items;
  const officialByKey=new Map(V5_OFFICIAL_CHANNELS.map(x=>[v7ChannelNameKey(x),x]));
  const bulk=state.channels
    // Keep unavailable entries searchable and manually retryable. The default
    // guide and remote independently require device-confirmed video.
    .filter(x=>v7IsPublicDirectoryItem(x)||rightsActive(x))
    .map(x=>{
      const off=officialByKey.get(v7ChannelNameKey(x));
      if(!off)return x;
      return {
        ...off,
        ...x,
        embedUrl:x.embedUrl||off.embedUrl||'',
        watchUrl:x.watchUrl||off.watchUrl||'',
        desc:x.desc||off.desc||'',
        official:true,
        fallbackOfficial:off
      };
    });
  const directKeys=new Set(bulk.map(v7ChannelNameKey).filter(Boolean));
  const fallbackOfficial=V5_OFFICIAL_CHANNELS.filter(x=>!directKeys.has(v7ChannelNameKey(x)));
  const all=[...bulk,...fallbackOfficial],seen=new Set();
  const unique=all.filter(x=>{
    const k=v7ChannelNameKey(x)||String(x.epgId||x.id).toLowerCase();
    if(seen.has(k))return false;
    seen.add(k);return true;
  });
  // VELORA Live browse order:
  // 1) TVJ is always first.
  // 2) Recently healthy/working channels outrank uncertain/degraded ones.
  // 3) High-demand networks/categories and the viewer's recent channels get a
  //    popularity boost. Alphabetical order is only the final tie-breaker.
  const popularityPatterns=[
    [/\bespn\b/i,980],[/\bcnn\b/i,960],[/\bbbc\s*news\b/i,950],
    [/\bfox\s*news\b/i,940],[/\bnbc\b/i,930],[/\babc\b/i,925],
    [/\bcbs\b/i,920],[/\btnt\b/i,910],[/\btbs\b/i,900],
    [/\ba\s*&\s*e\b|\ba and e\b/i,895],[/\bdiscovery\b/i,890],
    [/\bhistory\b/i,885],[/national geographic|\bnat geo\b/i,880],
    [/\bdisney\b/i,870],[/nickelodeon|\bnick\b/i,865],
    [/cartoon network/i,860],[/\bmtv\b/i,850],[/\bbet\b/i,845],
    [/\bamc\b/i,840],[/\bfx\b/i,835],[/hallmark/i,825],
    [/lifetime/i,820],[/food network/i,815],[/\bhgtv\b/i,810],
    [/\btlc\b/i,805],[/\bbravo\b/i,800],[/usa network/i,795],
    [/paramount/i,790],[/weather channel/i,780]
  ];
  const recentIds=Array.isArray(state.history)?state.history:[];
  const generalGroupScore=x=>{
    const g=String(x.group||'').toLowerCase();
    if(/news/.test(g))return 260;
    if(/sport/.test(g))return 250;
    if(/entertainment|general/.test(g))return 230;
    if(/movie|film/.test(g))return 220;
    if(/documentary/.test(g))return 205;
    if(/kids|children/.test(g))return 195;
    if(/music/.test(g))return 185;
    return 120;
  };
  const healthScore=x=>{
    if(String(x.availability||'').toLowerCase()==='up')return 1800;
    if(String(x.availability||'').toLowerCase()==='down')return -2400;
    const health=(x.sources||[]).map(s=>String(s.health||'').toLowerCase());
    if(health.includes('up'))return 1500;
    if(health.length&&health.every(h=>h==='down'))return -2200;
    if(x.official)return 500;
    return 0;
  };
  const popularityScore=x=>{
    const key=v7ChannelNameKey(x);
    if(key==='tvj'||key==='television jamaica'||key.startsWith('tvj '))return 1000000;
    let score=healthScore(x)+generalGroupScore(x);
    const hay=(String(x.name||'')+' '+String(x.group||'')).trim();
    for(const [rx,points] of popularityPatterns){if(rx.test(hay)){score+=points;break}}
    const recent=recentIds.indexOf(x.id);
    if(recent>=0)score+=Math.max(40,360-recent*20);
    return score;
  };
  const items=unique
    .map((x,i)=>({x,i,p:popularityScore(x)}))
    .sort((a,b)=>b.p-a.p||String(a.x.name||'').localeCompare(String(b.x.name||''))||a.i-b.i)
    .map(v=>v.x);
  V7_SORTED_CHANNELS_CACHE={channels:state.channels,history:historyKey,
    territory:state.territory,at:now,items};
  return items;
};

function v7CatalogueSummary(){
  const all=filteredChannels();
  const publicCount=all.filter(v7IsPublicDirectoryItem).length;
  const sports=all.filter(x=>/sport/i.test((x.group||'')+' '+(x.sourceName||''))).length;
  const movie=all.filter(x=>/movie/i.test((x.group||'')+' '+(x.sourceName||''))).length;
  const series=all.filter(x=>/series/i.test((x.group||'')+' '+(x.sourceName||''))).length;
  return {all:all.length,publicCount,sports,movie,series};
}

const v7PreviousRenderLive=renderLive;
renderLive=function(){
  v7PreviousRenderLive();
  const page=document.querySelector('#view-live .contentPage');if(!page)return;
  const c=v7CatalogueSummary();
  const banner=document.createElement('div');
  banner.className='v7CatalogueBanner';
  banner.innerHTML=`<div><span class="heroEyebrow">MASS LIVE CATALOGUE</span><b>${c.all.toLocaleString()} channels loaded</b><small>${c.publicCount.toLocaleString()} bulk public-directory channels • ${c.sports.toLocaleString()} sports • ${c.movie.toLocaleString()} movie • ${c.series.toLocaleString()} series-labelled streams</small></div><button class="primary" id="v7ShowAllChannels">Browse all</button>`;
  page.prepend(banner);
  drawChannelList(document.getElementById('channelSearch')?.value||'');
  drawGuide();
};

document.addEventListener('click',e=>{
  if(e.target.id==='v7ShowAllChannels'){
    state.currentFilter='All';
    const input=document.getElementById('channelSearch');if(input)input.value='';
    document.querySelectorAll('.channelCats .chip').forEach(b=>b.classList.toggle('active',b.dataset.group==='All'));
    drawChannelList('');
    document.getElementById('channelList')?.scrollIntoView({behavior:'smooth',block:'start'});
  }
},true);


function v7LiveCandidates(c){
  const urls=[],seen=new Set();
  const add=(value,upstream='')=>{
    const u=v7MediaUrl(value);if(!u)return;
    // Channel and signed relay routes can point to the exact same upstream.
    // Direct-from-device and relay routes remain distinct (CORS/territory).
    const key=upstream&&u.includes('/api/public/')?'relay:'+upstream:u;
    if(!seen.has(key)&&!urls.includes(u)){seen.add(key);urls.push(u)}
  };
  // The English A&E feed uses MPEG-2; the shared compatibility route emits
  // H.264/AAC. Keep regional editions distinct.
  if(/^a\s*&\s*e(?:\s*\([^)]*\))?$/i.test(c.name||''))add(v7MediaUrl('/api/public/compatible/ae/index.m3u8'));
  for(const u of (c.clientUrls||[]))add(u);
  // A fresh successful server source precedes stale alternatives, but direct
  // territory-specific device URLs above retain first choice.
  for(const src of (c.sources||[]))if(src.health==='up'&&Date.now()-(Date.parse(src.lastChecked)||0)<20*60000)add(src.url,src.upstreamUrl);
  // Imports can retain an existing channel ID while replacing its playlist
  // record. Always address that retained ID, not a discarded imported ID.
  const channelUrl=c.id?String(c.url||'').replace(/(\/api\/public\/channel\/)[^/?#]+/,'$1'+encodeURIComponent(c.id)):c.url;
  add(channelUrl,c.upstreamUrl);
  for(const src of (c.sources||[]))add(src.url,src.upstreamUrl);
  return urls;
}
async function v7ResolveCandidates(c,signal){
  const local=v7LiveCandidates(c);
  if(v7IsPublicDirectoryItem(c)){
    try{
      const d=await v7Request('/api/channel/'+encodeURIComponent(c.id)+'/resolve',{headers:{},signal});
      const probed=(d.urls||[]).map(v7MediaUrl).filter(Boolean);
      // Direct Jamaica feeds may work from the viewer's network even when the
      // backend probe is geo-blocked, so preserve client-direct order there.
      // For normal catalogue channels, honor the backend's learned reliability
      // ranking before falling back to the original playlist URL.
      const ordered=(c.clientUrls||[]).length?[...local,...probed]:[...probed,...local];
      return [...new Set(ordered)];
    }catch{
      // A US Railway probe can fail for a Jamaica-geo stream. Do not discard
      // client-direct candidates just because the backend cannot see them.
      return local;
    }
  }
  return local;
}
function v7ResetInline(){
  window.veloraCaptions?.reset?.();
  window.veloraCancelLiveAttempt?.();
  if(state.hls){try{state.hls.destroy()}catch{}state.hls=null}
  const v=document.getElementById('inlineLive');
  if(v){
    try{v.pause()}catch{}
    v.onerror=null;v.onloadeddata=null;v.oncanplay=null;
    v.removeAttribute('src');try{v.load()}catch{}
    v.classList.add('hidden');
  }
  const f=document.getElementById('inlineLiveEmbed');
  if(f){f.src='about:blank';f.classList.add('hidden')}
}
function v7ShowLiveStatus(c,title,message,busy=false){
  const panel=document.getElementById('officialWatchPanel');if(!panel)return;
  panel.classList.remove('hidden');
  panel.innerHTML=`<div class="v7LiveState ${busy?'busy':''}">
    <div class="channelMonogram big">${esc(c.short||'TV')}</div>
    <span class="officialPill">${v7IsPublicDirectoryItem(c)?'VELORA LIVE':'LIVE SOURCE'}</span>
    <h2>${esc(title||c.name)}</h2><p>${esc(message||'Finding live source…')}</p>
    ${busy?'<div class="v7MiniSpinner"></div>':'<button class="primary" type="button" id="veloraRetrySelectedChannel">Retry this channel ↻</button><button class="ghost v7ChooseAnother" id="v7ChooseAnotherChannel">Choose another channel</button>'}
  </div>`;
}
const V7_SEARCH_ATTEMPTS=new Map();
function v7KeepSearching(c,token=V7_SELECTION_TOKEN){
  if(!c||token!==V7_SELECTION_TOKEN)return;
  clearTimeout(V7_RETRY_TIMER);
  v7ResetInline();

  V7_SESSION_FAILED_IDS.add(c.id);
  c.availability='down';
  c.lastAvailabilityCheck=new Date().toISOString();
  v7ReportPlayback(c,c.url||'',false,'channel-unavailable',true);

  const row=[...document.querySelectorAll('#channelList [data-channel]')].find(el=>el.dataset.channel===c.id);
  if(row){row.classList.add('v7SessionUnavailable');row.setAttribute('aria-disabled','true')}

  const msg=v7ChannelNameKey(c).includes('cvm')
    ? 'CVM is not available right now. Please choose another channel when you are ready.'
    : 'This stream is temporarily unavailable. Retry this channel or choose another.';
  v7ShowLiveStatus(c,c.name,msg,false);
}
const V7_NATIVE_ATTEMPTS=new Set();
function v7ReportPlayback(c,url,ok,reason='',final=false){
  if(!c?.id)return;
  const candidates=v7LiveCandidates(c);
  const selected=url||c.url||'';
  const sourceIndex=candidates.indexOf(selected);
  v7Request('/api/channel/'+encodeURIComponent(c.id)+'/playback-report',{
    method:'POST',
    body:JSON.stringify({url:selected,ok:!!ok,reason:String(reason||'').slice(0,120),final:!!final,
      sourceIndex:sourceIndex>=0?sourceIndex:null})
  }).catch(()=>{});
}
function v7NativeAvailable(){
  try{return !!(window.VeloraNative&&window.VeloraNative.isAvailable&&window.VeloraNative.isAvailable())}catch{return false}
}
function v7TryNativePlayer(c,urls,token){
  if(token!==V7_SELECTION_TOKEN||!v7NativeAvailable()||V7_NATIVE_ATTEMPTS.has(token))return false;
  const url=(urls||[]).find(Boolean);
  if(!url)return false;
  V7_NATIVE_ATTEMPTS.add(token);
  v7ResetInline();
  v7ShowLiveStatus(c,c.name,'Opening VELORA compatibility player for this channel…',true);
  try{
    window.VeloraNative.playStream(String(url),String(c.name||'VELORA Live'));
    return true;
  }catch{
    return false;
  }
}
async function v7StartPlayback(v){
  try{
    await v.play();
    return true;
  }catch(e){
    if(e?.name!=='NotAllowedError')return false;
    try{
      v.muted=true;
      await v.play();
      toast('Live TV started muted — use the remote for sound.');
      return true;
    }catch{return false}
  }
}
// Source discovery is a fallback, never a prerequisite for the first picture.
async function v7RecoverLiveSources(c,attempted,autoplay,token){
  if(token!==V7_SELECTION_TOKEN)return;
  if(V7_SEARCH_ATTEMPTS.has(token))return v7KeepSearching(c,token);
  V7_SEARCH_ATTEMPTS.set(token,true);
  const ac=new AbortController();
  const timer=setTimeout(()=>ac.abort(),8000);
  v7ShowLiveStatus(c,c.name,'Checking another source for this channel…',true);
  try{
    const urls=(await v7ResolveCandidates(c,ac.signal)).filter(u=>!attempted.includes(u));
    if(token!==V7_SELECTION_TOKEN)return;
    if(urls.length)return v7PlayLiveDirect(c,urls,autoplay,0,token);
    v7KeepSearching(c,token);
  }finally{clearTimeout(timer)}
}
function v7PlayLiveDirect(c,urls,autoplay=true,index=0,token=V7_SELECTION_TOKEN){
  if(token!==V7_SELECTION_TOKEN)return;
  const url=urls[index];
  if(!url){
    if(v7TryNativePlayer(c,urls,token))return;
    return v7RecoverLiveSources(c,urls,autoplay,token);
  }

  v7ResetInline();
  v7ShowLiveStatus(c,c.name,index?'Trying another video source…':'Starting live stream…',true);

  const v=document.getElementById('inlineLive'),panel=document.getElementById('officialWatchPanel');
  if(!v)return;
  let settled=false;
  let timeout=null;
  let frameTimer=null;
  let verifyStarted=false;
  let videoFrameId=null;

  const cleanupTimers=()=>{
    clearTimeout(timeout);
    clearTimeout(frameTimer);
    if(videoFrameId!==null)try{v.cancelVideoFrameCallback?.(videoFrameId)}catch{}
  };
  window.veloraCancelLiveAttempt=()=>{settled=true;cleanupTimers()};
  const confirmVideo=()=>{
    if(settled||token!==V7_SELECTION_TOKEN||verifyStarted)return;
    verifyStarted=true;

    const goodFrame=()=>{
      if(settled||token!==V7_SELECTION_TOKEN)return;
      if((v.videoWidth||0)>0&&(v.videoHeight||0)>0&&v.readyState>=2&&!v.paused&&v.currentTime>0.1){
        settled=true;cleanupTimers();
        v.classList.remove('hidden');
        if(panel)panel.classList.add('hidden');
        V7_SESSION_FAILED_IDS.delete(c.id);
        c.availability='up';
        c.lastAvailabilityCheck=new Date().toISOString();
        c.lastPlaybackSuccessAt=new Date().toISOString();
        v7ReportPlayback(c,url,true,'video-frame');
        return;
      }
      frameTimer=setTimeout(goodFrame,400);
    };

    if(autoplay){
      v7StartPlayback(v).catch(()=>{});
    }

    if(typeof v.requestVideoFrameCallback==='function'){
      let frameSeen=false;
      try{
        videoFrameId=v.requestVideoFrameCallback(()=>{
          if(settled||token!==V7_SELECTION_TOKEN)return;
          frameSeen=true;
          if((v.videoWidth||0)>0&&(v.videoHeight||0)>0){
            settled=true;cleanupTimers();
            v.classList.remove('hidden');
            if(panel)panel.classList.add('hidden');
            V7_SESSION_FAILED_IDS.delete(c.id);
        c.availability='up';
        c.lastAvailabilityCheck=new Date().toISOString();
        c.lastPlaybackSuccessAt=new Date().toISOString();
        v7ReportPlayback(c,url,true,'video-frame');
          }
        });
      }catch{}
      // A metadata dimension is not proof of a decoded picture. Devices with
      // requestVideoFrameCallback must actually deliver a video frame.
      frameTimer=setTimeout(()=>{if(!frameSeen)fail('no-decoded-video-frame')},9200);
    }else{
      frameTimer=setTimeout(goodFrame,1800);
    }
  };
  const fail=()=>{
    if(settled||token!==V7_SELECTION_TOKEN)return;
    settled=true;cleanupTimers();
    if(state.hls){try{state.hls.destroy()}catch{}state.hls=null}
    try{v.pause();v.removeAttribute('src');v.load()}catch{}
    v7ReportPlayback(c,url,false,'no-compatible-video');
    if(index+1<urls.length){
      setTimeout(()=>v7PlayLiveDirect(c,urls,autoplay,index+1,token),100);
    }else if(v7TryNativePlayer(c,urls,token)){
      return;
    }else{
      v7RecoverLiveSources(c,urls,autoplay,token);
    }
  };

  // Begin immediately; a saved success must not get a shorter decode deadline.
  timeout=setTimeout(fail,url.includes('/api/public/compatible/')?25000:15000);
  // Keep the video renderable beneath the loading overlay for frame callbacks.
  v.classList.remove('hidden');
  v.onerror=fail;
  v.onloadedmetadata=confirmVideo;
  v.onloadeddata=confirmVideo;
  v.oncanplay=confirmVideo;

  try{
    if(window.Hls&&Hls.isSupported()&&(/\.m3u8(?:$|\?)/i.test(url)||url.includes('/api/public/'))){
      state.hls=new Hls({
        enableWorker:true,
        lowLatencyMode:true,
        maxBufferLength:12,
        startLevel:0,
        manifestLoadingTimeOut:7000,
        levelLoadingTimeOut:7000,
        fragLoadingTimeOut:7000
      });
      state.hls.loadSource(url);
      state.hls.attachMedia(v);
      window.veloraCaptions?.attach?.(v,state.hls);
      state.hls.on(Hls.Events.MANIFEST_PARSED,()=>{if(autoplay)v7StartPlayback(v).catch(()=>{})});
      state.hls.on(Hls.Events.ERROR,(_,data)=>{if(data?.fatal)fail()});
    }else{
      window.veloraCaptions?.attach?.(v,null);
      v.src=url;v.load();
    }
  }catch{fail()}
}
selectChannel=async function(id,autoplay=true){
  const c=filteredChannels().find(x=>x.id===id);if(!c)return;
  const token=++V7_SELECTION_TOKEN;
  V7_SEARCH_ATTEMPTS.clear();
  V7_NATIVE_ATTEMPTS.clear();
  clearTimeout(V7_RETRY_TIMER);
  state.currentChannel=c;
  window.veloraCaptions?.setChannel?.(c);
  drawChannelList(document.getElementById('channelSearch')?.value||'');

  const t=document.getElementById('nowChannel'),p=document.getElementById('nowProgram'),fallback=document.getElementById('openProviderFallback');
  if(t)t.textContent=c.name;
  if(p)p.textContent=`${c.now||'Live'} • Checking video playback…`;
  if(fallback){fallback.hidden=!c.watchUrl;fallback.dataset.v5External=c.watchUrl||'';fallback.textContent='Publisher source ↗'}

  v7ResetInline();
  v7ShowLiveStatus(c,c.name,'Starting channel…',true);

  // Use the precise URL that decoded video on this device. This skips the
  // expensive server resolve/probe round trip on every CH+ / CH− press.
  const ready=window.veloraFastLiveUrls?.(c);
  if(ready?.length)return v7PlayLiveDirect(c,ready,autoplay,0,token);
  const urls=v7LiveCandidates(c);
  if(urls.length){
    const hint=window.veloraSharedPool?.get(c.id);
    const i=hint?.sourceIndex;
    if(hint&&Number.isInteger(i)&&i>=0&&i<urls.length){
      const predicted=urls[i];
      return v7PlayLiveDirect(c,[predicted,...urls.filter((_,j)=>j!==i)],autoplay,0,token);
    }
    return v7PlayLiveDirect(c,urls,autoplay,0,token);
  }
  if(v7IsPublicDirectoryItem(c))return v7RecoverLiveSources(c,[],autoplay,token);

  if(c.embedUrl){
    const yt=v6YoutubeFromEmbed(c.embedUrl);
    if(yt)return v6PlayYouTube({title:c.name,...yt,publisherUrl:c.watchUrl||''});
  }
  v7KeepSearching(c,token);
};
v5OpenChannel=function(c,full=false){
  if(!c)return;
  selectChannel(c.id,true);
  if(full){
    setTimeout(()=>{
      const v=document.getElementById('inlineLive');
      if(v&&!v.classList.contains('hidden')&&document.fullscreenElement==null){
        v.requestFullscreen?.().catch?.(()=>{});
      }
    },1200);
  }
};

// Never change channels automatically.
// If an embed fails, keep the selected channel in place and show its unavailable state.
if(typeof v6Fail==='function'){
  const v7OriginalV6Fail=v6Fail;
  v6Fail=function(title,message,publisherUrl){
    const liveActive=document.getElementById('view-live')?.classList.contains('active');
    if(liveActive&&state.currentChannel){
      return v7KeepSearching(state.currentChannel,V7_SELECTION_TOKEN);
    }
    return v7OriginalV6Fail(title,message,publisherUrl);
  };
}



document.addEventListener('click',e=>{
  if(e.target.id==='veloraRetrySelectedChannel'){
    e.preventDefault();e.stopImmediatePropagation();
    const c=state.currentChannel;
    if(c){V7_SESSION_FAILED_IDS.delete(c.id);selectChannel(c.id,true)}
    return;
  }
  if(e.target.id==='v7ChooseAnotherChannel'){
    const list=document.getElementById('channelList');
    const pane=document.querySelector('#view-live .channelPane');
    (list||pane)?.scrollIntoView({behavior:'smooth',block:'start'});
    document.getElementById('channelSearch')?.focus();
  }
},true);
