// VELORA UX V15 — TV-first Live experience with search takeover.
(() => {
  let searchOpen=false;
  // One startup tune per app session: TVJ is the fixed launch channel.
  let firstLiveTunePending=true;

  function browseChannels(q=''){
    if(typeof v7LiveMatches==='function')return v7LiveMatches(q);
    const needle=String(q||'').trim().toLowerCase();
    return filteredChannels().filter(c=>!needle||(c.name+' '+(c.group||'')+' '+(c.now||'')).toLowerCase().includes(needle));
  }

  drawChannelList=function(q=''){
    const el=document.getElementById('channelList');if(!el)return;
    const list=browseChannels(q).slice(0,180);
    el.innerHTML=list.length?list.map(c=>`<button class="channelRow ${state.currentChannel?.id===c.id?'active':''}" data-channel="${esc(c.id)}">
      <span class="channelLogo textLogo">${esc(c.short||'TV')}</span>
      <span><b>${esc(c.name)}</b><small>${esc(c.group||'Live TV')}${c.now?' • '+esc(c.now):''}</small></span>
      <span class="channelNum">${esc(c.num||'')}</span>
    </button>`).join(''):`<div class="veloraSearchEmpty">No channels match that search.</div>`;
  };

  function controlMarkup(){
    return `<div class="veloraTvControls" aria-label="Live TV controls">
      <button type="button" data-v15-control="prev" aria-label="Previous channel"><b>‹</b><span>CH −</span></button>
      <button type="button" data-v15-control="play" aria-label="Play or pause"><b>▶</b><span>PLAY</span></button>
      <button type="button" data-v15-control="next" aria-label="Next channel"><b>›</b><span>CH +</span></button>
      <button type="button" data-v15-control="vol-down" aria-label="Volume down"><b>−</b><span>VOL</span></button>
      <button type="button" data-v15-control="mute" aria-label="Mute"><b>◉</b><span>MUTE</span></button>
      <button type="button" data-v15-control="vol-up" aria-label="Volume up"><b>＋</b><span>VOL</span></button>
      <button type="button" data-v15-control="fullscreen" aria-label="Full screen"><b>⛶</b><span>FULL</span></button>
    </div>`;
  }

  renderLive=function(){
    const el=document.getElementById('view-live');if(!el)return;
    const available=browseChannels('');
    const lineup=filteredChannels();
    const tvj=lineup.find(c=>typeof v7IsTVJ==='function'&&v7IsTVJ(c))||
      lineup.find(c=>String(c.name||'').trim().toLowerCase()==='tvj')||null;
    const existing=state.currentChannel&&lineup.find(c=>c.id===state.currentChannel.id);
    // Startup must ignore the previously watched/verified first channel.
    const initial=(firstLiveTunePending&&tvj)||existing||available[0]||lineup[0]||null;

    el.innerHTML=`<div class="contentPage veloraTvFirstPage">
      <div class="veloraTvFirstWrap">
        <section class="veloraTvPlayer livePlayerCard">
          <div class="veloraTvStage">
            <video id="inlineLive" class="hidden" controls playsinline></video>
            <iframe id="inlineLiveEmbed" class="inlineLiveEmbed hidden" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>
            <div id="officialWatchPanel"><div class="channelMonogram big">TV</div><h2>${initial?esc(initial.name):'Live TV'}</h2><p>${initial?'Starting channel…':'Search below to choose a channel.'}</p></div>
          </div>
          <div class="veloraTvNow">
            <div class="veloraTvNowText"><span>NOW PLAYING</span><h2 id="nowChannel">${initial?esc(initial.name):'Choose a channel'}</h2><p id="nowProgram">${initial?esc(initial.now||initial.group||'Live TV'):'Tap Search channels below.'}</p></div>
            <div class="veloraOnAir"><i></i> LIVE</div>
            <button id="openProviderFallback" class="hidden" hidden></button>
            <button id="openFullLive" class="hidden" hidden></button>
          </div>
        </section>

        ${controlMarkup()}

        <section class="veloraLiveSearchShell" id="veloraLiveSearchShell">
          <div class="veloraSearchBar">
            <div class="veloraSearchIcon">⌕</div>
            <input id="channelSearch" type="search" name="velora-channel-search" role="searchbox" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" inputmode="search" enterkeyhint="search" aria-autocomplete="none" data-form-type="other" data-lpignore="true" data-1p-ignore placeholder="Search channels or programmes…">
            <button class="veloraSearchCancel" id="veloraSearchCancel" type="button">Cancel</button>
          </div>
          <div class="veloraSearchHint" id="veloraSearchHint">Tap the search bar to browse or find a channel.</div>
          <div class="channelList" id="channelList"></div>
        </section>
        <div id="guideBody" class="hidden"></div>
      </div>
    </div>`;

    drawChannelList('');
    if(initial&&document.getElementById('view-live')?.classList.contains('active')){
      const isStartup=firstLiveTunePending;
      firstLiveTunePending=false;
      setTimeout(()=>{
        if(!document.getElementById('view-live')?.classList.contains('active'))return;
        if(isStartup&&tvj) {
          // Go straight to real TVJ; the tuner otherwise substitutes the
          // first previously verified channel, silently breaking this rule.
          const refreshed=filteredChannels().find(c=>typeof v7IsTVJ==='function'&&v7IsTVJ(c));
          return selectChannel((refreshed||tvj).id,true);
        }
        selectChannel(initial.id,true);
      },40);
    }
  };

  function openSearch(){
    const shell=document.getElementById('veloraLiveSearchShell');if(!shell)return;
    searchOpen=true;shell.classList.add('searching');document.body.classList.add('veloraLiveSearching');
    const input=document.getElementById('channelSearch');
    drawChannelList(input?.value||'');
    const hint=document.getElementById('veloraSearchHint');
    if(hint)hint.textContent='Choose a channel. VELORA will return to the TV automatically.';
  }
  function closeSearch(clear=false){
    const shell=document.getElementById('veloraLiveSearchShell');if(!shell)return;
    searchOpen=false;shell.classList.remove('searching');document.body.classList.remove('veloraLiveSearching');
    const input=document.getElementById('channelSearch');
    if(clear&&input){input.value='';drawChannelList('')}
    const hint=document.getElementById('veloraSearchHint');
    if(hint)hint.textContent='Tap the search bar to browse or find a channel.';
  }

  const priorSelectChannel=selectChannel;
  selectChannel=async function(id,autoplay=true){
    if(searchOpen)closeSearch(false);
    const result=await priorSelectChannel(id,autoplay);
    updateControls();
    return result;
  };

  function channelIds(){
    // Remote CH+/CH− must behave like a TV tuner: cycle only through channels
    // VELORA has evidence are currently working. Do not let a search query
    // change the remote's channel loop, and never include session-failed rows.
    const list=browseChannels('');
    const working=list.filter(c=>{
      const row=[...document.querySelectorAll('#channelList [data-channel]')]
        .find(el=>el.dataset.channel===c.id);
      if(row?.classList.contains('v7SessionUnavailable')||row?.getAttribute('aria-disabled')==='true')return false;
      if(typeof v7ChannelRecentlyHealthy==='function')return v7ChannelRecentlyHealthy(c);
      const availability=String(c.availability||'').toLowerCase();
      const sourceHealth=(c.sources||[]).map(s=>String(s.health||'').toLowerCase());
      return availability==='up'||sourceHealth.includes('up');
    });
    return working.map(c=>c.id).filter(Boolean);
  }
  function changeChannel(delta){
    if(typeof window.veloraTuneWorkingChannel==='function')return window.veloraTuneWorkingChannel(delta);
    const ids=channelIds();if(!ids.length)return toast('No channels available.');
    let i=state.currentChannel?ids.indexOf(state.currentChannel.id):-1;
    if(i<0)i=delta>0?-1:0;
    selectChannel(ids[(i+delta+ids.length)%ids.length],true);
  }
  function activeVideo(){
    const v=document.getElementById('inlineLive');
    return v&&!v.classList.contains('hidden')?v:null;
  }
  function updateControls(){
    const v=activeVideo();
    const play=document.querySelector('[data-v15-control="play"] b');
    const mute=document.querySelector('[data-v15-control="mute"]');
    if(play)play.textContent=v&&!v.paused?'Ⅱ':'▶';
    if(mute)mute.classList.toggle('active',!!v?.muted);
  }
  function playPause(){
    const v=activeVideo();if(!v)return toast('This channel controls playback through its source.');
    if(v.paused)v.play().catch(()=>{});else v.pause();setTimeout(updateControls,0);
  }
  function volume(delta){
    const v=activeVideo();if(!v)return toast('Volume is controlled by this source or your device.');
    v.muted=false;v.volume=Math.max(0,Math.min(1,(Number(v.volume)||0)+delta));updateControls();
  }
  function mute(){
    const v=activeVideo();if(!v)return toast('Mute is controlled by this source or your device.');
    v.muted=!v.muted;updateControls();
  }
  async function fullscreen(){
    const v=activeVideo();
    const f=document.getElementById('inlineLiveEmbed');
    const target=v||(f&&!f.classList.contains('hidden')?f:null);
    if(!target)return toast('Start a channel first.');
    try{
      if(document.fullscreenElement)return document.exitFullscreen?.();
      if(target.requestFullscreen)return target.requestFullscreen();
      if(v?.webkitEnterFullscreen)return v.webkitEnterFullscreen();
      if(target.webkitRequestFullscreen)return target.webkitRequestFullscreen();
    }catch{}
    toast('Full screen is not available for this source.');
  }

  document.addEventListener('focusin',e=>{
    if(e.target?.id==='channelSearch')openSearch();
  });
  document.addEventListener('click',e=>{
    if(e.target?.id==='channelSearch'||e.target?.closest?.('.veloraSearchBar')&&!e.target.closest('#veloraSearchCancel'))openSearch();
    if(e.target?.id==='veloraSearchCancel'){e.preventDefault();e.stopImmediatePropagation();closeSearch(false);return}
    const ctl=e.target.closest?.('[data-v15-control]');
    if(ctl){
      e.preventDefault();e.stopImmediatePropagation();
      const a=ctl.dataset.v15Control;
      if(a==='prev')changeChannel(-1);
      else if(a==='next')changeChannel(1);
      else if(a==='play')playPause();
      else if(a==='vol-down')volume(-.1);
      else if(a==='vol-up')volume(.1);
      else if(a==='mute')mute();
      else if(a==='fullscreen')fullscreen();
    }
    if(searchOpen&&e.target.closest?.('[data-channel]')){
      setTimeout(()=>closeSearch(false),0);
    }
  },true);
  document.addEventListener('input',e=>{
    if(e.target?.id==='channelSearch'){
      if(!searchOpen)openSearch();
      drawChannelList(e.target.value||'');
    }
  },true);
  document.addEventListener('play',e=>{if(e.target?.id==='inlineLive')updateControls()},true);
  document.addEventListener('pause',e=>{if(e.target?.id==='inlineLive')updateControls()},true);
  document.addEventListener('volumechange',e=>{if(e.target?.id==='inlineLive')updateControls()},true);
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&searchOpen){e.preventDefault();closeSearch(false)}
  });

  window.veloraLiveV15={openSearch,closeSearch};
})();
