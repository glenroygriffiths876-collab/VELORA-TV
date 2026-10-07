renderLive = function(){
  const liveChannels=filteredChannels();
  const groups=['All',...new Set(liveChannels.map(x=>x.group||'Other'))];
  if(!groups.includes(state.currentFilter))state.currentFilter='All';
  document.getElementById('view-live').innerHTML=`<div class="contentPage">
    <div class="pageHead"><div><span class="heroEyebrow">FREE LIVE TV</span><h1>Live Guide</h1><p>Official and first-party streams first. Some broadcaster platforms may require a free account, subscription or event pass; imported licensed channels appear here too when connected.</p></div><span class="status"><i></i>${liveChannels.length} sources</span></div>
    <div class="realSourceNote"><b>✓ Verified-source mode</b><span>Jamaica and Caribbean broadcaster services are clearly separated from genuinely free channels and connected licensed feeds.</span></div>
    <div class="liveLayout"><aside class="channelPane">
      <div class="channelToolbar"><input id="channelSearch" placeholder="Search channels…"></div>
      <div class="channelCats">${groups.map((g,i)=>`<button class="chip ${g===state.currentFilter?'active':''}" data-group="${esc(g)}">${esc(g)}</button>`).join('')}</div>
      <div class="channelList" id="channelList"></div>
    </aside>
    <div class="liveMain"><div class="livePlayerCard">
      <video id="inlineLive" class="hidden" controls playsinline></video>
      <iframe id="inlineLiveEmbed" class="inlineLiveEmbed hidden" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>
      <div id="officialWatchPanel" class="officialWatchPanel"><div class="channelMonogram big">TV</div><h2>Choose a channel</h2><p>Select an official free source from the guide.</p></div>
      <div class="nowPlaying"><div><span class="heroEyebrow">SELECTED CHANNEL</span><h2 id="nowChannel">Choose a channel</h2><p id="nowProgram">Official free streams open here when embedding is allowed.</p></div><div class="liveActions"><button class="ghost" id="openProviderFallback" hidden>Official source ↗</button><button class="ghost" id="openFullLive">Open / Fullscreen ↗</button></div></div>
    </div><div class="sourceGuide" id="guideBody"></div></div></div>
  </div>`;
  drawChannelList(); drawGuide();
  if(liveChannels[0]&&document.getElementById('view-live')?.classList.contains('active'))selectChannel(liveChannels[0].id,true);
};

drawChannelList = function(q=''){
  const el=document.getElementById('channelList'); if(!el)return;
  const grp=state.currentFilter, s=q.toLowerCase();
  const list=filteredChannels().filter(c=>(grp==='All'||c.group===grp)&&(!s||(c.name+' '+c.group+' '+(c.now||'')).toLowerCase().includes(s)));
  el.innerHTML=list.map(c=>`<button class="channelRow ${state.currentChannel?.id===c.id?'active':''}" data-channel="${esc(c.id)}">
    <span class="channelLogo textLogo">${esc(c.short||'TV')}</span>
    <span><b>${esc(c.name)}</b><small>${esc(c.group||'')} • ${esc(c.official?'Official source':'Connected feed')}</small></span>
    <span class="channelNum">${esc(c.num||'')}</span>
  </button>`).join('');
};

drawGuide = function(){
  const el=document.getElementById('guideBody'); if(!el)return;
  el.innerHTML=`<div class="sourceGuideHead"><span>CHANNEL</span><span>NOW / ACCESS</span><span>SOURCE</span></div>`+
  filteredChannels().map(c=>`<button class="sourceGuideRow" data-channel="${esc(c.id)}">
    <span><b>${esc(c.name)}</b><small>${esc(c.group||'')}</small></span>
    <span><b>${esc(c.now||'Live')}</b><small>${esc(c.access||'Connected stream')}</small></span>
    <span><b>${esc(c.sourceName||'Velora provider')}</b><small>${c.official?'✓ Official':'Authorized feed'}</small></span>
  </button>`).join('');
};

selectChannel = function(id,autoplay=true){
  const c=filteredChannels().find(x=>x.id===id); if(!c)return;
  state.currentChannel=c; drawChannelList(document.getElementById('channelSearch')?.value||'');
  const t=document.getElementById('nowChannel'), p=document.getElementById('nowProgram');
  const v=document.getElementById('inlineLive'), f=document.getElementById('inlineLiveEmbed'), panel=document.getElementById('officialWatchPanel'), fallback=document.getElementById('openProviderFallback');
  if(t)t.textContent=c.name; if(p)p.textContent=`${c.now||'Live'} • ${c.access||c.group||''}`; if(fallback){fallback.hidden=!c.watchUrl;fallback.dataset.v5External=c.watchUrl||'';fallback.textContent=c.embedUrl?'Official source ↗':'Watch official stream ↗'}
  if(v){v.pause();v.removeAttribute('src');v.classList.add('hidden')}
  if(f){f.src='about:blank';f.classList.add('hidden')}
  if(panel)panel.classList.add('hidden');

  if(c.embedUrl&&f){f.classList.remove('hidden');f.src=c.embedUrl}
  else if(c.url&&v){v.classList.remove('hidden');playInto(v,c.url,autoplay)}
  else if(panel){
    panel.classList.remove('hidden');
    panel.innerHTML=`<div class="channelMonogram big">${esc(c.short||'TV')}</div><span class="officialPill">✓ OFFICIAL SOURCE</span><h2>${esc(c.name)}</h2><p>${esc(c.desc||'Official live stream')}</p><button class="primary" data-v5-external="${esc(c.watchUrl||'#')}">Watch on official site ↗</button>`;
  }
};

function v5OpenChannel(c,full=false){
  if(!c)return;
  if(c.embedUrl&&full){
    const frame=document.getElementById('archivePlayer'), video=document.getElementById('mainPlayer'), overlay=document.getElementById('playerOverlay');
    if(state.hls){state.hls.destroy();state.hls=null}
    video.pause();video.removeAttribute('src');video.classList.add('hidden');
    frame.classList.remove('hidden');frame.src=c.embedUrl;
    document.getElementById('playerTitle').textContent=c.name;
    document.getElementById('playerType').textContent='OFFICIAL LIVE';
    state.currentItem=c; overlay.classList.add('on'); overlay.setAttribute('aria-hidden','false'); document.body.style.overflow='hidden';
    return;
  }
  if(c.url&&full){ openPlayer(c); return; }
  if(c.watchUrl){ v5OpenInApp(c.watchUrl,c.name); return; }
  selectChannel(c.id,true);
}

