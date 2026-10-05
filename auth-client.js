// VELORA account client — real server-side sessions + tester analytics.
(() => {
  const TOKEN_KEY='velora_auth_token';
  const FALLBACK_BACKEND='https://velora-tv-api-production.up.railway.app';
  let currentUser=null;

  const $=id=>document.getElementById(id);
  const apiUrl=path=>{
    if(typeof window.v7Api==='function')return window.v7Api(path);
    const base=(localStorage.getItem('velora_backend_base')||FALLBACK_BACKEND).replace(/\/$/,'');
    return base+path;
  };
  const deviceId=()=>{
    if(typeof window.v9DeviceId==='function')return window.v9DeviceId();
    let id=localStorage.getItem('velora_client_device_id');
    if(!id){id='velora-'+crypto.randomUUID();localStorage.setItem('velora_client_device_id',id)}
    return id;
  };
  const platform=()=>navigator.userAgent||navigator.platform||'Unknown device';

  async function request(path,options={}){
    const token=localStorage.getItem(TOKEN_KEY)||'';
    const headers={'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{}),...(options.headers||{})};
    const r=await fetch(apiUrl(path),{...options,headers});
    const ct=r.headers.get('content-type')||'';
    const body=ct.includes('application/json')?await r.json():{error:await r.text()};
    if(!r.ok)throw new Error(body.error||('Request failed ('+r.status+')'));
    return body;
  }

  function setBusy(form,busy,label){
    const btn=form?.querySelector('button[type="submit"]');
    if(!btn)return;
    if(!btn.dataset.original)btn.dataset.original=btn.textContent;
    btn.disabled=busy;
    btn.textContent=busy?label:(btn.dataset.original||'Continue');
  }

  function showAuth(mode){
    $('loginForm')?.classList.toggle('hidden',mode==='register');
    $('registerForm')?.classList.toggle('hidden',mode!=='register');
  }

  function enter(user,token){
    if(token)localStorage.setItem(TOKEN_KEY,token);
    currentUser=user;
    window.veloraCurrentUser=user;
    window.veloraEnterApp?.(user);
    track('session_start',{view:'home'});
  }

  async function logout(){
    try{await request('/api/auth/logout',{method:'POST',body:'{}'})}catch{}
    localStorage.removeItem(TOKEN_KEY);
    currentUser=null;
    window.veloraCurrentUser=null;
    window.veloraExitApp?.();
    showAuth('login');
  }

  async function restore(){
    const token=localStorage.getItem(TOKEN_KEY);
    if(!token){showAuth('login');return}
    try{
      const d=await request('/api/auth/me',{headers:{}});
      enter(d.user,null);
    }catch{
      localStorage.removeItem(TOKEN_KEY);
      currentUser=null;
      window.veloraCurrentUser=null;
      window.veloraExitApp?.();
      showAuth('login');
    }
  }

  async function track(event,detail={}){
    if(!localStorage.getItem(TOKEN_KEY))return;
    const payload={
      event,
      deviceId:deviceId(),
      platform:platform(),
      view:detail.view||'',
      itemId:detail.itemId||'',
      title:detail.title||''
    };
    try{await request('/api/analytics/event',{method:'POST',body:JSON.stringify(payload)})}catch{}
  }
  window.veloraTrack=(event,detail={})=>{track(event,detail)};
  window.VeloraAuth={request,logout,restore,get user(){return currentUser}};

  function usageTime(v){
    if(!v)return 'Never';
    const d=new Date(v);
    if(Number.isNaN(d.getTime()))return '—';
    return d.toLocaleString([], {dateStyle:'medium',timeStyle:'short'});
  }
  function usageEsc(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}

  async function loadUsage(){
    const box=document.getElementById('veloraUsageDashboard');
    if(!box||currentUser?.role!=='admin')return;
    try{
      const d=await request('/api/admin/usage');
      const s=d.summary||{};
      const users=d.users||[];
      box.innerHTML=`
        <div class="usageStats">
          <div><b>${Number(s.registered||0)}</b><span>Tester profiles</span></div>
          <div><b>${Number(s.activeNow||0)}</b><span>Active now</span></div>
          <div><b>${Number(s.sessions||0)}</b><span>Signed-in sessions</span></div>
          <div><b>${Number(s.plays||0)}</b><span>Total plays</span></div>
        </div>
        <div class="usageTableWrap">
          <table class="usageTable">
            <thead><tr><th>User</th><th>Role</th><th>Last active</th><th>Devices</th><th>Views</th><th>Plays</th><th>Last screen</th></tr></thead>
            <tbody>${users.map(u=>`<tr>
              <td><b>${usageEsc(u.name)}</b><small>${usageEsc(u.username?('@'+u.username):u.email)}</small>${u.activeNow?'<em class="usageOnline">Online</em>':''}</td>
              <td>${usageEsc(u.role==='admin'?'Admin':'Tester')}</td>
              <td>${usageEsc(usageTime(u.lastSeen))}</td>
              <td>${Number(u.devices||0)}</td>
              <td>${Number(u.views||0)}</td>
              <td>${Number(u.plays||0)}</td>
              <td>${usageEsc(u.lastView||'—')}</td>
            </tr>`).join('')||'<tr><td colspan="7">No tester accounts yet.</td></tr>'}</tbody>
          </table>
        </div>
        <p class="usagePrivacy">Usage dashboard records account activity and device/browser type for testing. It does not display passwords or precise location.</p>`;
    }catch(e){
      box.innerHTML='<div class="libraryError">Could not load tester activity: '+usageEsc(e.message)+'</div>';
    }
  }

  const priorRenderAdmin=window.renderAdmin;
  if(typeof priorRenderAdmin==='function'){
    window.renderAdmin=function(){
      if(currentUser?.role!=='admin')return;
      priorRenderAdmin();
      const page=document.querySelector('#view-admin .contentPage');
      if(!page)return;
      const section=document.createElement('section');
      section.className='panel widePanel usagePanel';
      section.innerHTML='<div class="usageHead"><div><span class="heroEyebrow">TESTING ACTIVITY</span><h2>Who is using VELORA?</h2><p>Registered testers, recent sessions and basic app usage.</p></div><button class="ghost tiny" id="refreshUsage">Refresh</button></div><div id="veloraUsageDashboard"><div class="openLoading"><span></span><b>Loading tester activity…</b></div></div>';
      const grid=page.querySelector('.adminGrid')||page;
      grid.prepend(section);
      loadUsage();
    };
  }

  document.addEventListener('click',e=>{
    if(e.target.closest('#showRegister')){e.preventDefault();showAuth('register')}
    if(e.target.closest('#showLogin')){e.preventDefault();showAuth('login')}
    if(e.target.closest('#refreshUsage')){e.preventDefault();loadUsage()}
  });

  document.addEventListener('submit',async e=>{
    if(e.target.id==='loginForm'){
      e.preventDefault();
      const form=e.target;
      setBusy(form,true,'Signing in…');
      try{
        const d=await request('/api/auth/login',{method:'POST',body:JSON.stringify({
          identifier:$('loginEmail')?.value.trim(),
          password:$('loginPassword')?.value||'',
          deviceId:deviceId(),platform:platform()
        })});
        enter(d.user,d.token);
      }catch(err){
        window.toast?.(err.message||'Could not sign in');
      }finally{setBusy(form,false)}
      return;
    }
    if(e.target.id==='registerForm'){
      e.preventDefault();
      const form=e.target;
      setBusy(form,true,'Creating profile…');
      try{
        const d=await request('/api/auth/register',{method:'POST',body:JSON.stringify({
          name:$('registerName')?.value.trim(),
          email:$('registerEmail')?.value.trim(),
          password:$('registerPassword')?.value||'',
          deviceId:deviceId(),platform:platform()
        })});
        enter(d.user,d.token);
        window.toast?.('Your VELORA profile is ready.');
      }catch(err){
        window.toast?.(err.message||'Could not create profile');
      }finally{setBusy(form,false)}
    }
  });

  window.addEventListener('DOMContentLoaded',restore);
})();