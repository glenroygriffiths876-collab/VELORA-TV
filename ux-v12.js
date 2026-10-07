// VELORA UX V12 — Live TV first private preview.
(() => {
  const privateNotice=()=>`
    <aside class="veloraPrivateNotice" role="note">
      <div class="veloraPrivateIcon">V</div>
      <div>
        <span>PRIVATE PREVIEW</span>
        <b>You’re seeing VELORA because you’re a trusted friend or family member of the developer.</b>
        <p>Please don’t share this app, link, login or screenshots publicly. Live TV is the main working experience right now. Movies and Series are still being developed while we work on reliable, properly authorized ways to add newer content.</p>
      </div>
    </aside>`;

  function liveHero(){
    const count=typeof filteredChannels==='function'?filteredChannels().length:0;
    return `<section class="veloraLiveHero">
      <div class="veloraLiveHeroCopy">
        <span class="heroEyebrow">VELORA PRIVATE BETA</span>
        <h1>Live TV.<br><em>Right now.</em></h1>
        <p>VELORA is currently focused on making live television fast, simple and dependable across phone, tablet and TV.</p>
        <div class="actions">
          <button class="primary veloraLiveCTA" data-view="live">◉ Watch Live TV</button>
          <button class="ghost" data-view="search">⌕ Find a channel</button>
        </div>
        <div class="veloraLiveStats"><b>${count.toLocaleString()}</b><span>channels currently indexed</span></div>
      </div>
      <div class="veloraLiveOrb"><span>LIVE</span><b>◉</b></div>
    </section>`;
  }

  function renderLiveFirstHome(){
    const el=document.getElementById('view-home');if(!el)return;
    el.innerHTML=`<div class="contentPage veloraLiveHome">
      ${privateNotice()}
      ${liveHero()}
      <div class="veloraLiveHomeBody">
        <section class="veloraComingStrip">
          <div><span class="veloraSectionKicker">IN DEVELOPMENT</span><h2>Movies & Series</h2><p>We’re working on a better catalogue and more reliable ways to add newer movies and series. Rather than show an unfinished library, this area will stay intentionally simple until it is ready.</p></div>
          <button class="ghost" data-view="movies">See progress</button>
        </section>
      </div>
    </div>`;
  }

  function renderComing(kind){
    const el=document.getElementById('view-'+kind);if(!el)return;
    const title=kind==='movies'?'Movies':'Series';
    el.innerHTML=`<div class="contentPage veloraComingPage">
      <section class="veloraComingHero">
        <span class="heroEyebrow">PRIVATE BETA • IN DEVELOPMENT</span>
        <div class="veloraComingMark">COMING<br>SOON</div>
        <h1>${title} are being rebuilt properly.</h1>
        <p>We’re testing reliable, properly authorized sources and a smoother viewing experience before making this section a major part of VELORA.</p>
        <div class="veloraComingActions">
          <button class="primary" data-view="live">◉ Watch Live TV instead</button>
          <button class="ghost" data-view="home">Back home</button>
        </div>
      </section>
      ${privateNotice()}
    </div>`;
  }

  function renderLiveSearch(){
    const el=document.getElementById('view-search');if(!el)return;
    el.innerHTML=`<div class="contentPage veloraSearchPage">
      <div class="pageHead"><div><span class="heroEyebrow">LIVE TV SEARCH</span><h1>Find a channel</h1><p>Search the part of VELORA that is ready for testing now.</p></div></div>
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
  if(typeof renderCatalogView==='function'){
    renderCatalogView=function(type){renderComing(type==='series'?'series':'movies')};
  }
  if(typeof v9RenderMovies==='function')v9RenderMovies=()=>renderComing('movies');
  if(typeof v9RenderSeries==='function')v9RenderSeries=()=>renderComing('series');
  renderSearch=renderLiveSearch;
  drawSearch=drawLiveSearch;

  // Ensure the most important action is first on mobile and desktop.
  document.querySelectorAll('[data-view="live"]').forEach(b=>b.classList.add('veloraLiveNav'));

  // If a user is already signed in when this loads, immediately repaint Home.
  if(window.state?.user || (typeof state!=='undefined'&&state.user)){
    try{renderHome()}catch{}
  }
})();