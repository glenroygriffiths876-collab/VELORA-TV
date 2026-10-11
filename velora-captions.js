// VELORA captions — source-supplied subtitle tracks only (no speech recognition).
(() => {
  'use strict';
  let session=null, selected=null, open=false, ready=false;
  let pref={enabled:false,language:''};
  try {
    const saved=JSON.parse(localStorage.getItem('velora_captions')||'null');
    if(saved&&typeof saved==='object')pref={enabled:saved.enabled===true,language:String(saved.language||'')};
  } catch {}
  const persist=()=>{try{localStorage.setItem('velora_captions',JSON.stringify(pref))}catch{}};
  const control=()=>document.querySelector('[data-v15-control="cc"]');
  const menu=()=>document.getElementById('veloraCcMenu');
  const normalize=s=>String(s||'').trim().toLowerCase();
  const listNative=video=>{
    const out=[];
    const ts=video?.textTracks;
    if(!ts)return out;
    for(let i=0;i<ts.length;i++){
      const t=ts[i];
      if(!t||!['subtitles','captions'].includes(t.kind))continue;
      out.push({kind:'native',id:i,label:String(t.label||t.language||(t.kind==='captions'?'Closed captions':'Subtitles')),language:String(t.language||''),track:t});
    }
    return out;
  };
  function available(){
    if(!session)return [];
    const out=[];
    const hlsTracks=session.hls?.subtitleTracks||[];
    for(let i=0;i<hlsTracks.length;i++){
      const t=hlsTracks[i];
      if(!t)continue;
      out.push({kind:'hls',id:i,label:String(t.name||t.lang||'Subtitles'),language:String(t.lang||'')});
    }
    // hls.js may create native TextTracks for the same WebVTT renditions.
    // Prefer its own selector, but retain distinct in-band CEA-608/708 tracks.
    for(const t of listNative(session.video)){
      const duplicate=out.some(h=>normalize(h.language)===normalize(t.language)&&normalize(h.label)===normalize(t.label));
      if(!duplicate)out.push(t);
    }
    return out;
  }
  function disableNative(){
    const ts=session?.video?.textTracks;
    if(!ts)return;
    for(let i=0;i<ts.length;i++)try{ts[i].mode='disabled'}catch{}
  }
  function matches(a,b){return a&&b&&a.kind===b.kind&&a.id===b.id}
  function apply(track){
    if(!session)return false;
    const options=available();
    const chosen=options.find(t=>matches(t,track));
    disableNative();
    if(session.hls){
      try{session.hls.subtitleDisplay=false;session.hls.subtitleTrack=-1}catch{}
    }
    selected=null;
    if(chosen){
      if(chosen.kind==='hls'&&session.hls){
        try{session.hls.subtitleDisplay=true;session.hls.subtitleTrack=chosen.id}catch{return false}
      }else if(chosen.kind==='native'){
        try{chosen.track.mode='showing'}catch{return false}
      }
      selected={kind:chosen.kind,id:chosen.id,language:chosen.language};
    }
    render();
    return !!chosen;
  }
  function sync(){
    if(!session)return render();
    const options=available();
    if(selected&&!options.some(t=>matches(t,selected)))selected=null;
    if(pref.enabled&&!selected&&options.length){
      const preferred=options.find(t=>pref.language&&normalize(t.language)===normalize(pref.language))||options[0];
      apply(preferred);
      return;
    }
    render();
  }
  function render(){
    const btn=control(),el=menu();
    if(btn){
      const active=!!selected;
      btn.classList.toggle('active',active);
      btn.setAttribute('aria-pressed',String(active));
      btn.setAttribute('aria-expanded',String(open));
      btn.title=active?'Subtitles on':'Subtitles and closed captions';
    }
    if(!el)return;
    el.hidden=!open;
    if(!open)return;
    el.replaceChildren();
    const heading=document.createElement('strong');
    heading.textContent='Subtitles / CC';
    el.appendChild(heading);
    const choice=(name,label,track)=>{
      const b=document.createElement('button');
      b.type='button';b.className='veloraCcChoice';
      b.dataset.captionChoice=name;
      if(track){b.dataset.captionKind=track.kind;b.dataset.captionId=String(track.id)}
      b.textContent=label;
      const checked=name==='off'?!selected:matches(track,selected);
      b.setAttribute('aria-pressed',String(checked));
      if(checked)b.classList.add('selected');
      el.appendChild(b);
    };
    choice('off','Off',null);
    const options=available();
    for(const t of options)choice('on',t.label+(t.language?' · '+t.language.toUpperCase():''),t);
    if(!options.length){
      const note=document.createElement('p');
      note.textContent=ready?'No subtitle track is available from this source.':'Checking this channel for subtitle tracks…';
      el.appendChild(note);
    }
  }
  function choose(kind,id){
    if(kind==='off'){
      pref.enabled=false;persist();apply(null);open=false;render();return true;
    }
    const t=available().find(x=>x.kind===kind&&x.id===Number(id));
    if(!t)return false;
    pref.enabled=true;pref.language=t.language;persist();
    apply(t);open=false;render();return true;
  }
  function toggle(){
    open=!open;
    render();
    if(open)menu()?.querySelector('button')?.focus();
  }
  function reset(){
    if(session){
      const {video,hls,handler,events}=session;
      video?.removeEventListener?.('loadedmetadata',handler);
      video?.textTracks?.removeEventListener?.('addtrack',handler);
      video?.textTracks?.removeEventListener?.('removetrack',handler);
      video?.textTracks?.removeEventListener?.('change',handler);
      for(const e of events)try{hls?.off?.(e,handler)}catch{}
      disableNative();
    }
    session=null;selected=null;ready=false;open=false;render();
  }
  function attach(video,hls=null){
    reset();
    if(!video)return;
    const handler=()=>{ready=true;sync()};
    const events=[];
    session={video,hls,handler,events};
    disableNative();
    if(hls){
      try{hls.subtitleDisplay=false;hls.subtitleTrack=-1}catch{}
      for(const eventName of [window.Hls?.Events?.SUBTITLE_TRACKS_UPDATED,window.Hls?.Events?.MANIFEST_PARSED,window.Hls?.Events?.MEDIA_ATTACHED]){
        if(!eventName||events.includes(eventName))continue;
        events.push(eventName);
        hls.on?.(eventName,handler);
      }
    }
    video.addEventListener?.('loadedmetadata',handler);
    for(const type of ['addtrack','removetrack','change'])video.textTracks?.addEventListener?.(type,handler);
    sync();
  }
  document.addEventListener('click',event=>{
    const choice=event.target?.closest?.('[data-caption-choice]');
    if(choice){
      event.preventDefault();
      choose(choice.dataset.captionChoice==='off'?'off':choice.dataset.captionKind,choice.dataset.captionId);
      return;
    }
    if(open&&!event.target?.closest?.('.veloraCcAnchor')){open=false;render()}
  });
  document.addEventListener('keydown',event=>{
    if(open&&event.key==='Escape'){open=false;render();control()?.focus()}
  });
  window.veloraCaptions={attach,reset,refresh:sync,toggle,choose,available};
})();
