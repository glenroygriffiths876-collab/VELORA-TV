function v5EnsureBrowser(){
  let shell=document.getElementById('v5BrowserShell');
  if(shell)return shell;
  shell=document.createElement('div');
  shell.id='v5BrowserShell';
  shell.className='v5BrowserShell';
  shell.innerHTML=`
    <div class="v5BrowserTop">
      <button class="circleBtn" id="v5BrowserClose">←</button>
      <div class="v5BrowserTitle"><small>IN-APP PROVIDER VIEW</small><b id="v5BrowserLabel">Provider</b></div>
      <button class="ghost tiny" id="v5BrowserExternal">Open externally ↗</button>
    </div>
    <div class="v5BrowserNotice" id="v5BrowserNotice">Velora is loading the official provider inside the app. Some providers block iframe embedding for security; if that happens, use the fallback button.</div>
    <iframe id="v5BrowserFrame" class="v5BrowserFrame" title="Provider browser" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>
  `;
  document.body.appendChild(shell);
  shell.querySelector('#v5BrowserClose').addEventListener('click',()=>v5CloseBrowser());
  shell.querySelector('#v5BrowserExternal').addEventListener('click',()=>{const u=shell.dataset.url;if(u)window.open(u,'_blank','noopener,noreferrer')});
  return shell;
}
function v5OpenInApp(url,label='Official provider'){
  if(!url||url==='#')return;
  const shell=v5EnsureBrowser(),frame=shell.querySelector('#v5BrowserFrame');
  shell.dataset.url=url;
  shell.querySelector('#v5BrowserLabel').textContent=label;
  shell.classList.add('on');
  document.body.style.overflow='hidden';
  frame.src='about:blank';
  setTimeout(()=>{frame.src=url},30);
}
function v5CloseBrowser(){
  const shell=document.getElementById('v5BrowserShell');if(!shell)return;
  const frame=shell.querySelector('#v5BrowserFrame');if(frame)frame.src='about:blank';
  shell.classList.remove('on');
  document.body.style.overflow='';
}

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
  if(ex){
    e.preventDefault();e.stopImmediatePropagation();
    const u=ex.dataset.v5External;
    const label=ex.closest('.discoveryCard')?.querySelector('h3')?.textContent||ex.textContent.trim()||'Official provider';
    if(u&&u!=='#')v5OpenInApp(u,label);
    return;
  }
  const lv=e.target.closest('[data-v5-live]');
  if(lv){
    e.preventDefault();e.stopImmediatePropagation();
    const c=filteredChannels().find(x=>x.id===lv.dataset.v5Live);
    if(c)v5OpenChannel(c,true);
    return;
  }
  if(e.target.id==='openFullLive'){
    e.preventDefault();e.stopImmediatePropagation();
    if(state.currentChannel)v5OpenChannel(state.currentChannel,true);
    return;
  }
},true);

window.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&document.getElementById('v5BrowserShell')?.classList.contains('on'))v5CloseBrowser();
});

// Refresh any persisted session immediately after this layer loads.
if(state.user){
  renderAll();
  showView('home');
  ensureOpenLibrary();
}
