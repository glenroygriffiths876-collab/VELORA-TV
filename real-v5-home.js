renderHome = function(){
  const cat=filteredCatalog();
  const nf=V5_DISCOVERY_ITEMS.filter(x=>x.service.includes('Netflix')&&x.kind==='movie').slice(0,6);
  const hu=V5_DISCOVERY_ITEMS.filter(x=>x.service==='Hulu'&&x.kind==='movie').slice(0,5);
  document.getElementById('view-home').innerHTML=`<div class="hero realHero"><div class="heroCopy">
    <span class="heroEyebrow">VELORA • REAL SOURCES</span>
    <h1>Watch live. Discover everything.</h1>
    <div class="meta"><span>${filteredChannels().length} free live sources</span><span>Jamaica + USA</span><span>Open cinema</span></div>
    <p>Official free live channels, Jamaica coverage, sports and a current discovery guide for Netflix, Hulu and theaters. Velora only says “Play” when it has a stream it can actually show.</p>
    <div class="actions"><button class="primary" data-view="live">◉ Watch Live TV</button><button class="ghost" data-view="discover">★ See What’s Trending</button><button class="ghost" data-view="open">▶ Free Movies</button></div>
  </div></div>
  <div class="homeContent">
    <section class="railSection"><div class="railHead"><h2>Free Live TV • Official Sources</h2><button data-view="live">See all ›</button></div><div class="rail">${filteredChannels().slice(0,10).map(v5ChannelCard).join('')}</div></section>
    ${v5DiscoveryRail('Top 10 on Netflix Jamaica',nf)}
    ${v5DiscoveryRail('Popular on Hulu',hu)}
    ${state.openCinema.length?openRail('Watch Free • Open Cinema',state.openCinema):''}
    ${cat.length?rail('Licensed / Connected Library',cat.slice(0,10),true):`<section class="licenseCallout"><div><span class="heroEyebrow">READY FOR YOUR FIRST CONTENT DEAL</span><h2>Commercial catalogue slot is ready.</h2><p>When an authorized FAST, IPTV or distributor feed is connected, those movies and series appear here automatically.</p></div><button class="ghost" data-view="admin">Connect a feed</button></section>`}
  </div>`;
};

renderCatalogView = function(type){
  const licensed=filteredCatalog().filter(x=>x.type===type);
  const id=type==='movie'?'movies':'series';
  const discovery=V5_DISCOVERY_ITEMS.filter(x=>type==='movie'?(x.kind==='movie'||x.kind==='theater'):x.kind==='series');
  const emptyText=type==='movie'?'movie':'series';
  document.getElementById('view-'+id).innerHTML=`<div class="contentPage">
    <div class="pageHead"><div><span class="heroEyebrow">${type==='movie'?'MOVIES':'SERIES'}</span><h1>${type==='movie'?'Movies':'Series'}</h1>
    <p>${licensed.length?`${licensed.length} titles are currently available from connected authorized sources.`:`No commercial ${emptyText} feed is connected yet — so Velora shows real discovery titles instead of fake playable cards.`}</p></div></div>
    ${licensed.length?`<h2>Available to Play in Velora</h2><div class="catalogGrid">${licensed.map(x=>card(x,true)).join('')}</div>`:''}
    <div class="sectionDivider"><span>DISCOVER NOW</span></div>
    <div class="discoveryGrid">${discovery.slice(0,18).map(v5DiscoveryCard).join('')}</div>
    ${type==='movie'?`<div class="openLibraryCTA"><div><span class="heroEyebrow">WATCH FREE NOW</span><h2>Browse thousands of open-library films</h2><p>Public-domain and openly licensed films play inside Velora.</p></div><button class="primary" data-view="open">Open Free Movies</button></div>`:''}
  </div>`;
};

function renderDiscover(){
  const nf=V5_DISCOVERY_ITEMS.filter(x=>x.service.includes('Netflix')&&x.kind==='movie');
  const hu=V5_DISCOVERY_ITEMS.filter(x=>x.service==='Hulu'&&x.kind==='movie');
  const series=V5_DISCOVERY_ITEMS.filter(x=>x.kind==='series');
  const th=V5_DISCOVERY_ITEMS.filter(x=>x.kind==='theater');
  const el=document.getElementById('view-discover'); if(!el)return;
  el.innerHTML=`<div class="contentPage discoverPage">
    <div class="discoverHero"><span class="heroEyebrow">WHAT PEOPLE ARE WATCHING</span><h1>Trending Elsewhere</h1><p>Current titles from Netflix, Hulu and theaters. These cards are discovery links — Velora only shows a Play button when we actually have playback rights.</p></div>
    <div class="truthBanner"><b>No fake playback.</b><span>If a title belongs to Netflix, Hulu or a cinema distributor, Velora sends you to that provider until we license it ourselves.</span></div>
    <h2>Netflix Jamaica Top 10 Movies</h2><div class="discoveryGrid">${nf.map(v5DiscoveryCard).join('')}</div>
    <h2>Popular / Featured on Hulu</h2><div class="discoveryGrid">${hu.map(v5DiscoveryCard).join('')}</div>
    <h2>Streaming Series</h2><div class="discoveryGrid">${series.map(v5DiscoveryCard).join('')}</div>
    <h2>In Theaters</h2><div class="discoveryGrid">${th.map(v5DiscoveryCard).join('')}</div>
  </div>`;
}

