// Velora V8 — in-app movie & series library
const V8_VOD={
  movie:{items:[],page:0,total:0,loading:false,error:''},
  series:{items:[],page:0,total:0,loading:false,error:''}
};
const V8_DYNAMIC_PUBLISHERS={movie:[],series:[]};
let V8_PUBLISHERS_LOADED=false;


async function v8LoadDynamicPublishers(){
  if(V8_PUBLISHERS_LOADED)return;
  try{
    const [movies,series]=await Promise.all([
      v7Request('/api/vod/publishers?kind=movie',{headers:{}}),
      v7Request('/api/vod/publishers?kind=series',{headers:{}})
    ]);
    V8_DYNAMIC_PUBLISHERS.movie=movies.items||[];
    V8_DYNAMIC_PUBLISHERS.series=series.items||[];
    V8_PUBLISHERS_LOADED=true;
  }catch(e){
    console.warn('Publisher VOD feeds unavailable',e);
  }
}
function v8DynamicPublisherCard(x){
  return `<article class="v8VodCard" data-v8-publisher="${esc(x.id)}">
    <div class="v8VodArt" style="background-image:linear-gradient(180deg,transparent 45%,#05070bdd),url('${esc(x.art||fallbackArt)}')">
      <span class="badge">${x.type==='series'?'FULL EPISODE':'FULL MOVIE'}</span><span class="v8Play">▶</span>
    </div>
    <b>${esc(x.title)}</b><small>${esc(x.publisher||x.sourceName||'Publisher')}${x.year?' • '+esc(x.year):''}</small>
  </article>`;
}
function v8FindPublisherItem(id){
  return [...V8_DYNAMIC_PUBLISHERS.movie,...V8_DYNAMIC_PUBLISHERS.series].find(x=>x.id===id);
}

async function v8FetchArchive(kind,page=1,append=false,search=''){
  const bucket=V8_VOD[kind]; if(!bucket||bucket.loading)return;
  bucket.loading=true;bucket.error='';
  if(!append){bucket.items=[];bucket.page=0}
  v8RenderVod(kind);
  try{
    const url=archiveSearchUrl(kind,page,search,'downloads desc');
    const r=await fetch(url,{mode:'cors'});
    if(!r.ok)throw new Error('Catalogue unavailable');
    const d=await r.json();
    const docs=d?.response?.docs||[];
    const items=docs.map(x=>openDocToItem(x,kind)).filter(x=>x.archiveId);
    bucket.items=append?[...bucket.items,...items]:items;
    bucket.total=Number(d?.response?.numFound||bucket.items.length);
    bucket.page=page;
    for(const item of items)state.openSaved[item.id]=item;
    persist();
  }catch(e){
    bucket.error='Archive library could not refresh right now.';
  }finally{
    bucket.loading=false;v8RenderVod(kind);
  }
}
function v8ArchiveCard(item){
  return `<article class="v8VodCard" data-v8-open="${esc(item.id)}">
    <div class="v8VodArt" style="background-image:linear-gradient(180deg,transparent 45%,#05070bdd),url('${esc(item.art||fallbackArt)}')">
      <span class="badge">${item.type==='series'?'SERIES':'MOVIE'}</span><span class="v8Play">▶</span>
    </div>
    <b>${esc(item.title)}</b><small>${esc(item.genre||'Classic')}${item.year?' • '+esc(item.year):''}</small>
  </article>`;
}
function v8PublisherCard(x){
  return `<article class="v8VodCard" data-v6-movie="${esc(x.id)}">
    <div class="v8VodArt" style="background-image:linear-gradient(180deg,transparent 45%,#05070bdd),url('${esc(x.art)}')">
      <span class="badge">${esc(x.tag||'FULL MOVIE')}</span><span class="v8Play">▶</span>
    </div>
    <b>${esc(x.title)}</b><small>${x.year?esc(x.year)+' • ':''}${esc(x.genre||'Movie')}</small>
  </article>`;
}
function v8RenderVod(kind){
  const id=kind==='movie'?'movies':'series';
  const el=document.getElementById('view-'+id); if(!el)return;
  const bucket=V8_VOD[kind];
  const staticPublisher=kind==='movie'?V6_PUBLISHER_MOVIES:[];
  const dynamicPublisher=V8_DYNAMIC_PUBLISHERS[kind]||[];
  const publisher=[...dynamicPublisher,...staticPublisher.filter(x=>!dynamicPublisher.some(y=>String(y.youtubeId||'')===String(x.youtubeId||'')))];
  const cards=[...dynamicPublisher.map(v8DynamicPublisherCard),...staticPublisher.filter(x=>!dynamicPublisher.some(y=>String(y.youtubeId||'')===String(x.youtubeId||''))).map(v8PublisherCard),...bucket.items.map(v8ArchiveCard)].join('');
  const title=kind==='movie'?'Movies':'Series';
  const subtitle=kind==='movie'
    ?'Full movies that play inside Velora — recent publisher releases plus a large open-film library.'
    :'Classic television and full episodes that play inside Velora — no Netflix or Hulu handoff required.';
  el.innerHTML=`<div class="contentPage v8VodPage">
    <section class="v8VodHero"><div><span class="heroEyebrow">WATCH INSIDE VELORA</span><h1>${title}</h1><p>${subtitle}</p></div>
      <div class="v8VodCount"><b>${(publisher.length+bucket.total).toLocaleString()}</b><span>playable titles/items</span></div>
    </section>
    <div class="v8VodTools">
      <input id="v8Search-${kind}" placeholder="Search ${title.toLowerCase()}…" value="">
      <button class="ghost" data-v8-search="${kind}">Search</button>
    </div>
    ${kind==='movie'?'<div class="v8SourceStrip"><span>2026 publisher movies</span><span>Feature films</span><span>Play in-app</span></div>':'<div class="v8SourceStrip"><span>Classic TV</span><span>Full episodes</span><span>Play in-app</span></div>'}
    ${bucket.error?`<div class="libraryError">${esc(bucket.error)}</div>`:''}
    ${bucket.loading&&!bucket.items.length?'<div class="openLoading"><span></span><b>Loading playable library…</b></div>':''}
    <div class="v8VodGrid">${cards}</div>
    ${bucket.items.length&&bucket.items.length<bucket.total?`<div class="loadMoreWrap"><button class="ghost" data-v8-more="${kind}" ${bucket.loading?'disabled':''}>${bucket.loading?'Loading…':'Load 48 more'}</button><small>Showing ${(publisher.length+bucket.items.length).toLocaleString()} of ${(publisher.length+bucket.total).toLocaleString()}</small></div>`:''}
  </div>`;
}
async function v8EnsureVod(kind){
  v8RenderVod(kind);
  await v8LoadDynamicPublishers();
  v8RenderVod(kind);
  const b=V8_VOD[kind];
  if(!b.items.length&&!b.loading)v8FetchArchive(kind,1,false,'');
}

const v8PreviousShowView=showView;
showView=function(id){
  v8PreviousShowView(id);
  if(id==='movies')v8EnsureVod('movie');
  if(id==='series')v8EnsureVod('series');
};

document.addEventListener('click',e=>{
  const pub=e.target.closest('[data-v8-publisher]');
  if(pub){
    e.preventDefault();e.stopImmediatePropagation();
    const item=v8FindPublisherItem(pub.dataset.v8Publisher);
    if(item?.youtubeId)v6PlayYouTube({title:item.title,videoId:item.youtubeId,publisherUrl:'https://www.youtube.com/watch?v='+item.youtubeId});
    return;
  }
  const open=e.target.closest('[data-v8-open]');
  if(open){
    e.preventDefault();e.stopImmediatePropagation();
    const id=open.dataset.v8Open;
    const item=state.openSaved[id]||V8_VOD.movie.items.find(x=>x.id===id)||V8_VOD.series.items.find(x=>x.id===id);
    if(item){state.openSaved[id]=item;persist();playOpenItem(id)}
    return;
  }
  const more=e.target.closest('[data-v8-more]');
  if(more){
    e.preventDefault();const kind=more.dataset.v8More;const b=V8_VOD[kind];
    v8FetchArchive(kind,(b.page||1)+1,true,'');return;
  }
  const search=e.target.closest('[data-v8-search]');
  if(search){
    e.preventDefault();const kind=search.dataset.v8Search;
    const q=document.getElementById('v8Search-'+kind)?.value.trim()||'';
    v8FetchArchive(kind,1,false,q);return;
  }
},true);

// Replace Home with in-app playback first. Netflix/Hulu stay in Trending only.
const v8PreviousRenderHome=renderHome;
renderHome=function(){
  v8PreviousRenderHome();
  const home=document.getElementById('view-home'); if(!home)return;
  const content=home.querySelector('.homeContent'); if(!content)return;
  // Remove discovery-only Netflix/Hulu rails from Home.
  [...content.querySelectorAll('.railSection')].forEach(sec=>{
    const h=sec.querySelector('h2')?.textContent||'';
    if(/Netflix|Hulu/i.test(h))sec.remove();
  });
  const playable=document.createElement('section');
  playable.className='railSection v8HomePlayable';
  playable.innerHTML=`<div class="railHead"><h2>Watch Now • Full Movies in Velora</h2><button data-view="movies">See all ›</button></div><div class="v6MovieRail">${V6_PUBLISHER_MOVIES.slice(0,10).map(v8PublisherCard).join('')}</div>`;
  content.prepend(playable);
};

if(state.user){
  renderHome();
  if(document.getElementById('view-movies')?.classList.contains('active'))v8EnsureVod('movie');
  if(document.getElementById('view-series')?.classList.contains('active'))v8EnsureVod('series');
}

async function v8RefreshHomePublishers(){
  await v8LoadDynamicPublishers();
  renderHome();
}
setTimeout(v8RefreshHomePublishers,1400);
