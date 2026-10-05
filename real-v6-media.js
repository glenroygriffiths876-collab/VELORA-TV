// Velora V6 — guarded players + current publisher movies

const V6_PUBLISHER_MOVIES=[
  {id:'ir-ratchet',title:'Ratchet',year:2026,genre:'Horror • Thriller',publisher:'Indie Rights Movies For Free',youtubeId:'JLxw29b5NKE',art:'https://i.ytimg.com/vi/JLxw29b5NKE/hq720.jpg',tag:'2026 FULL MOVIE'},
  {id:'ir-dread',title:'A Sense of Dread',year:2026,genre:'Psychological Thriller • Horror',publisher:'Indie Rights Movies For Free',youtubeId:'vtkDmmN1vfk',art:'https://i.ytimg.com/vi/vtkDmmN1vfk/hq720.jpg',tag:'2026 FULL MOVIE'},
  {id:'ir-secret',title:'Secret Truths',year:2026,genre:'Drama • Romance',publisher:'Indie Rights Movies For Free',youtubeId:'HRX5iSdwFKE',art:'https://i.ytimg.com/vi/HRX5iSdwFKE/hq720.jpg',tag:'2026 FULL MOVIE'},
  {id:'ir-deadly',title:'Deadly Obsession 2',year:2025,genre:'Thriller • Drama',publisher:'Indie Rights Movies For Free',youtubeId:'46E8wrlfeus',art:'https://i.ytimg.com/vi/46E8wrlfeus/hq720.jpg',tag:'FULL MOVIE'},
  {id:'ir-betty',title:"Bang Bang Betty: Valerie's Revenge",year:'',genre:'Action • Crime',publisher:'Indie Rights Movies For Free',youtubeId:'7aC5H4jPiqE',art:'https://i.ytimg.com/vi/7aC5H4jPiqE/hq720.jpg',tag:'FULL MOVIE'},
  {id:'ir-blessed',title:'Blessed: Live, Laugh, Run!',year:'',genre:'Horror • Crime',publisher:'Indie Rights Movies For Free',youtubeId:'E0rLeYVFXYU',art:'https://i.ytimg.com/vi/E0rLeYVFXYU/hq720.jpg',tag:'FULL MOVIE'},
  {id:'ir-convict',title:'Convict',year:2014,genre:'Action • Crime',publisher:'Indie Rights Movies For Free',youtubeId:'6JLzLZnnO88',art:'https://i.ytimg.com/vi/6JLzLZnnO88/hq720.jpg',tag:'FULL MOVIE'},
  {id:'ir-demon',title:'Demon Fighter',year:'',genre:'Action • Horror',publisher:'Indie Rights Movies For Free',youtubeId:'zCisPfLpM40',art:'https://i.ytimg.com/vi/zCisPfLpM40/hq720.jpg',tag:'FULL MOVIE'},
  {id:'ir-fear',title:'Fear of a Black Planet',year:'',genre:'Thriller • Action',publisher:'Indie Rights Movies For Free',youtubeId:'wMtU8DvFIbc',art:'https://i.ytimg.com/vi/wMtU8DvFIbc/hq720.jpg',tag:'FULL MOVIE'},
  {id:'ir-olympus',title:'Fighting Olympus',year:'',genre:'Action • Crime',publisher:'Indie Rights Movies For Free',youtubeId:'oiBVD31pnew',art:'https://i.ytimg.com/vi/oiBVD31pnew/hq720.jpg',tag:'FULL MOVIE'},
  {id:'ir-infiltrators',title:'Infiltrators',year:'',genre:'Action • Thriller',publisher:'Indie Rights Movies For Free',youtubeId:'Ye4IcGs55sY',art:'https://i.ytimg.com/vi/Ye4IcGs55sY/hq720.jpg',tag:'FULL MOVIE'},
  {id:'ir-summer',title:'That One Summer',year:'',genre:'Drama • Comedy',publisher:'Indie Rights Movies For Free',youtubeId:'Jp6qAoUJ08k',art:'https://i.ytimg.com/vi/Jp6qAoUJ08k/hq720.jpg',tag:'FULL MOVIE'},
  {id:'ir-colombia',title:'The Colombian Connection',year:'',genre:'Action • Crime',publisher:'Indie Rights Movies For Free',youtubeId:'RjS4VUq2Ip8',art:'https://i.ytimg.com/vi/RjS4VUq2Ip8/hq720.jpg',tag:'FULL MOVIE'},
  {id:'fr-americanhero',title:'American Hero',year:2015,genre:'Action • Comedy',publisher:'FilmRise Movies',youtubeId:'B_-1AYf3CLU',art:'https://i.ytimg.com/vi/B_-1AYf3CLU/hq720.jpg',tag:'FULL MOVIE'},
  {id:'fr-storybook',title:'A Storybook Christmas',year:'',genre:'Romance • Comedy',publisher:'FilmRise Movies',youtubeId:'lV1nW_BwoVE',art:'https://i.ytimg.com/vi/lV1nW_BwoVE/hq720.jpg',tag:'FULL MOVIE'}
];

const V6_MOVIE_CHANNELS=[
  {id:'indierights',name:'Indie Rights Movies For Free',note:'1,700+ uploads • current 2026 independent full movies',playlistId:'PLrVEDBgZUunmqzQC5B4IutR-xoZJwe-T_',publisherUrl:'https://www.youtube.com/@IndieRightsMoviesForFree'},
  {id:'moviecentral',name:'Movie Central',note:'2,700+ uploads • new movies added regularly',playlistId:'UUGBzBkV-MinlBvHBzZawfLQ',publisherUrl:'https://www.youtube.com/@moviecentral'},
  {id:'wegotmovies',name:'We Got Movies',note:'Action, sci-fi and thrillers from VA Media',playlistId:'UUR0v_ZA8zKJwxpU9HpDq3fQ',publisherUrl:'https://www.youtube.com/@WeGotMovies'}
];

let v6YTReadyPromise=null;
let v6Player=null;
let v6GuardTimer=null;

function v6LoadYT(){
  if(window.YT&&YT.Player)return Promise.resolve();
  if(v6YTReadyPromise)return v6YTReadyPromise;
  v6YTReadyPromise=new Promise((resolve,reject)=>{
    const previous=window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady=()=>{try{previous?.()}catch{} resolve()};
    if(!document.querySelector('script[src*="youtube.com/iframe_api"]')){
      const s=document.createElement('script');s.src='https://www.youtube.com/iframe_api';s.async=true;s.onerror=()=>reject(new Error('YouTube player API unavailable'));document.head.appendChild(s);
    }
    setTimeout(()=>{if(window.YT&&YT.Player)resolve()},5000);
  });
  return v6YTReadyPromise;
}
function v6EnsurePlayer(){
  let shell=document.getElementById('v6PlayerShell');if(shell)return shell;
  shell=document.createElement('div');shell.id='v6PlayerShell';shell.className='v6PlayerShell';
  shell.innerHTML=`<div class="v6PlayerTop"><button class="circleBtn" id="v6PlayerClose">←</button><div><small>VELORA SAFE PLAYER</small><b id="v6PlayerTitle">Now Playing</b></div><button class="ghost tiny" id="v6PublisherLink">Publisher ↗</button></div><div class="v6Stage"><div id="v6YTMount" class="v6YTMount"></div><div id="v6Shield" class="v6Shield"><div class="v6Spinner"></div><h2 id="v6ShieldTitle">Checking source…</h2><p id="v6ShieldText">Velora will only reveal the player after the source responds.</p><div id="v6ShieldActions" class="v6ShieldActions"></div></div></div>`;
  document.body.appendChild(shell);
  shell.querySelector('#v6PlayerClose').onclick=()=>v6ClosePlayer();
  shell.querySelector('#v6PublisherLink').onclick=()=>{const u=shell.dataset.publisherUrl;if(u)window.open(u,'_blank','noopener,noreferrer')};
  return shell;
}
function v6CleanPlayer(){
  clearTimeout(v6GuardTimer);
  if(v6Player){try{v6Player.destroy()}catch{}v6Player=null}
  const m=document.getElementById('v6YTMount');if(m)m.innerHTML='';
}
function v6ClosePlayer(){
  v6CleanPlayer();
  const shell=document.getElementById('v6PlayerShell');if(shell)shell.classList.remove('on');
  document.body.style.overflow='';
}
function v6Fail(title='Source unavailable',message='This publisher did not provide an embeddable response right now.',publisherUrl=''){
  v6CleanPlayer();
  const sh=document.getElementById('v6Shield');if(!sh)return;
  sh.classList.remove('playing');
  document.getElementById('v6ShieldTitle').textContent=title;
  document.getElementById('v6ShieldText').textContent=message;
  document.getElementById('v6ShieldActions').innerHTML=publisherUrl?`<button class="ghost" data-v6-open-publisher="${esc(publisherUrl)}">Open official publisher ↗</button>`:'';
}
async function v6PlayYouTube(opts){
  window.veloraTrack?.('play',{itemId:opts.videoId||opts.playlistId||'',title:opts.title||''});
  const shell=v6EnsurePlayer();v6CleanPlayer();
  shell.dataset.publisherUrl=opts.publisherUrl||'';
  shell.querySelector('#v6PlayerTitle').textContent=opts.title||'Now Playing';
  shell.querySelector('#v6PublisherLink').style.display=opts.publisherUrl?'':'none';
  shell.classList.add('on');document.body.style.overflow='hidden';
  const shield=document.getElementById('v6Shield');shield.classList.remove('playing');
  document.getElementById('v6ShieldTitle').textContent='Checking source…';
  document.getElementById('v6ShieldText').textContent='Velora is verifying the publisher player before showing it.';
  document.getElementById('v6ShieldActions').innerHTML='';
  try{await v6LoadYT()}catch{v6Fail('Player service unavailable','YouTube player services could not be reached. No broken embed is being shown.',opts.publisherUrl);return}
  const config={
    width:'100%',height:'100%',
    playerVars:{autoplay:1,rel:0,playsinline:1,origin:location.origin},
    events:{
      onReady:e=>{
        clearTimeout(v6GuardTimer);
        shield.classList.add('playing');
        try{e.target.playVideo()}catch{}
      },
      onAutoplayBlocked:()=>{
        clearTimeout(v6GuardTimer);
        shield.classList.add('playing');
      },
      onStateChange:e=>{
        if([YT.PlayerState.PLAYING,YT.PlayerState.PAUSED,YT.PlayerState.BUFFERING].includes(e.data)){
          clearTimeout(v6GuardTimer);shield.classList.add('playing');
        }
      },
      onError:e=>{
        clearTimeout(v6GuardTimer);
        const code=e.data;
        const blocked=code===101||code===150;
        v6Fail(blocked?'Publisher blocked embedding':'This video is unavailable',blocked?'Velora hid the provider error automatically. Try the publisher source or another title.':'The source may have moved, expired or be region-restricted.',opts.publisherUrl);
      }
    }
  };
  if(opts.videoId)config.videoId=opts.videoId;
  if(opts.playlistId){config.playerVars.listType='playlist';config.playerVars.list=opts.playlistId}
  v6Player=new YT.Player('v6YTMount',config);
  v6GuardTimer=setTimeout(()=>{if(!shield.classList.contains('playing'))v6Fail('Source did not start','Velora stopped the player before a broken embed could become the viewing experience.',opts.publisherUrl)},12000);
}
function v6MovieCard(x){
  return `<article class="v6MovieCard" data-v6-movie="${esc(x.id)}"><div class="v6MovieArt" style="background-image:url('${esc(x.art)}')"><span class="badge">${esc(x.tag)}</span><span class="v6PlayDot">▶</span></div><b>${esc(x.title)}</b><small>${x.year?esc(x.year)+' • ':''}${esc(x.genre)}</small><em>${esc(x.publisher)}</em></article>`;
}
function v6ChannelCard(x){
  return `<article class="v6ChannelCard" data-v6-playlist="${esc(x.id)}"><div class="v6ChannelHero"><span>▶</span><b>${esc(x.name)}</b></div><p>${esc(x.note)}</p><button class="ghost">Browse & play inside Velora</button></article>`;
}
function v6LatestMovieRail(){
  return `<section class="railSection"><div class="railHead"><h2>New & Recent Full Movies</h2><span class="v6Verified">Publisher-approved embeds</span></div><div class="v6MovieRail">${V6_PUBLISHER_MOVIES.slice(0,10).map(v6MovieCard).join('')}</div></section>`;
}
function v6MovieChannelsBlock(){
  return `<section class="railSection"><div class="railHead"><h2>Free Movie Channels</h2><span class="v6Verified">Thousands of full movies</span></div><div class="v6ChannelGrid">${V6_MOVIE_CHANNELS.map(v6ChannelCard).join('')}</div></section>`;
}

document.addEventListener('click',e=>{
  const m=e.target.closest('[data-v6-movie]');
  if(m){e.preventDefault();e.stopImmediatePropagation();const x=V6_PUBLISHER_MOVIES.find(i=>i.id===m.dataset.v6Movie);if(x)v6PlayYouTube({title:x.title,videoId:x.youtubeId,publisherUrl:'https://www.youtube.com/watch?v='+x.youtubeId});return}
  const p=e.target.closest('[data-v6-playlist]');
  if(p){e.preventDefault();e.stopImmediatePropagation();const x=V6_MOVIE_CHANNELS.find(i=>i.id===p.dataset.v6Playlist);if(x)v6PlayYouTube({title:x.name,playlistId:x.playlistId,publisherUrl:x.publisherUrl});return}
  const pub=e.target.closest('[data-v6-open-publisher]');
  if(pub){e.preventDefault();e.stopImmediatePropagation();window.open(pub.dataset.v6OpenPublisher,'_blank','noopener,noreferrer');return}
},true);
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.getElementById('v6PlayerShell')?.classList.contains('on'))v6ClosePlayer()});
