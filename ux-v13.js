// VELORA UX V13 — gated 18+ live content support.
(() => {
  const ADULT_KEY='velora_adult_access';
  const adultState={...(JSON.parse(localStorage.getItem(ADULT_KEY)||'{}')||{}),unlocked:false};

  function saveAdult(){
    const persisted={enabled:!!adultState.enabled,pinHash:String(adultState.pinHash||'')};
    localStorage.setItem(ADULT_KEY,JSON.stringify(persisted));
  }
  async function hashPin(pin){
    const bytes=new TextEncoder().encode('VELORA|18+|'+String(pin));
    const digest=await crypto.subtle.digest('SHA-256',bytes);
    return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
  }
  function isAdultChannel(c){
    if(!c)return false;
    if(c.adult===true||c.isAdult===true||c.mature===true)return true;
    const hay=[c.group,c.name,c.sourceName,c.rating,c.category].filter(Boolean).join(' ').toLowerCase();
    if(hay.includes('adult swim'))return false;
    return /(^|\b)(adult|adults|xxx|18\+|18 plus|erotic|erotica|playboy|penthouse)(\b|$)/i.test(hay);
  }
  function adultVisible(){
    return !!adultState.enabled&&!!adultState.unlocked&&!state.profile?.kids;
  }

  const priorFiltered=filteredChannels;
  filteredChannels=function(){
    const list=priorFiltered();
    return list.filter(c=>!isAdultChannel(c)||adultVisible());
  };

  function ensureModal(){
    let m=document.getElementById('veloraAdultModal');
    if(m)return m;
    m=document.createElement('div');
    m.id='veloraAdultModal';
    m.className='veloraAdultModal';
    m.innerHTML=`<div class="veloraAdultCard" role="dialog" aria-modal="true" aria-labelledby="veloraAdultTitle">
      <button class="circleBtn veloraAdultClose" data-adult-close aria-label="Close">✕</button>
      <div class="veloraAdultBadge">18+</div>
      <span class="heroEyebrow">CONTENT CONTROL</span>
      <h2 id="veloraAdultTitle">Adult access</h2>
      <p id="veloraAdultText"></p>
      <input id="veloraAdultPin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off" placeholder="Enter PIN">
      <input id="veloraAdultPinConfirm" class="hidden" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off" placeholder="Confirm PIN">
      <div class="veloraAdultActions">
        <button class="primary" id="veloraAdultSubmit">Continue</button>
        <button class="ghost" data-adult-close>Cancel</button>
      </div>
      <small>18+ channels stay hidden from Home, Search and Live TV until this profile is unlocked.</small>
    </div>`;
    document.body.appendChild(m);
    return m;
  }
  function openAdultModal(mode){
    const m=ensureModal();
    m.dataset.mode=mode;
    const text=m.querySelector('#veloraAdultText');
    const confirm=m.querySelector('#veloraAdultPinConfirm');
    const submit=m.querySelector('#veloraAdultSubmit');
    const input=m.querySelector('#veloraAdultPin');
    input.value='';confirm.value='';
    confirm.classList.toggle('hidden',mode!=='setup');
    text.textContent=mode==='setup'
      ? 'Create a 4–6 digit PIN. Adult content will be hidden by default and protected on this device.'
      : mode==='disable'
        ? 'Enter your 18+ PIN to turn adult access off on this device.'
        : 'Enter your 18+ PIN to unlock adult channels for this session.';
    submit.textContent=mode==='setup'?'Enable 18+ access':mode==='disable'?'Disable 18+ access':'Unlock 18+';
    m.classList.add('on');
    setTimeout(()=>input.focus(),50);
  }
  function closeAdultModal(){
    document.getElementById('veloraAdultModal')?.classList.remove('on');
  }
  function refreshAdultUi(){
    try{renderSettings()}catch{}
    try{renderLive()}catch{}
    try{renderHome()}catch{}
    try{renderSearch()}catch{}
    updateAdultMenu();
  }
  function updateAdultMenu(){
    let btn=document.getElementById('adultProfileBtn');
    const menu=document.getElementById('profileMenu');
    if(!menu)return;
    if(!adultState.enabled||state.profile?.kids){
      btn?.remove();
      return;
    }
    if(!btn){
      btn=document.createElement('button');
      btn.id='adultProfileBtn';
      const settingsBtn=menu.querySelector('[data-view="settings"]');
      menu.insertBefore(btn,settingsBtn||null);
    }
    btn.textContent=adultState.unlocked?'🔞 18+ TV • Unlocked':'🔒 Unlock 18+ TV';
  }

  const priorRenderSettings=renderSettings;
  renderSettings=function(){
    priorRenderSettings();
    const grid=document.querySelector('#view-settings .settingsGrid');
    if(!grid)return;
    grid.querySelector('.veloraAdultPanel')?.remove();
    const panel=document.createElement('section');
    panel.className='panel veloraAdultPanel';
    const configured=!!adultState.pinHash;
    const status=!adultState.enabled?'Off':adultState.unlocked?'Unlocked':'Locked';
    panel.innerHTML=`
      <div class="veloraAdultHead"><div class="veloraAdultBadge small">18+</div><div><h2>Adult content</h2><p>Optional 18+ Live TV access. Hidden by default from every normal VELORA surface.</p></div></div>
      <div class="settingRow"><span>18+ access</span><b class="veloraAdultStatus ${adultState.unlocked?'on':''}">${status}</b></div>
      <div class="settingRow"><span>Kids profile protection</span><b>Always blocked</b></div>
      <div class="veloraAdultSettingsActions">
        ${!configured?'<button class="primary" id="adultSetupBtn">Set up 18+ PIN</button>':
          !adultState.enabled?'<button class="primary" id="adultEnableBtn">Enable 18+ access</button>':
          adultState.unlocked?'<button class="ghost" id="adultLockBtn">Lock now</button><button class="ghost danger" id="adultDisableBtn">Disable 18+ access</button>':
          '<button class="primary" id="adultUnlockBtn">Unlock 18+ TV</button><button class="ghost danger" id="adultDisableBtn">Disable 18+ access</button>'}
      </div>
      <small class="veloraAdultHint">VELORA will only show 18+ channels from connected sources that you are authorized to use. Adult content never appears on Kids profiles.</small>`;
    grid.prepend(panel);
    updateAdultMenu();
  };

  const priorApplyProfile=applyProfile;
  applyProfile=function(){
    priorApplyProfile();
    if(state.profile?.kids)adultState.unlocked=false;
    updateAdultMenu();
  };

  const priorExitApp=window.veloraExitApp;
  window.veloraExitApp=function(){
    adultState.unlocked=false;
    if(state.currentFilter&&/adult|18\+|xxx|erotic/i.test(state.currentFilter))state.currentFilter='All';
    updateAdultMenu();
    return priorExitApp?.apply(this,arguments);
  };

  document.addEventListener('click',async e=>{
    if(e.target.id==='resetApp'){adultState.unlocked=false;localStorage.removeItem(ADULT_KEY)}
    if(e.target.closest('[data-adult-close]')){e.preventDefault();e.stopImmediatePropagation();closeAdultModal();return}
    if(e.target.closest('#adultSetupBtn')){e.preventDefault();e.stopImmediatePropagation();openAdultModal('setup');return}
    if(e.target.closest('#adultEnableBtn')){e.preventDefault();e.stopImmediatePropagation();openAdultModal(adultState.pinHash?'unlock':'setup');return}
    if(e.target.closest('#adultUnlockBtn')||e.target.closest('#adultProfileBtn')){
      e.preventDefault();e.stopImmediatePropagation();
      if(adultState.unlocked){
        const adultGroups=[...new Set(priorFiltered().filter(isAdultChannel).map(x=>x.group||'Adult'))];
        state.currentFilter=adultGroups[0]||'All';
        document.getElementById('profileMenu')?.classList.remove('on');
        showView('live');
      }else openAdultModal('unlock');
      return;
    }
    if(e.target.closest('#adultLockBtn')){
      e.preventDefault();e.stopImmediatePropagation();
      adultState.unlocked=false;
      if(state.currentFilter&&/adult|18\+/i.test(state.currentFilter))state.currentFilter='All';
      refreshAdultUi();toast('18+ content locked');return;
    }
    if(e.target.closest('#adultDisableBtn')){e.preventDefault();e.stopImmediatePropagation();openAdultModal('disable');return}
    if(e.target.id==='veloraAdultSubmit'){
      e.preventDefault();e.stopImmediatePropagation();
      const m=ensureModal(),mode=m.dataset.mode;
      const pin=m.querySelector('#veloraAdultPin').value.trim();
      const confirm=m.querySelector('#veloraAdultPinConfirm').value.trim();
      if(!/^\d{4,6}$/.test(pin)){toast('Use a 4–6 digit PIN.');return}
      if(mode==='setup'){
        if(pin!==confirm){toast('PINs do not match.');return}
        adultState.pinHash=await hashPin(pin);
        adultState.enabled=true;adultState.unlocked=true;saveAdult();closeAdultModal();refreshAdultUi();toast('18+ access enabled and unlocked');return;
      }
      const ok=(await hashPin(pin))===adultState.pinHash;
      if(!ok){toast('Incorrect 18+ PIN.');return}
      if(mode==='disable'){
        adultState.enabled=false;adultState.unlocked=false;saveAdult();
        if(state.currentFilter&&/adult|18\+/i.test(state.currentFilter))state.currentFilter='All';
        closeAdultModal();refreshAdultUi();toast('18+ access disabled');return;
      }
      adultState.enabled=true;adultState.unlocked=true;saveAdult();closeAdultModal();
      const adultGroups=[...new Set(priorFiltered().filter(isAdultChannel).map(x=>x.group||'Adult'))];
      state.currentFilter=adultGroups[0]||'All';
      document.getElementById('profileMenu')?.classList.remove('on');
      showView('live');
      toast('18+ channels unlocked for this session');
      return;
    }
  },true);

  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&document.getElementById('veloraAdultModal')?.classList.contains('on'))closeAdultModal();
  });

  window.veloraAdult={isAdultChannel,visible:adultVisible,lock:()=>{adultState.unlocked=false;refreshAdultUi()}};
  setTimeout(updateAdultMenu,0);
})();