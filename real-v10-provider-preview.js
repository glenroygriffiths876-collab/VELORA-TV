// Velora V10 — commercial provider catalogue preview
const V10_PROVIDER_PREVIEW=[
  {id:'cv-terrifier3',type:'movie',title:'Terrifier 3',year:'2024',genre:'Horror',provider:'Cineverse',art:'https://explore.cineverse.com/wp-content/uploads/terrifier-3-1-1200x630-1.jpg',status:'Licensing catalogue'},
  {id:'cv-allfriends',type:'movie',title:'All My Friends Are Dead',year:'2024',genre:'Horror',provider:'Cineverse',art:'https://explore.cineverse.com/wp-content/uploads/all-my-friends-are-dead-1-1200x630-1.jpg',status:'Licensing catalogue'},
  {id:'cv-represent',type:'movie',title:'Represent',year:'2024',genre:'Documentary',provider:'Cineverse',art:'https://explore.cineverse.com/wp-content/uploads/represent-1-1200x630-1.jpg',status:'Licensing catalogue'},
  {id:'cv-beavers',type:'movie',title:'Hundreds of Beavers',year:'2024',genre:'Comedy',provider:'Cineverse / Filmhub',art:'https://explore.cineverse.com/wp-content/uploads/hundreds-of-beavers-1-1200x630-1.jpg',status:'Ready-to-license title'},
  {id:'cv-dontlook',type:'movie',title:"Don't Look Deeper",year:'2020',genre:'Sci-Fi',provider:'Cineverse',art:'https://explore.cineverse.com/wp-content/uploads/dont-look-deeper-1-1200x630-1.jpg',status:'Licensing catalogue'},
  {id:'cv-hereblood',type:'movie',title:'Here for Blood',year:'2024',genre:'Horror / Comedy',provider:'Cineverse',art:'https://explore.cineverse.com/wp-content/uploads/here-for-blood-1-1200x630-1.jpg',status:'Licensing catalogue'},
  {id:'fh-meru',type:'movie',title:'Meru',year:'2015',genre:'Documentary / Adventure',provider:'Filmhub',status:'Featured ready-to-license'},
  {id:'fh-everything',type:'movie',title:'Everything is Both',year:'2023',genre:'Drama',provider:'Filmhub',status:'Featured ready-to-license'},
  {id:'fh-program',type:'movie',title:'The Program',year:'2024',genre:'Documentary',provider:'Filmhub',status:'Featured ready-to-license'},
  {id:'fh-headclouds',type:'movie',title:'Head in the Clouds',year:'2004',genre:'Drama / Romance',provider:'Filmhub',status:'Featured ready-to-license'},
  {id:'cv-camp',type:'movie',title:'Camp',year:'2026',genre:'Horror',provider:'Cineverse / Fandor',status:'Streaming October 2026'},
  {id:'cv-inthemouth',type:'movie',title:'In the Mouth',year:'2026',genre:'Comedy / Thriller',provider:'Cineverse / Fandor',status:'Streaming October 2026'},
  {id:'cv-creaturepines',type:'movie',title:'Creature of the Pines',year:'2026',genre:'Found Footage / Horror',provider:'Cineverse / Screambox',status:'Streaming October 2026'},
  {id:'cv-peepingtodd',type:'movie',title:'Peeping Todd',year:'2026',genre:'Thriller',provider:'Cineverse / Midnight Pulp',status:'Streaming October 2026'},
  {id:'cv-bloodbath',type:'movie',title:'Bloodbath at the House of Death',year:'1984',genre:'Horror / Comedy',provider:'Cineverse / Screambox',status:'Streaming October 2026'},
  {id:'cv-balearic',type:'movie',title:'Balearic',year:'2026',genre:'Drama / Thriller',provider:'Cineverse / Fandor',status:'Streaming October 2026'},
  {id:'cv-yugioh',type:'series',title:'Yu-Gi-Oh!',year:'2000–2020',genre:'Anime',provider:'Cineverse',art:'https://explore.cineverse.com/wp-content/uploads/yu-gi-oh-1-1200x630-1.jpg',status:'Series licensing catalogue'},
  {id:'cv-dogwhisperer',type:'series',title:'The Dog Whisperer',year:'2004–2016',genre:'Reality',provider:'Cineverse',art:'https://explore.cineverse.com/wp-content/uploads/the-dog-whisperer-1-1200x630-1.jpg',status:'Series licensing catalogue'},
  {id:'cv-studiocity',type:'series',title:'Studio City',year:'2019–2022',genre:'Drama',provider:'Cineverse',art:'https://explore.cineverse.com/wp-content/uploads/studio-city-1-1200x630-1.jpg',status:'Series licensing catalogue'},
  {id:'cv-sidechicks',type:'series',title:'The Side Chicks of LA',year:'2024',genre:'Reality',provider:'Cineverse',art:'https://explore.cineverse.com/wp-content/uploads/side-chicks-of-la-1-1200x630-1.jpg',status:'Series licensing catalogue'}
];

function v10FallbackStyle(item){
  const seed=[...item.title].reduce((n,c)=>n+c.charCodeAt(0),0);
  const a=(seed*37)%360,b=(a+52)%360;
  return `background-image:linear-gradient(145deg,hsl(${a} 46% 24%),hsl(${b} 58% 10%));`;
}
function v10PreviewCard(item){
  const style=item.art
    ?`background-image:linear-gradient(180deg,transparent 35%,#04060be8),url('${esc(item.art)}')`
    :'';
  return `<article class="v10PreviewCard" tabindex="0" data-v10-preview="${esc(item.id)}">
    <div class="v10PreviewArt" style="${style||v10FallbackStyle(item)}">
      <span class="v10ProviderBadge">${esc(item.provider)}</span>
      <span class="v10PreviewTag">PREVIEW</span>
      <span class="v10PreviewPlay">▶</span>
      ${!item.art?`<strong class="v10TitleArt">${esc(item.title)}</strong>`:''}
    </div>
    <b>${esc(item.title)}</b>
    <small>${esc(item.year)} • ${esc(item.genre)}</small>
  </article>`;
}
function v10PreviewRail(title,items){
  return `<section class="railSection v10CommercialRail"><div class="railHead"><div><span class="heroEyebrow">COMMERCIAL PROVIDER PREVIEW</span><h2>${esc(title)}</h2></div><span class="v10RailStatus">LICENSING CONNECTION REQUIRED</span></div><div class="v10Rail">${items.map(v10PreviewCard).join('')}</div></section>`;
}
function v10InsertHomePreview(){
  const body=document.querySelector('#view-home .v9HomeBody')||document.querySelector('#view-home .homeContent');
  if(!body||body.querySelector('.v10CommercialRail'))return;
  const wrap=document.createElement('div');
  wrap.innerHTML=v10PreviewRail('What Velora looks like with a commercial catalogue',V10_PROVIDER_PREVIEW.filter(x=>x.type==='movie').slice(0,12));
  body.prepend(wrap.firstElementChild);
}
function v10InsertLibraryPreview(kind){
  const id=kind==='movie'?'movies':'series';
  const page=document.querySelector('#view-'+id+' .v9LibraryPage')||document.querySelector('#view-'+id+' .contentPage');
  if(!page||page.querySelector('.v10LibraryPreview'))return;
  const items=V10_PROVIDER_PREVIEW.filter(x=>x.type===kind);
  if(!items.length)return;
  const section=document.createElement('section');
  section.className='v10LibraryPreview';
  section.innerHTML=`<div class="v10PreviewHead"><div><span class="heroEyebrow">COMMERCIAL PROVIDER PREVIEW</span><h2>${kind==='movie'?'Licensed Movie Catalogue':'Licensed Series Catalogue'}</h2><p>Real titles publicly listed by Cineverse and Filmhub. This is the exact shelf experience Velora can use once a commercial feed is contracted.</p></div><span>PREVIEW ONLY</span></div><div class="v10Grid">${items.map(v10PreviewCard).join('')}</div>`;
  const tools=page.querySelector('.v9LibraryTools,.v8VodTools,.filterRow');
  if(tools)tools.after(section);else page.prepend(section);
}
function v10ShowPreview(id){
  const item=V10_PROVIDER_PREVIEW.find(x=>x.id===id);if(!item)return;
  const modal=document.getElementById('detailsModal'),card=document.getElementById('detailsCard');if(!modal||!card)return;
  const backdrop=item.art?`url('${esc(item.art)}')`:'linear-gradient(145deg,#201849,#0a101d)';
  card.innerHTML=`<button class="circleBtn closeDetails" data-close-details>✕</button>
    <div class="detailsHero v10DetailsHero" style="background-image:${backdrop}">
      <div class="detailsCopy"><span class="heroEyebrow">COMMERCIAL PROVIDER PREVIEW</span><h1>${esc(item.title)}</h1>
      <div class="meta"><span>${esc(item.year)}</span><span>${esc(item.genre)}</span><span>${esc(item.provider)}</span></div>
      <p>This is a real title publicly shown in the provider's licensing/catalogue material. Velora can display, organize and play it through the same interface once the commercial provider supplies an authorized feed and playback entitlement.</p>
      <p class="v10ConnectionNote"><b>${esc(item.status)}</b><br>Playback is intentionally disabled in this preview because Velora does not yet have a commercial content agreement for this title.</p>
      <div class="actions"><button class="primary" disabled>▶ Provider connection required</button><button class="ghost" data-close-details>Back</button></div>
      </div>
    </div>`;
  modal.classList.add('on');document.body.style.overflow='hidden';
}

const v10PriorRenderHome=renderHome;
renderHome=function(){v10PriorRenderHome();v10InsertHomePreview()};

if(typeof v9RenderMovies==='function'){
  const prior=v9RenderMovies;
  v9RenderMovies=function(q=''){prior(q);v10InsertLibraryPreview('movie')};
}
if(typeof v9RenderSeries==='function'){
  const prior=v9RenderSeries;
  v9RenderSeries=function(q=''){prior(q);v10InsertLibraryPreview('series')};
}

document.addEventListener('click',e=>{
  const card=e.target.closest('[data-v10-preview]');
  if(card){e.preventDefault();e.stopImmediatePropagation();v10ShowPreview(card.dataset.v10Preview)}
},true);
document.addEventListener('keydown',e=>{
  if(e.key==='Enter'&&e.target?.matches?.('[data-v10-preview]')){e.preventDefault();v10ShowPreview(e.target.dataset.v10Preview)}
});

setTimeout(()=>{v10InsertHomePreview();if(document.getElementById('view-movies')?.classList.contains('active'))v10InsertLibraryPreview('movie');if(document.getElementById('view-series')?.classList.contains('active'))v10InsertLibraryPreview('series')},1800);
