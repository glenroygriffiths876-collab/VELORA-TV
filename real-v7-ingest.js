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
  const r=await fetch(v7Api(path),{...options,headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{}),...(options.headers||{})}});
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
function v7ApplySnapshot(d){
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


function v7LiveMatches(q=''){
  const grp=state.currentFilter||'All',needle=String(q||'').toLowerCase();
  return filteredChannels().filter(c=>(grp==='All'||c.group===grp)&&(!needle||(c.name+' '+(c.group||'')+' '+(c.now||'')+' '+(c.sourceName||'')).toLowerCase().includes(needle)));
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
  const all=filteredChannels(),list=all.slice(0,400);
  el.innerHTML=`<div class="sourceGuideHead"><span>CHANNEL</span><span>NOW / ACCESS</span><span>SOURCE</span></div>`+
    list.map(c=>`<button class="sourceGuideRow" data-channel="${esc(c.id)}">
      <span><b>${esc(c.name)}</b><small>${esc(c.group||'')}</small></span>
      <span><b>${esc(c.now||'Live')}</b><small>${esc(c.access||'Connected/public stream')}</small></span>
      <span><b>${esc(c.sourceName||'Velora source')}</b><small>${c.official?'✓ Official':'Public / connected'}</small></span>
    </button>`).join('')+
    (all.length>list.length?`<div class="v7GuideMore">Guide preview shows ${list.length.toLocaleString()} of ${all.length.toLocaleString()} channels. Use the channel search and category filters for the complete catalogue.</div>`:'');
};

async function v7AutoHydrate(){
  if(!state.user)return;
  try{
    const d=await v7Request('/api/catalogue',{headers:{}});
    if((d.stats?.channels||0)>0||(d.stats?.vod||0)>0)v7ApplySnapshot(d);
  }catch(e){console.warn('Velora backend catalogue unavailable',e)}
}
setTimeout(v7AutoHydrate,900);


function v7IsPublicDirectoryItem(x){
  return String(x?.sourceId||'').startsWith('public_') || (x?.sources||[]).some(s=>String(s.sourceId||s.providerId||'').startsWith('public_'));
}
let V7_SELECTION_TOKEN=0;
let V7_RETRY_TIMER=null;
const v7OriginalFilteredChannels=filteredChannels;
function v7ChannelNameKey(x){
  return String(x?.name||'').toLowerCase()
    .replace(/\[[^\]]*\]|\([^)]*(?:p|hd|sd|uhd|geo|not 24\/7)[^)]*\)/g,' ')
    .replace(/\b(2160p|1080p|720p|576p|540p|480p|360p|4k|uhd|fhd|hd|sd)\b/g,' ')
    .replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
}
filteredChannels=function(){
  const officialByKey=new Map(V5_OFFICIAL_CHANNELS.map(x=>[v7ChannelNameKey(x),x]));
  const bulk=state.channels
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
  // VELORA is currently Live-TV first. Lead with the most dependable Jamaican
  // starting point instead of allowing upstream feed order to choose the first
  // impression. Keep CVM available lower in the guide while its source remains
  // less reliable.
  const livePriority=x=>{
    const key=v7ChannelNameKey(x);
    const jamaica=String(x.group||'').toLowerCase()==='jamaica';
    if(key==='tvj'||key==='television jamaica'||key.startsWith('tvj '))return 0;
    if(jamaica&&!key.includes('cvm'))return 10;
    if(!jamaica)return 30;
    if(key.includes('cvm'))return 90;
    return 40;
  };
  return unique
    .map((x,i)=>({x,i,p:livePriority(x)}))
    .sort((a,b)=>a.p-b.p||a.i-b.i)
    .map(v=>v.x);
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
  const urls=[];
  const add=u=>{u=v7MediaUrl(u);if(u&&!urls.includes(u))urls.push(u)};
  // Jamaica-first: when the backend marks a channel with clientUrls, try those
  // directly from the viewer's network before the Railway relay.
  for(const u of (c.clientUrls||[]))add(u);
  add(c.url);
  for(const src of (c.sources||[]))add(src.url);
  return urls;
}
async function v7ResolveCandidates(c){
  const local=v7LiveCandidates(c);
  if(v7IsPublicDirectoryItem(c)){
    try{
      const d=await v7Request('/api/channel/'+encodeURIComponent(c.id)+'/resolve',{headers:{}});
      const probed=(d.urls||[]).map(v7MediaUrl).filter(Boolean);
      return [...new Set([...local,...probed])];
    }catch{
      // A US Railway probe can fail for a Jamaica-geo stream. Do not discard
      // client-direct candidates just because the backend cannot see them.
      return local;
    }
  }
  return local;
}
function v7ResetInline(){
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
    ${busy?'<div class="v7MiniSpinner"></div>':''}
  </div>`;
}
const V7_SEARCH_ATTEMPTS=new Map();
function v7KeepSearching(c,token=V7_SELECTION_TOKEN){
  if(!c||token!==V7_SELECTION_TOKEN)return;
  clearTimeout(V7_RETRY_TIMER);
  const attempt=(V7_SEARCH_ATTEMPTS.get(token)||0)+1;
  V7_SEARCH_ATTEMPTS.set(token,attempt);
  v7ResetInline();

  // Do not leave viewers staring at an endless spinner. CVM in particular is
  // retained in the guide for testing, but a failed source should fail cleanly.
  const maxAttempts=v7ChannelNameKey(c).includes('cvm')?1:2;
  if(attempt>maxAttempts){
    const msg=v7ChannelNameKey(c).includes('cvm')
      ? 'CVM is not reliably available in VELORA right now. Please choose TVJ or another channel.'
      : 'This channel is not available right now. Please choose another channel.';
    v7ShowLiveStatus(c,c.name,msg,false);
    return;
  }

  v7ShowLiveStatus(c,c.name,'Velora is checking another live source…',true);
  V7_RETRY_TIMER=setTimeout(async()=>{
    if(token!==V7_SELECTION_TOKEN)return;
    const urls=await v7ResolveCandidates(c);
    if(token!==V7_SELECTION_TOKEN)return;
    if(urls.length)return v7PlayLiveDirect(c,urls,true,0,token);

    try{await v7LoadSnapshot(false)}catch{}
    if(token!==V7_SELECTION_TOKEN)return;
    const refreshed=filteredChannels().find(x=>v7ChannelNameKey(x)===v7ChannelNameKey(c))||c;
    const retryUrls=await v7ResolveCandidates(refreshed);
    if(token!==V7_SELECTION_TOKEN)return;
    if(retryUrls.length)return v7PlayLiveDirect(refreshed,retryUrls,true,0,token);

    return v7KeepSearching(refreshed,token);
  },3500);
}
function v7PlayLiveDirect(c,urls,autoplay=true,index=0,token=V7_SELECTION_TOKEN){
  if(token!==V7_SELECTION_TOKEN)return;
  const url=urls[index];
  if(!url)return v7KeepSearching(c,token);

  v7ResetInline();
  v7ShowLiveStatus(c,c.name,index?'Switching to another live source…':'Starting live stream…',true);

  const v=document.getElementById('inlineLive'),panel=document.getElementById('officialWatchPanel');
  if(!v)return;
  let settled=false;
  let timeout=null;

  const started=()=>{
    if(settled||token!==V7_SELECTION_TOKEN)return;
    settled=true;clearTimeout(timeout);
    v.classList.remove('hidden');
    if(panel)panel.classList.add('hidden');
    if(autoplay)v.play().catch(()=>{});
  };
  const fail=()=>{
    if(settled||token!==V7_SELECTION_TOKEN)return;
    settled=true;clearTimeout(timeout);
    if(state.hls){try{state.hls.destroy()}catch{}state.hls=null}
    if(index+1<urls.length){
      setTimeout(()=>v7PlayLiveDirect(c,urls,autoplay,index+1,token),80);
    }else{
      v7KeepSearching(c,token);
    }
  };

  timeout=setTimeout(fail,9000);
  v.onerror=fail;
  v.onloadeddata=started;
  v.oncanplay=started;

  try{
    if(window.Hls&&Hls.isSupported()&&(/\.m3u8(?:$|\?)/i.test(url)||url.includes('/api/public/'))){
      state.hls=new Hls({enableWorker:true,lowLatencyMode:true,maxBufferLength:30,manifestLoadingTimeOut:7000,levelLoadingTimeOut:7000,fragLoadingTimeOut:7000});
      state.hls.loadSource(url);state.hls.attachMedia(v);
      state.hls.on(Hls.Events.MANIFEST_PARSED,started);
      state.hls.on(Hls.Events.ERROR,(_,data)=>{if(data?.fatal)fail()});
    }else{
      v.src=url;v.load();
    }
  }catch{fail()}
}
selectChannel=async function(id,autoplay=true){
  const c=filteredChannels().find(x=>x.id===id);if(!c)return;
  const token=++V7_SELECTION_TOKEN;
  V7_SEARCH_ATTEMPTS.clear();
  clearTimeout(V7_RETRY_TIMER);
  state.currentChannel=c;
  drawChannelList(document.getElementById('channelSearch')?.value||'');

  const t=document.getElementById('nowChannel'),p=document.getElementById('nowProgram'),fallback=document.getElementById('openProviderFallback');
  if(t)t.textContent=c.name;
  if(p)p.textContent=`${c.now||'Live'} • ${v7IsPublicDirectoryItem(c)?'Velora verified stream':(c.access||c.group||'')}`;
  if(fallback){fallback.hidden=!c.watchUrl;fallback.dataset.v5External=c.watchUrl||'';fallback.textContent='Publisher source ↗'}

  v7ResetInline();
  v7ShowLiveStatus(c,c.name,'Finding the best live source for your connection…',true);

  const urls=await v7ResolveCandidates(c);
  if(token!==V7_SELECTION_TOKEN)return;
  if(urls.length)return v7PlayLiveDirect(c,urls,autoplay,0,token);

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

// Never leave a live-TV viewer on the V6 provider error surface.
// If an embed fails, keep that channel selected and continue searching for another source.
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

