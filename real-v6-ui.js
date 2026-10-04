// Velora V6 UI — no broken provider frames in the web build

function v6PublisherSheet(url,label='Official source'){
  let shell=document.getElementById('v6ProviderSheet');
  if(!shell){
    shell=document.createElement('div');shell.id='v6ProviderSheet';shell.className='v6ProviderSheet';
    shell.innerHTML=`<div class="v6ProviderCard"><button class="circleBtn v6ProviderClose">✕</button><span class="heroEyebrow">OFFICIAL PROVIDER</span><h2 class="v6ProviderName">Official source</h2><p>Velora did not load this website in a frame because the provider may block framing. That prevents the ugly “refused to connect” screen.</p><div class="v6ProviderDomain"></div><button class="primary v6ProviderOpen">Open official source ↗</button></div>`;
    document.body.appendChild(shell);
    shell.querySelector('.v6ProviderClose').onclick=()=>{shell.classList.remove('on');document.body.style.overflow=''};
    shell.querySelector('.v6ProviderOpen').onclick=()=>{const u=shell.dataset.url;if(u)window.open(u,'_blank','noopener,noreferrer')};
  }
  shell.dataset.url=url; shell.querySelector('.v6ProviderName').textContent=label;
  try{shell.querySelector('.v6ProviderDomain').textContent=new URL(url).hostname}catch{shell.querySelector('.v6ProviderDomain').textContent='Official provider'}
  shell.classList.add('on');document.body.style.overflow='hidden';
}
v5OpenInApp = function(url,label='Official source'){v6PublisherSheet(url,label)};

function v6YoutubeFromEmbed(url){
  if(!url)return null;
  let m=url.match(/youtube\.com\/embed\/([^?&/]+)/);
  if(m&&m[1]!=='live_stream'&&m[1]!=='videoseries')return {videoId:m[1]};
  m=url.match(/[?&]list=([^&]+)/);if(m)return {playlistId:m[1]};
  return null;
}
v5OpenChannel = function(c,full=false){
  if(!c)return;
  if(c.embedUrl){
    const yt=v6YoutubeFromEmbed(c.embedUrl);
    if(yt){v6PlayYouTube({title:c.name,...yt,publisherUrl:c.watchUrl||''});return}
    // Channel-based YouTube live embeds can rotate. Keep them out of the visible iframe-error path.
    if(c.embedUrl.includes('youtube.com/embed/live_stream')){
      v6PublisherSheet(c.watchUrl||'https://www.youtube.com/',c.name+' • current live feed');
      return;
    }
  }
  if(c.url&&full){openPlayer(c);return}
  if(c.watchUrl){v6PublisherSheet(c.watchUrl,c.name);return}
  selectChannel(c.id,true);
};

selectChannel = function(id,autoplay=true){
  const c=filteredChannels().find(x=>x.id===id);if(!c)return;state.currentChannel=c;
  drawChannelList(document.getElementById('channelSearch')?.value||'');
  const t=document.getElementById('nowChannel'),p=document.getElementById('nowProgram'),v=document.getElementById('inlineLive'),f=document.getElementById('inlineLiveEmbed'),panel=document.getElementById('officialWatchPanel'),fallback=document.getElementById('openProviderFallback');
  if(t)t.textContent=c.name;if(p)p.textContent=`${c.now||'Live'} • ${c.access||c.group||''}`;
  if(v){v.pause();v.removeAttribute('src');v.classList.add('hidden')}if(f){f.src='about:blank';f.classList.add('hidden')}
  if(fallback){fallback.hidden=!c.watchUrl;fallback.dataset.v5External=c.watchUrl||'';fallback.textContent='Official source ↗'}
  if(panel){
    panel.classList.remove('hidden');
    const direct=!!v6YoutubeFromEmbed(c.embedUrl)||!!c.url;
    panel.innerHTML=`<div class="channelMonogram big">${esc(c.short||'TV')}</div><span class="officialPill">${c.official?'✓ OFFICIAL SOURCE':'CONNECTED FEED'}</span><h2>${esc(c.name)}</h2><p>${esc(c.desc||c.now||'Live programming')}</p><button class="primary" data-v6-channel-play="${esc(c.id)}">${direct?'▶ Play inside Velora':'View official source'}</button>`;
  }
};

function v6RenderHome(){
  const cat=filteredCatalog(),nf=V5_DISCOVERY_ITEMS.filter(x=>x.service.includes('Netflix')&&x.kind==='movie').slice(0,6),hu=V5_DISCOVERY_ITEMS.filter(x=>x.service==='Hulu'&&x.kind==='movie').slice(0,5);
  const jamaica=filteredChannels().filter(x=>x.group==='Jamaica'),caribbean=filteredChannels().filter(x=>x.group==='Caribbean');
  document.getElementById('view-home').innerHTML=`<div class="hero realHero"><div class="heroCopy"><span class="heroEyebrow">VELORA • REAL SOURCES</span><h1>Watch live. Watch full movies.</h1><div class="meta"><span>${filteredChannels().length} official / connected sources</span><span>2026 full movies</span><span>Jamaica + Caribbean</span></div><p>Velora now prioritizes sources that can actually play in-app. Blocked provider pages are never shown as broken frames.</p><div class="actions"><button class="primary" data-view="live">◉ Watch Live TV</button><button class="ghost" data-view="movies">▶ Full Movies</button><button class="ghost" data-view="discover">★ Trending</button></div></div></div>
  <div class="homeContent">
    ${v6LatestMovieRail()}
    ${v6MovieChannelsBlock()}
    ${jamaica.length?`<section class="railSection"><div class="railHead"><h2>Jamaica Live</h2><button data-view="live">Open Jamaica TV ›</button></div><div class="rail">${jamaica.map(v5ChannelCard).join('')}</div></section>`:''}
    ${caribbean.length?`<section class="railSection"><div class="railHead"><h2>Caribbean Live</h2><button data-view="live">See Caribbean channels ›</button></div><div class="rail">${caribbean.map(v5ChannelCard).join('')}</div></section>`:''}
    <section class="railSection"><div class="railHead"><h2>Free Live TV • Official Sources</h2><button data-view="live">See all ›</button></div><div class="rail">${filteredChannels().filter(x=>x.group!=='Jamaica').slice(0,10).map(v5ChannelCard).join('')}</div></section>
    ${v5DiscoveryRail('Top 10 on Netflix Jamaica',nf)}
    ${v5DiscoveryRail('Popular on Hulu',hu)}
    ${state.openCinema.length?openRail('Open Cinema Archive',state.openCinema):''}
    ${cat.length?rail('Connected Library',cat.slice(0,10),true):''}
  </div>`;
}
renderHome=v6RenderHome;

const v6OldRenderCatalog=renderCatalogView;
renderCatalogView=function(type){
  if(type!=='movie')return v6OldRenderCatalog(type);
  const licensed=filteredCatalog().filter(x=>x.type==='movie');
  const discovery=V5_DISCOVERY_ITEMS.filter(x=>x.kind==='movie'||x.kind==='theater');
  document.getElementById('view-movies').innerHTML=`<div class="contentPage v6MoviesPage"><div class="pageHead"><div><span class="heroEyebrow">WATCH NOW</span><h1>Movies</h1><p>Full publisher movies that play inside Velora, including recent 2026 independent releases.</p></div></div>
    <h2>New & Recent Full Movies</h2><div class="v6MovieGrid">${V6_PUBLISHER_MOVIES.map(v6MovieCard).join('')}</div>
    ${v6MovieChannelsBlock()}
    ${licensed.length?`<div class="sectionDivider"><span>CONNECTED LIBRARY</span></div><div class="catalogGrid">${licensed.map(x=>card(x,true)).join('')}</div>`:''}
    <div class="sectionDivider"><span>POPULAR ELSEWHERE</span></div><div class="discoveryGrid">${discovery.slice(0,16).map(v5DiscoveryCard).join('')}</div>
  </div>`;
};

document.addEventListener('click',e=>{
  const b=e.target.closest('[data-v6-channel-play]');
  if(b){e.preventDefault();e.stopImmediatePropagation();const c=filteredChannels().find(x=>x.id===b.dataset.v6ChannelPlay);if(c)v5OpenChannel(c,true)}
},true);

if(state.user){renderAll();showView('home')}
