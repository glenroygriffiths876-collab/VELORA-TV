// VELORA Instant TV: full catalogue available to browse; local playback evidence remains authoritative.
(() => {
  'use strict';
  const PAGE=60;
  let shown=PAGE, query='', group='All';
  const id='veloraInstantGuide';
  const clean=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=s=>typeof v7SearchText==='function'?v7SearchText(s):String(s||'').toLowerCase().trim();
  function category(c){
    const name=String(c.group||'').toLowerCase();
    if(/sport|football|soccer|basketball/.test(name))return 'Sports';
    if(/news|information/.test(name))return 'News';
    if(/movie|film|cinema/.test(name))return 'Movies';
    if(/kid|child|cartoon|family/.test(name))return 'Kids';
    if(/music|entertainment|series|general/.test(name))return 'Entertainment';
    return 'Other';
  }
  function panel(){
    let root=document.getElementById(id);
    if(root)return root;
    const shell=document.getElementById('veloraLiveSearchShell');
    if(!shell)return null;
    root=document.createElement('section');
    root.id=id;
    root.className='veloraInstantGuide';
    root.setAttribute('aria-label','Full live TV channel directory');
    root.innerHTML=
      '<div class="veloraInstantHead"><div><span class="veloraVerifiedEyebrow">INSTANT TV GUIDE</span>'+
      '<h3>All channels <span id="veloraInstantCount">0</span></h3>'+
      '<p>Browse immediately. Playback is confirmed when you select a stream.</p></div>'+
      '<button type="button" id="veloraInstantShowSearch" aria-label="Focus channel search">Find</button></div>'+
      '<input type="search" id="veloraInstantSearch" placeholder="Find a channel or network…" autocomplete="off" aria-label="Search all channels">'+
      '<div class="veloraInstantFilters" role="group" aria-label="Channel categories">'+
      ['All','Sports','News','Entertainment','Movies','Kids','Other'].map(x=>
        '<button type="button" class="veloraInstantFilter'+(x==='All'?' active':'')+'" data-instant-group="'+x+
        '" aria-pressed="'+(x==='All'?'true':'false')+'">'+x+'</button>').join('')+'</div>'+
      '<div id="veloraInstantStatus" class="veloraInstantStatus" aria-live="polite"></div>'+
      '<div id="veloraInstantRows" class="veloraInstantRows"></div>'+
      '<button type="button" id="veloraInstantMore" class="veloraInstantMore" hidden>Show more channels</button>';
    shell.after(root);
    return root;
  }
  function sortedChannels(){
    const channels=typeof filteredChannels==='function'?filteredChannels():[];
    // The existing global ordering keeps TVJ first; no separate selection or
    // automatic tuning takes place while populating the directory.
    const term=norm(query);
    return channels.filter(c=>(group==='All'||category(c)===group)&&
      (!term||norm([c.name,c.group,c.now,c.sourceName,c.epgId].join(' ')).includes(term)));
  }
  function render(){
    const root=panel();if(!root)return;
    const all=sortedChannels();
    const local=new Set(window.veloraVerifiedChannels?.ids?.()||[]);
    const shared=window.veloraSharedPool||new Map();
    const count=document.getElementById('veloraInstantCount');
    if(count)count.textContent=String(typeof filteredChannels==='function'?filteredChannels().length:0);
    const status=document.getElementById('veloraInstantStatus');
    if(status)status.textContent=all.length.toLocaleString()+' matching channels · '+
      local.size.toLocaleString()+' video-verified on this device';
    const first=all.slice(0,shown);
    const html=first.map(c=>{
      let state='Tap to try',className='untested';
      if(local.has(c.id)){state='Ready here';className='ready'}
      else if(shared.has(c.id)){state=shared.get(c.id)?.recent?'Recently played':'Played before';className='historical'}
      else if(c.availability==='down'){state='May be offline';className='historical'}
      else if(c.embedUrl||c.watchUrl){state='Official source';className='historical'}
      return '<button type="button" data-channel="'+clean(c.id)+'" class="veloraInstantChannel'+
        (stateChannelId()===c.id?' playing':'')+'" aria-label="Try '+clean(c.name)+'">'+
        '<span class="veloraInstantChannelName">'+clean(c.name)+
        '<small>'+clean(c.group||'Live TV')+'</small></span>'+
        '<span class="veloraInstantChannelStatus '+className+'">'+clean(state)+'</span></button>';
    }).join('');
    const rows=root.querySelector('#veloraInstantRows');
    if(rows&&rows.innerHTML!==html)rows.innerHTML=html||
      '<p class="veloraInstantEmpty">No channels match this filter. Try another category or name.</p>';
    const more=root.querySelector('#veloraInstantMore');
    if(more){more.hidden=all.length<=first.length;more.textContent='Show more · '+first.length.toLocaleString()+
      ' of '+all.length.toLocaleString()}
  }
  function stateChannelId(){return state.currentChannel?.id}
  function resetFilter(){shown=PAGE}
  const oldRender=renderLive;
  renderLive=function(){
    oldRender();
    // The page is recreated on view changes; never retain a hidden old filter.
    query='';group='All';shown=PAGE;
    panel();
    render();
  };
  const oldSnapshot=v7ApplySnapshot;
  v7ApplySnapshot=function(...args){
    const result=oldSnapshot(...args);
    if(document.getElementById('view-live')?.classList.contains('active'))render();
    return result;
  };
  document.addEventListener('input',e=>{
    if(e.target?.id!=='veloraInstantSearch')return;
    query=e.target.value;resetFilter();render();
  });
  document.addEventListener('click',e=>{
    const filter=e.target?.closest?.('[data-instant-group]');
    if(filter){
      group=filter.dataset.instantGroup;resetFilter();
      document.querySelectorAll('[data-instant-group]').forEach(b=>{
        const on=b.dataset.instantGroup===group;
        b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));
      });render();return;
    }
    if(e.target?.id==='veloraInstantMore'){shown+=PAGE;render();return}
    if(e.target?.id==='veloraInstantShowSearch'){
      document.getElementById('veloraInstantSearch')?.focus();return;
    }
    if(e.target?.closest?.('#veloraInstantRows [data-channel]')){
      // Existing application click handler selects the requested channel.
      // Bring its player into view without overwriting the selection.
      setTimeout(()=>document.querySelector('#view-live .veloraTvPlayer')?.scrollIntoView?.({
        behavior:'smooth',block:'start'}),50);
    }
  },true);
  window.veloraInstantGuide={refresh:render};
  setInterval(()=>{
    if(document.getElementById('view-live')?.classList.contains('active'))render();
  },7000);
})();
