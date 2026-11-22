// VELORA UX V12 — Live TV first, free public access.
(() => {
  function liveHero(){
    const count=typeof filteredChannels==='function'?filteredChannels().length:0;
    return `<section class="veloraLiveHero">
      <div class="veloraLiveHeroCopy">
        <span class="heroEyebrow">FREE LIVE TV • BEGINNING CONCEPTS</span>
        <h1>Live TV.<br><em>Right now.</em></h1>
        <p>VELORA is currently focused on making live television fast, simple and dependable across phone, tablet and TV.</p>
        <div class="actions">
          <button class="primary veloraLiveCTA" data-view="live">◉ Watch Live TV</button>
        </div>
        <div class="veloraLiveStats"><b>${count.toLocaleString()}</b><span>channels currently indexed</span></div>
      </div>
      <div class="veloraLiveOrb"><span>LIVE</span><b>◉</b></div>
    </section>`;
  }

  function renderLiveFirstHome(){
    const el=document.getElementById('view-home');if(!el)return;
    el.innerHTML=`<div class="contentPage veloraLiveHome">
      ${liveHero()}
    </div>`;
  }

  function renderLiveSearch(){
    const el=document.getElementById('view-search');if(!el)return;
    el.innerHTML=`<div class="contentPage veloraSearchPage">
      <div class="pageHead"><div><span class="heroEyebrow">LIVE TV SEARCH</span><h1>Find a channel</h1><p>Search live channels and explore what is available to watch.</p></div></div>
      <div class="searchBar"><input id="globalSearch" autocomplete="off" placeholder="Search channel name or category…"></div>
      <div id="searchResults"></div>
    </div>`;
    drawSearch('');
  }

  function drawLiveSearch(q=''){
    const el=document.getElementById('searchResults');if(!el)return;
    const s=String(q||'').trim().toLowerCase();
    const channels=(typeof filteredChannels==='function'?filteredChannels():[]).filter(x=>!s||(x.name+' '+(x.group||'')+' '+(x.now||'')).toLowerCase().includes(s));
    el.innerHTML=channels.length
      ? `<div class="veloraSearchCount">${channels.length.toLocaleString()} channel${channels.length===1?'':'s'}</div><div class="veloraLiveSearchGrid">${channels.slice(0,160).map(liveCard).join('')}</div>`
      : '<div class="empty">No live channels match that search.</div>';
  }

  // Override the customer-facing pages after all earlier feature layers load.
  renderHome=renderLiveFirstHome;
  renderSearch=renderLiveSearch;
  drawSearch=drawLiveSearch;

  // Ensure the most important action is first on mobile and desktop.
  document.querySelectorAll('[data-view="live"]').forEach(b=>b.classList.add('veloraLiveNav'));

  // If a user is already signed in when this loads, immediately repaint Home.
  if(window.state?.user || (typeof state!=='undefined'&&state.user)){
    try{renderHome()}catch{}
  }
})();