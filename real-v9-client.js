// Velora V9 — provider-client shell
const V9_CLIENT={
  ready:false,loading:false,error:'',
  provider:null,generatedAt:'',
  live:[],movies:[],series:[],
  recentlyAdded:{movies:[],series:[]}
};
const V9_DEVICE_ID_KEY='velora_client_device_id';
const V9_MODE_KEY='velora_client_mode';

function v9DeviceId(){
  let id=localStorage.getItem(V9_DEVICE_ID_KEY);
  if(!id){id='velora-'+crypto.randomUUID();localStorage.setItem(V9_DEVICE_ID_KEY,id)}
  return id;
}
function v9Mode(){return localStorage.getItem(V9_MODE_KEY)||'sandbox'}
function v9AllVod(){return [...V9_CLIENT.movies,...V9_CLIENT.series]}
function v9Find(id){return v9AllVod().find(x=>x.id===id)}
function v9Remember(item){
  if(!item)return;
  state.history=[item.id,...state.history.filter(x=>x!==item.id)].slice(0,40);
  persist();
}
function v9MergeIntoState(){
  const ids=new Set(v9AllVod().map(x=>x.id));
  const keep=state.catalog.filter(x=>!String(x.id||'').startsWith('sandbox_')&&!ids.has(x.id));
  const mapped=v9AllVod().map(x=>({
    ...x,
    sourceId:'velora_sandbox',
    sourceName:V9_CLIENT.provider?.name||'Velora Sandbox Provider',
    territory:'WORLD',
    priority:70,
    rights:{territories:['WORLD'],starts:'2020-01-01',ends:'2035-12-31'},
    sources:[{sourceId:'velora_sandbox',sourceName:V9_CLIENT.provider?.name||'Velora Sandbox Provider',territory:'WORLD',priority:70}]
  }));
  state.catalog=[...mapped,...keep];
  persist();
}
async function v9LoadProvider(force=false){
  if(V9_CLIENT.loading)return;
  if(V9_CLIENT.ready&&!force)return;
  V9_CLIENT.loading=true;V9_CLIENT.error='';
  try{
    const d=await v7Request('/api/sandbox/provider',{headers:{}});
    V9_CLIENT.provider=d.provider||null;
    V9_CLIENT.generatedAt=d.generatedAt||'';
    V9_CLIENT.live=d.live||[];
    V9_CLIENT.movies=d.movies||[];
    V9_CLIENT.series=d.series||[];
    V9_CLIENT.recentlyAdded=d.recentlyAdded||{movies:[],series:[]};
    V9_CLIENT.ready=true;
    v9MergeIntoState();
    renderAll();
    renderHome();
    if(document.getElementById('view-movies')?.classList.contains('active'))v9RenderMovies();
    if(document.getElementById('view-series')?.classList.contains('active'))v9RenderSeries();
    if(document.getElementById('view-search')?.classList.contains('active'))renderSearch();
    if(document.getElementById('view-mylist')?.classList.contains('active'))renderMyList();
  }catch(e){
    V9_CLIENT.error=e.message||'Sandbox provider unavailable';
    console.warn('V9 provider client failed',e);
  }finally{V9_CLIENT.loading=false}
}
function v9Art(item){
  return esc(item.art||item.backdrop||fallbackArt);
}
function v9VodCard(item){
  const fav=state.favorites.has(item.id);
  const label=item.type==='series'?'SERIES':'MOVIE';
  return `<article class="v9VodCard" tabindex="0" data-v9-detail="${esc(item.id)}">
    <div class="v9VodArt" style="background-image:linear-gradient(180deg,transparent 42%,#05070de6),url('${v9Art(item)}')">
      <span class="quality">${esc(item.quality||label)}</span>
      ${fav?'<span class="badge" style="background:#6c5cff">MY LIST</span>':''}
      <span class="v9HoverPlay">▶</span>
    </div>
    <b>${esc(item.title)}</b>
    <small>${item.year?esc(item.year)+' • ':''}${esc(item.genre||label)} • ${esc(item.sourceName||item.publisher||V9_CLIENT.provider?.name||'Velora')}</small>
  </article>`;
}
function v9Rail(title,items,view){
  if(!items?.length)return'';
  return `<section class="railSection"><div class="railHead"><h2>${esc(title)}</h2><button data-view="${esc(view)}">See all ›</button></div><div class="v9Rail">${items.slice(0,14).map(v9VodCard).join('')}</div></section>`;
}
function v9ContinueItems(){
  return state.history.map(id=>v9Find(id)).filter(Boolean).slice(0,12);
}
function v9ProviderHero(){
  const p=V9_CLIENT.provider;
  const counts=`${V9_CLIENT.live.length.toLocaleString()} live • ${V9_CLIENT.movies.length.toLocaleString()} movies • ${V9_CLIENT.series.length.toLocaleString()} series`;
  return `<section class="v9ProviderHero">
    <div><span class="heroEyebrow">PROVIDER CLIENT MODE</span><h1>One app. One provider contract.</h1>
      <p>Velora is now consuming a single provider-style feed for Live TV, Movies and Series. This sandbox uses public/open media so the client can be perfected without touching anyone else's account.</p>
      <div class="meta"><span>${esc(p?.name||'Velora Sandbox Provider')}</span><span>${counts}</span><span>Device-local client</span></div>
      <div class="actions"><button class="primary" data-view="live">◉ Live TV</button><button class="ghost" data-view="movies">▶ Movies</button><button class="ghost" data-view="series">▤ Series</button></div>
    </div>
    <div class="v9ProviderStatus"><i></i><b>Sandbox connected</b><small>${V9_CLIENT.generatedAt?'Updated '+new Date(V9_CLIENT.generatedAt).toLocaleTimeString():''}</small></div>
  </section>`;
}
const v9PriorRenderHome=renderHome;
renderHome=function(){
  if(!V9_CLIENT.ready){v9PriorRenderHome();return}
  const cont=v9ContinueItems();
  document.getElementById('view-home').innerHTML=`<div class="contentPage v9HomePage">
    ${v9ProviderHero()}
    <div class="v9HomeBody">
      ${cont.length?v9Rail('Continue Watching',cont,'mylist'):''}
      ${v9Rail('Recently Added Movies',V9_CLIENT.recentlyAdded.movies,'movies')}
      ${v9Rail('Recently Added Series',V9_CLIENT.recentlyAdded.series,'series')}
      <section class="railSection"><div class="railHead"><h2>Live Now</h2><button data-view="live">Open guide ›</button></div><div class="rail">${filteredChannels().slice(0,10).map(liveCard).join('')}</div></section>
    </div>
  </div>`;
};
function v9RenderMovies(query=''){
  const el=document.getElementById('view-movies');if(!el)return;
  const q=String(query||'').trim().toLowerCase();
  const items=V9_CLIENT.movies.filter(x=>!q||(x.title+' '+(x.genre||'')+' '+(x.description||'')).toLowerCase().includes(q));
  el.innerHTML=`<div class="contentPage v9LibraryPage">
    <div class="pageHead"><div><span class="heroEyebrow">PROVIDER LIBRARY</span><h1>Movies</h1><p>${V9_CLIENT.movies.length.toLocaleString()} playable movie items from the connected sandbox provider contract.</p></div><span class="status"><i></i>${esc(V9_CLIENT.provider?.name||'Sandbox')}</span></div>
    <div class="v9LibraryTools"><input id="v9MovieSearch" value="${esc(query)}" placeholder="Search movies…"><button class="ghost" data-v9-search-movies>Search</button></div>
    <div class="v9LibraryGrid">${items.map(v9VodCard).join('')}</div>
  </div>`;
}
function v9RenderSeries(query=''){
  const el=document.getElementById('view-series');if(!el)return;
  const q=String(query||'').trim().toLowerCase();
  const items=V9_CLIENT.series.filter(x=>!q||(x.title+' '+(x.genre||'')+' '+(x.description||'')).toLowerCase().includes(q));
  el.innerHTML=`<div class="contentPage v9LibraryPage">
    <div class="pageHead"><div><span class="heroEyebrow">PROVIDER LIBRARY</span><h1>Series</h1><p>${V9_CLIENT.series.length.toLocaleString()} series/items, including grouped full-episode publisher feeds and classic television.</p></div><span class="status"><i></i>${esc(V9_CLIENT.provider?.name||'Sandbox')}</span></div>
    <div class="v9LibraryTools"><input id="v9SeriesSearch" value="${esc(query)}" placeholder="Search series…"><button class="ghost" data-v9-search-series>Search</button></div>
    <div class="v9LibraryGrid">${items.map(v9VodCard).join('')}</div>
  </div>`;
}
function v9PlayItem(item){
  if(!item)return;
  v9Remember(item);
  if(item.youtubeId)return v6PlayYouTube({title:item.title,videoId:item.youtubeId,publisherUrl:'https://www.youtube.com/watch?v='+item.youtubeId});
  if(item.archiveId){
    state.openSaved[item.id]={...item,openSource:true};
    persist();
    return playOpenItem(item.id);
  }
  if(item.url)return openPlayer(item);
  toast('No playable source is attached to this item.');
}
function v9PlayEpisode(show,ep){
  if(!show||!ep)return;
  v9Remember(show);
  if(ep.youtubeId)return v6PlayYouTube({title:ep.title||show.title,videoId:ep.youtubeId,publisherUrl:ep.publisherUrl||('https://www.youtube.com/watch?v='+ep.youtubeId)});
  if(ep.url)return openPlayer({...show,id:ep.id,title:show.title+' • '+(ep.title||('Episode '+ep.num)),url:ep.url,type:'series'});
  toast('No playable source is attached to this episode.');
}
function v9ShowDetails(id){
  const item=v9Find(id);if(!item)return;
  const modal=document.getElementById('detailsModal');
  const episodes=item.episodes||[];
  const seasons=[...new Set(episodes.map(e=>Number(e.season||1)))].sort((a,b)=>a-b);
  const seasonHtml=seasons.map(season=>`<section class="v9Season"><h2>Season ${season}</h2>${episodes.filter(e=>Number(e.season||1)===season).map(ep=>`<div class="episode">
      <img src="${esc(ep.art||item.art||fallbackArt)}" alt="">
      <div><b>${esc(ep.num||'')}. ${esc(ep.title||('Episode '+ep.num))}</b><p>${esc(ep.description||'')}</p></div>
      <button class="ghost" data-v9-episode="${esc(item.id)}" data-v9-episode-id="${esc(ep.id)}">▶ Play</button>
    </div>`).join('')}</section>`).join('');
  modal.querySelector('#detailsCard').innerHTML=`<button class="circleBtn closeDetails" data-close-details>✕</button>
    <div class="detailsHero" style="background-image:url('${v9Art(item)}')"><div class="detailsCopy"><span class="heroEyebrow">${item.type==='series'?'SERIES':'MOVIE'} • PROVIDER CLIENT</span>
      <h1>${esc(item.title)}</h1><div class="meta">${item.year?`<span>${esc(item.year)}</span>`:''}<span>${esc(item.rating||'NR')}</span><span>${esc(item.genre||'')}</span><span>${esc(item.sourceName||item.publisher||V9_CLIENT.provider?.name||'Velora')}</span></div>
      <p>${esc(item.description||'')}</p><div class="actions"><button class="primary" data-v9-play="${esc(item.id)}">▶ Play</button><button class="ghost" data-v9-fav="${esc(item.id)}">${state.favorites.has(item.id)?'✓ My List':'＋ My List'}</button></div>
    </div></div>
    ${seasonHtml}`;
  modal.classList.add('on');document.body.style.overflow='hidden';
}
const v9PriorShowView=showView;
showView=function(id){
  v9PriorShowView(id);
  if(id==='movies'&&V9_CLIENT.ready)v9RenderMovies();
  if(id==='series'&&V9_CLIENT.ready)v9RenderSeries();
};
const v9PriorRenderMyList=renderMyList;
renderMyList=function(){
  if(!V9_CLIENT.ready){v9PriorRenderMyList();return}
  const items=v9AllVod().filter(x=>state.favorites.has(x.id));
  document.getElementById('view-mylist').innerHTML=`<div class="contentPage"><div class="pageHead"><div><span class="heroEyebrow">PERSONAL</span><h1>My List</h1><p>Saved provider movies and series on this device.</p></div></div>${items.length?`<div class="v9LibraryGrid">${items.map(v9VodCard).join('')}</div>`:'<div class="empty">Your list is empty.</div>'}</div>`;
};
const v9PriorRenderSearch=renderSearch;
renderSearch=function(){
  if(!V9_CLIENT.ready){v9PriorRenderSearch();return}
  document.getElementById('view-search').innerHTML=`<div class="contentPage"><div class="pageHead"><div><span class="heroEyebrow">UNIVERSAL SEARCH</span><h1>Search Velora</h1><p>Search Live TV, Movies and Series from the provider client.</p></div></div><div class="searchBar"><input id="globalSearch" autocomplete="off" placeholder="Search channels, movies, series…"></div><div id="searchResults"></div></div>`;drawSearch('');
};
drawSearch=function(q){
  const el=document.getElementById('searchResults');if(!el)return;
  const s=String(q||'').trim().toLowerCase();
  const channels=filteredChannels().filter(x=>!s||(x.name+' '+(x.group||'')).toLowerCase().includes(s));
  const vod=v9AllVod().filter(x=>!s||(x.title+' '+(x.genre||'')+' '+(x.description||'')).toLowerCase().includes(s));
  el.innerHTML=`${channels.length?`<h2>Live TV</h2><div class="rail" style="padding-right:0">${channels.slice(0,10).map(liveCard).join('')}</div>`:''}<h2 style="margin-top:30px">Movies & Series</h2>${vod.length?`<div class="v9LibraryGrid">${vod.slice(0,120).map(v9VodCard).join('')}</div>`:'<div class="empty">No results.</div>'}`;
};

const v9PriorRenderAdmin=renderAdmin;
renderAdmin=function(){
  v9PriorRenderAdmin();
  const page=document.querySelector('#view-admin .contentPage');if(!page)return;
  const card=document.createElement('section');
  card.className='v9ClientPanel';
  card.innerHTML=`<div><span class="heroEyebrow">PROVIDER CLIENT</span><h2>Sandbox Provider Connected</h2><p>This mode proves the Apollo-style client architecture without using anyone else's account. The provider contract supplies Live TV, Movies and Series to one unified client.</p></div>
    <div class="v9ClientFacts"><span><b>${V9_CLIENT.live.length.toLocaleString()}</b> Live</span><span><b>${V9_CLIENT.movies.length.toLocaleString()}</b> Movies</span><span><b>${V9_CLIENT.series.length.toLocaleString()}</b> Series</span><span><b>Local</b> Device ID</span></div>
    <div class="v9ClientDevice"><small>Device client ID</small><code>${esc(v9DeviceId())}</code></div>
    <button class="ghost" id="v9RefreshProvider">↻ Refresh sandbox provider</button>`;
  page.prepend(card);
};

document.addEventListener('click',e=>{
  const detail=e.target.closest('[data-v9-detail]');
  if(detail){e.preventDefault();e.stopImmediatePropagation();v9ShowDetails(detail.dataset.v9Detail);return}
  const play=e.target.closest('[data-v9-play]');
  if(play){e.preventDefault();e.stopImmediatePropagation();closeDetails();v9PlayItem(v9Find(play.dataset.v9Play));return}
  const fav=e.target.closest('[data-v9-fav]');
  if(fav){e.preventDefault();e.stopImmediatePropagation();const id=fav.dataset.v9Fav;if(state.favorites.has(id))state.favorites.delete(id);else state.favorites.add(id);persist();v9ShowDetails(id);renderMyList();return}
  const ep=e.target.closest('[data-v9-episode]');
  if(ep){e.preventDefault();e.stopImmediatePropagation();const show=v9Find(ep.dataset.v9Episode);const episode=show?.episodes?.find(x=>x.id===ep.dataset.v9EpisodeId);closeDetails();v9PlayEpisode(show,episode);return}
  if(e.target.closest('[data-v9-search-movies]')){e.preventDefault();v9RenderMovies(document.getElementById('v9MovieSearch')?.value||'');return}
  if(e.target.closest('[data-v9-search-series]')){e.preventDefault();v9RenderSeries(document.getElementById('v9SeriesSearch')?.value||'');return}
  if(e.target.id==='v9RefreshProvider'){e.preventDefault();V9_CLIENT.ready=false;v9LoadProvider(true).then(()=>renderAdmin());return}
},true);

document.addEventListener('keydown',e=>{
  if(e.key==='Enter'&&e.target?.matches?.('.v9VodCard')){e.preventDefault();v9ShowDetails(e.target.dataset.v9Detail)}
});

setTimeout(()=>v9LoadProvider(false),1100);
