(()=> {
  const params=new URLSearchParams(location.search);
  const tv=params.get('tv')==='1'||window.VELORA_TV_SHELL===true;
  if(!tv)return;

  document.documentElement.classList.add('tvMode');
  document.body.classList.add('tvMode');
  window.__VELORA_TV__=true;

  const selector=[
    'button:not([disabled])','a[href]','input:not([disabled])','select:not([disabled])',
    'textarea:not([disabled])','[tabindex="0"]','[data-view]','[data-detail]',
    '[data-live]','[data-channel]','[data-v6-movie]','[data-v6-playlist]',
    '[data-v8-open]','[data-v9-open]'
  ].join(',');

  const isVisible=el=>{
    if(!el||!document.documentElement.contains(el))return false;
    const s=getComputedStyle(el);
    if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)return false;
    const r=el.getBoundingClientRect();
    return r.width>2&&r.height>2&&r.bottom>0&&r.right>0&&r.top<innerHeight&&r.left<innerWidth;
  };

  const focusables=()=>[...new Set([...document.querySelectorAll(selector)])].filter(isVisible);
  const center=r=>({x:r.left+r.width/2,y:r.top+r.height/2});

  function markFocus(el){
    document.querySelectorAll('.tvFocus').forEach(x=>x.classList.remove('tvFocus'));
    if(el&&el.matches('.card,.v6MovieCard,.v6ChannelCard,[tabindex="0"]'))el.classList.add('tvFocus');
  }

  function focusElement(el){
    if(!el)return false;
    try{el.focus({preventScroll:true})}catch{el.focus()}
    markFocus(el);
    try{el.scrollIntoView({block:'nearest',inline:'nearest',behavior:'smooth'})}catch{}
    return true;
  }

  function focusFirst(){
    const current=document.activeElement;
    if(current&&current!==document.body&&isVisible(current))return;
    const preferred=document.querySelector('.mainnav button.active,[data-view="home"],.loginCard input,.loginCard button');
    if(preferred&&isVisible(preferred)){focusElement(preferred);return}
    focusElement(focusables()[0]);
  }

  function move(direction){
    const items=focusables();
    if(!items.length)return;
    let from=document.activeElement;
    if(!items.includes(from)){focusElement(items[0]);return}
    const a=center(from.getBoundingClientRect());
    let best=null,bestScore=Infinity;
    for(const el of items){
      if(el===from)continue;
      const b=center(el.getBoundingClientRect());
      const dx=b.x-a.x,dy=b.y-a.y;
      let primary,cross;
      if(direction==='left'){if(dx>=-4)continue;primary=-dx;cross=Math.abs(dy)}
      else if(direction==='right'){if(dx<=4)continue;primary=dx;cross=Math.abs(dy)}
      else if(direction==='up'){if(dy>=-4)continue;primary=-dy;cross=Math.abs(dx)}
      else {if(dy<=4)continue;primary=dy;cross=Math.abs(dx)}
      const anglePenalty=cross>primary*2.8?5000:0;
      const score=primary+(cross*1.8)+anglePenalty;
      if(score<bestScore){best=el;bestScore=score}
    }
    if(best)focusElement(best);
  }

  window.veloraTvBack=()=>{
    const v6=document.getElementById('v6PlayerShell');
    if(v6?.classList.contains('on')&&typeof window.v6ClosePlayer==='function'){window.v6ClosePlayer();return true}
    const player=document.getElementById('playerOverlay');
    if(player?.classList.contains('on')&&typeof window.closePlayer==='function'){window.closePlayer();return true}
    const details=document.getElementById('detailsModal');
    if(details?.classList.contains('on')&&typeof window.closeDetails==='function'){window.closeDetails();return true}
    const profile=document.getElementById('profileMenu');
    if(profile?.classList.contains('on')||profile?.classList.contains('open')){
      document.getElementById('profileBtn')?.click();return true
    }
    const activeView=document.querySelector('.view.active');
    if(activeView&&activeView.id!=='view-home'&&typeof window.showView==='function'){window.showView('home');setTimeout(focusFirst,80);return true}
    return false;
  };

  document.addEventListener('focusin',e=>markFocus(e.target),true);
  document.addEventListener('pointerdown',e=>{const el=e.target.closest(selector);if(el)markFocus(el)},true);

  document.addEventListener('keydown',e=>{
    const k=e.key;
    const tag=(document.activeElement?.tagName||'').toLowerCase();
    const typing=tag==='input'||tag==='textarea'||tag==='select';

    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(k)){
      if(typing&&(k==='ArrowLeft'||k==='ArrowRight'))return;
      e.preventDefault();e.stopPropagation();
      move(k.replace('Arrow','').toLowerCase());
      return;
    }
    if(k==='Enter'){
      const el=document.activeElement;
      if(el&&isVisible(el)&&!['button','a','input','select','textarea'].includes((el.tagName||'').toLowerCase())){
        e.preventDefault();el.click();
      }
      return;
    }
    if(k==='Escape'||k==='GoBack'||k==='BrowserBack'){
      if(window.veloraTvBack()){e.preventDefault();e.stopPropagation()}
    }
  },true);

  const observer=new MutationObserver(()=>setTimeout(focusFirst,60));
  observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden','aria-hidden']});
  addEventListener('load',()=>setTimeout(focusFirst,180));
  setTimeout(focusFirst,260);
})();