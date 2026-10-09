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
    if(hint)hint.textContent=scan?.paused?'Scanning pauses when VELORA is in the background':
      (scan?.scanning?'Scanning continuously • '+(scan.checked||0).toLocaleString()+' tested this session':
        'Rechecking sources on cooldown • '+(scan?.checked||0).toLocaleString()+' tested');
    const q=String(document.getElementById('veloraVerifiedSearch')?.value||'').trim().toLowerCase();
    const filtered=rows.filter(c=>(c.name+' '+(c.group||'')).toLowerCase().includes(q)||
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
      '<div id="veloraVerifiedRows" class="veloraVerifiedRows"></div>';
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
