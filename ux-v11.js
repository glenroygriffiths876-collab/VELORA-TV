// VELORA UX V11 — mobile-first playback and smoother live navigation.
(() => {
  const mobile=()=>window.matchMedia?.('(max-width: 900px)').matches;
  let lastLiveScrollAt=0;

  function fitPlayers(){
    const main=document.getElementById('mainPlayer');
    if(main){
      main.setAttribute('playsinline','');
      main.style.maxWidth='100vw';
      main.style.maxHeight='100dvh';
      main.style.objectFit='contain';
    }
    const inline=document.getElementById('inlineLive');
    if(inline){
      inline.setAttribute('playsinline','');
      inline.style.objectFit='contain';
    }
    const archive=document.getElementById('archivePlayer');
    if(archive){
      archive.style.maxWidth='100vw';
      archive.style.maxHeight='100dvh';
    }
    document.querySelectorAll('.v6YTMount iframe').forEach(frame=>{
      frame.style.width='100%';
      frame.style.height='100%';
      frame.style.maxWidth='100%';
      frame.style.maxHeight='100%';
    });
  }

  function bringLivePlayerIntoView(){
    if(!mobile())return;
    const card=document.querySelector('#view-live .livePlayerCard');
    if(!card)return;
    const rect=card.getBoundingClientRect();
    const topSafe=64;
    const visible=rect.top>=topSafe&&rect.bottom<=window.innerHeight-72;
    if(visible)return;
    const now=Date.now();
    if(now-lastLiveScrollAt<350)return;
    lastLiveScrollAt=now;
    requestAnimationFrame(()=>card.scrollIntoView({behavior:'smooth',block:'start'}));
  }

  if(typeof selectChannel==='function'){
    const priorSelectChannel=selectChannel;
    selectChannel=async function(id,autoplay=true){
      const result=await priorSelectChannel(id,autoplay);
      fitPlayers();
      if(autoplay)setTimeout(bringLivePlayerIntoView,60);
      return result;
    };
  }

  if(typeof renderLive==='function'){
    const priorRenderLive=renderLive;
    renderLive=function(){
      const result=priorRenderLive();
      fitPlayers();
      return result;
    };
  }

  if(typeof openPlayer==='function'){
    const priorOpenPlayer=openPlayer;
    openPlayer=function(item){
      const result=priorOpenPlayer(item);
      fitPlayers();
      return result;
    };
  }

  if(typeof v6PlayYouTube==='function'){
    const priorV6PlayYouTube=v6PlayYouTube;
    v6PlayYouTube=async function(opts){
      const result=await priorV6PlayYouTube(opts);
      fitPlayers();
      return result;
    };
  }

  window.addEventListener('resize',fitPlayers,{passive:true});
  window.visualViewport?.addEventListener?.('resize',fitPlayers,{passive:true});
  document.addEventListener('fullscreenchange',fitPlayers);
  document.addEventListener('DOMContentLoaded',fitPlayers);
})();
