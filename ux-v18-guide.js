// VELORA V18 — always-visible guide of truly video-confirmed channels.
(() => {
  'use strict';
  function escapeText(s) {
    return String(s??'').replace(/[&<>"']/g,c=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    })[c]);
  }
  function guideRows() {
    const ids=window.veloraVerifiedChannels?.ids?.()||[];
    const byId=new Map(filteredChannels().map(c=>[c.id,c]));
    return ids.map(id=>byId.get(id)).filter(Boolean);
  }
  const MAX_PREVIEW=60;
  let expanded=false;
  function standbyRows(){
    const verified=new Set(window.veloraVerifiedChannels?.ids?.()||[]);
    const past=new Set(window.veloraVerifiedChannels?.history?.()||[]);
    const shared=window.veloraSharedPool||new Map();
    const channels=new Map(filteredChannels().map(c=>[c.id,c]));
    const found=new Set();
    return [...shared.keys(),...past].filter(id=>{
      if(found.has(id)||verified.has(id)||!channels.has(id))return false;
      found.add(id);
      return v7LiveCandidates(channels.get(id)).length>0;
    }).map(id=>({channel:channels.get(id),lead:shared.get(id)||null,past:past.has(id)}));
  }
  function update() {
    const holder=document.getElementById('veloraVerifiedGuide');
    if(!holder)return;
    const rows=guideRows();
    const count=document.getElementById('veloraVerifiedCount');
    if(count)count.textContent=String(rows.length);
    const progress=document.getElementById('veloraVerifiedProgress');
    const scan=window.veloraVerifiedChannels?.scanStatus?.();
    if(progress)progress.classList.toggle('veloraIndeterminate',!!scan?.scanning);
    const hint=document.getElementById('veloraVerifiedScanStatus');
    if(hint)hint.textContent=scan?.offline?'Offline • saved channels are kept; checks resume when connected':
      scan?.recovering?'Sources are not passing video checks • retrying shortly; your channel stays selected':
      scan?.paused?'Scanning pauses when VELORA is in the background':
      (scan?.scanning?'Scanning continuously • '+(scan.checked||0).toLocaleString()+' tested this session':
        'Rechecking sources on cooldown • '+(scan?.checked||0).toLocaleString()+' tested')+
        (scan?.shared?' • '+scan.shared.toLocaleString()+' shared leads being verified on this device':'');
    const q=String(document.getElementById('veloraVerifiedSearch')?.value||'').trim().toLowerCase();
    const filtered=rows.filter(c=>v7SearchText(c.name+' '+(c.group||'')).includes(v7SearchText(q))||
      (q&&window.veloraProgrammeLookup?.(c,q)));
    const list=holder.querySelector('#veloraVerifiedRows');
    if(!list)return;
    const html=filtered.map((c,i)=> {
      const selected=state.currentChannel?.id===c.id;
      return '<button class="veloraVerifiedRow'+(selected?' active':'')+
        '" type="button" data-channel="'+escapeText(c.id)+'" aria-label="Play '+escapeText(c.name)+'">'+
        '<span class="veloraVerifiedNumber">'+(i+1)+'</span>'+
        '<span class="veloraVerifiedName">'+escapeText(c.name)+
          (q&&window.veloraProgrammeLookup?.(c,q)?
            '<small class="veloraProgrammeSubtitle">'+
            escapeText(window.veloraProgrammeLookup(c,q).title)+'</small>':'')+
          '</span>'+
        '<span class="veloraVerifiedPlaying">'+(selected?'NOW':'<span class="veloraVerifiedDot"></span>')+'</span>'+
        '</button>';
    }).join('');
    if(list.innerHTML!==html)list.innerHTML=html||(
      '<p class="veloraVerifiedEmpty">'+(q?'No confirmed channels match this search.':
        'Verified channels will appear here as streams pass video playback checks.')+'</p>');
    // Previous success on a different device does NOT count as working here.
    const standby=standbyRows();
    const group=holder.querySelector('#veloraStandbySection');
    if(group)group.hidden=!standby.length;
    const count2=holder.querySelector('#veloraStandbyCount');
    if(count2)count2.textContent=String(standby.length);
    const standbyList=holder.querySelector('#veloraStandbyRows');
    if(standbyList){
      const matching=standby.filter(({channel:c})=>v7SearchText(c.name+' '+(c.group||'')).includes(v7SearchText(q))||
        (q&&window.veloraProgrammeLookup?.(c,q)));
      const visible=q||expanded?matching.slice(0,250):matching.slice(0,MAX_PREVIEW);
      const content=visible.map(({channel:c,lead,past})=>{
        const note=lead?.recent?'Recent viewer success':past?'Previously worked here':'Older viewer success';
        return '<button class="veloraVerifiedRow veloraStandbyRow" type="button" data-channel="'+escapeText(c.id)+
          '" aria-label="Try '+escapeText(c.name)+'">'+
          '<span class="veloraVerifiedName">'+escapeText(c.name)+'</span>'+
          '<span class="veloraStandbyTag">'+escapeText(note)+'</span></button>';
      }).join('')||'<p class="veloraVerifiedEmpty">No matching shared channels. Search the full catalogue above.</p>';
      if(standbyList.innerHTML!==content)standbyList.innerHTML=content;
      const more=holder.querySelector('#veloraStandbyMore');
      if(more){more.hidden=!!q||standby.length<=MAX_PREVIEW;more.textContent=expanded?'Show fewer':'See more ('+standby.length+')'}
    }
    const catalogue=holder.querySelector('#veloraFullCatalogueCount');
    if(catalogue)catalogue.textContent=filteredChannels().length.toLocaleString();
  }
  const previous=renderLive;
  renderLive=function() {
    previous();
    const shell=document.getElementById('veloraLiveSearchShell');
    if(!shell||document.getElementById('veloraVerifiedGuide'))return;
    const guide=document.createElement('section');
    guide.id='veloraVerifiedGuide';
    guide.setAttribute('aria-label','Verified working channels');
    guide.innerHTML='<div class="veloraVerifiedTop">'+
      '<div><span class="veloraVerifiedEyebrow">LIVE CHANNEL GUIDE</span>'+
      '<h3>Working channels <span id="veloraVerifiedCount">0</span></h3>'+
      '<p id="veloraVerifiedScanStatus">Only confirmed video appears here</p></div>'+
      '<button id="veloraVerifiedFindMore" type="button" title="Resume or check the next eligible sources">Check now ↻</button></div>'+
      '<div class="veloraVerifiedTrack"><div id="veloraVerifiedProgress"></div></div>'+
      '<input id="veloraVerifiedSearch" type="search" placeholder="Filter working channels…" autocomplete="off" aria-label="Filter working channels">'+
      '<div id="veloraVerifiedRows" class="veloraVerifiedRows"></div>'+
      '<section id="veloraStandbySection" class="veloraStandbySection" hidden>'+
        '<div class="veloraStandbyHeader"><h4>Previously played channels <span id="veloraStandbyCount">0</span></h4>'+
        '<p>From Velora viewers and past sessions. Tap to test here; only locally confirmed video enters Working.</p></div>'+
        '<div id="veloraStandbyRows" class="veloraVerifiedRows veloraStandbyRows"></div>'+
        '<button type="button" id="veloraStandbyMore" class="veloraStandbyMore" hidden>See more</button>'+
      '</section>'+
      '<p class="veloraCatalogueHint"><span id="veloraFullCatalogueCount">0</span> channel listings available to search. Each stream is verified on this device when selected; not all are continuously online.</p>'+
      '<button type="button" id="veloraBrowseAllChannels" class="veloraStandbyMore">Browse all channel listings ↗</button>';
    shell.after(guide);
    update();
  };
  const priorSelect=selectChannel;
  selectChannel=function(id,autoplay=true) {
    const result=priorSelect(id,autoplay);
    update();
    return result;
  };
  document.addEventListener('input',e=>{
    if(e.target?.id==='veloraVerifiedSearch')update();
  },true);
  document.addEventListener('click',e=>{
    if(e.target?.id==='veloraBrowseAllChannels'){
      e.preventDefault();
      window.veloraLiveV15?.openSearch?.();
      document.getElementById('channelSearch')?.focus?.();
      return;
    }
    if(e.target?.id==='veloraStandbyMore'){
      e.preventDefault();expanded=!expanded;update();return;
    }
    if(e.target?.id!=='veloraVerifiedFindMore')return;
    e.preventDefault();e.stopImmediatePropagation();
    window.veloraVerifiedChannels?.scan?.();
    update();
  },true);
  window.veloraVerifiedGuide={refresh:update};
  // Modest UI refresh while the Live screen is actually open; no unnecessary
  // rerendering or scroll jumps in the existing player.
  setInterval(()=>{
    if(document.getElementById('view-live')?.classList.contains('active'))update();
  },3000);
})();
