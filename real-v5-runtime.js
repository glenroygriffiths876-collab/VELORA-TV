showView = function(name){
  document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));
  document.getElementById('view-'+name)?.classList.add('active');
  document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
  document.getElementById('profileMenu').classList.remove('on');
  if(name==='home')renderHome();
  if(name==='live')renderLive();
  if(name==='movies')renderCatalogView('movie');
  if(name==='series')renderCatalogView('series');
  if(name==='discover')renderDiscover();
  if(name==='open'){renderOpenLibrary();if(!state.profile.kids)ensureOpenLibrary()}
  if(name==='search')renderSearch();
  if(name==='mylist')renderMyList();
  if(name==='settings')renderSettings();
  if(name==='admin')renderAdmin();
  window.scrollTo({top:0,behavior:'instant'});
};

renderAll = function(){
  renderHome();renderLive();renderCatalogView('movie');renderCatalogView('series');renderDiscover();
  renderOpenLibrary();renderSearch();renderMyList();renderSettings();renderAdmin();
};

document.addEventListener('click',e=>{
  const ex=e.target.closest('[data-v5-external]');
  if(ex){e.preventDefault();e.stopImmediatePropagation();const u=ex.dataset.v5External;if(u&&u!=='#')window.open(u,'_blank','noopener,noreferrer');return}
  const lv=e.target.closest('[data-v5-live]');
  if(lv){e.preventDefault();e.stopImmediatePropagation();const c=filteredChannels().find(x=>x.id===lv.dataset.v5Live);if(c)v5OpenChannel(c,true);return}
  if(e.target.id==='openFullLive'){
    e.preventDefault();e.stopImmediatePropagation();if(state.currentChannel)v5OpenChannel(state.currentChannel,true);return;
  }
},true);

// Refresh any persisted session immediately after this layer loads.
if(state.user){
  renderAll();
  showView('home');
  ensureOpenLibrary();
}
