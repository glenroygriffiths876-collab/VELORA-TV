// VELORA captions — source-supplied subtitle tracks only (no speech recognition).
(() => {
  'use strict';
  let session=null, selected=null, open=false, ready=false, channel=null;
  let pref={enabled:false,language:'',audioLanguage:'en'};
  try {
    const saved=JSON.parse(localStorage.getItem('velora_captions')||'null');
    if(saved&&typeof saved==='object')pref={enabled:saved.enabled===true,language:String(saved.language||''),audioLanguage:String(saved.audioLanguage||'en')};
  } catch {}
  const persist=()=>{try{localStorage.setItem('velora_captions',JSON.stringify(pref))}catch{}};
  const control=()=>document.querySelector('[data-v15-control="cc"]');
  const menu=()=>document.getElementById('veloraCcMenu');
  const normalize=s=>String(s||'').trim().toLowerCase();
  const isoCode=s=>normalize(s).split(/[-_]/)[0];
  const isEnglish=s=>['en','eng'].includes(isoCode(s));
  // IPTV guide identifiers encode channel editions (not guaranteed audio).
  const edition=ch=>{
    const match=String(ch?.epgId||ch?.tvgId||'').match(/\.([a-z]{2})(?:@|$)/i);
    const editions={fr:'French edition',es:'Spanish edition',de:'German edition',it:'Italian edition',pt:'Portuguese edition'};
    return match?editions[normalize(match[1])]||'':'';
  };
  const audioOptions=()=>{
    if(!session)return [];
    const list=[];
    const h=session.hls?.audioTracks;
    if(h?.length){
      for(let i=0;i<h.length;i++)if(h[i])list.push({kind:'hls-audio',id:i,language:String(h[i].lang||''),label:String(h[i].name||h[i].lang||'Audio '+(i+1))});
      return list;
    }
    const n=session.video?.audioTracks;
    if(n?.length)for(let i=0;i<n.length;i++)if(n[i])list.push({kind:'native-audio',id:i,language:String(n[i].language||''),label:String(n[i].label||n[i].language||'Audio '+(i+1))});
    return list;
  };
  function selectAudio(track,manual=false){
    if(!session||!track)return false;
    const t=audioOptions().find(x=>matches(x,track));if(!t)return false;
    if(t.kind==='hls-audio'){
      if(session.hls.audioTrack!==t.id)session.hls.audioTrack=t.id;
    }else{
      const tracks=session.video?.audioTracks;
      if(!tracks)return false;
      for(let i=0;i<tracks.length;i++)tracks[i].enabled=i===t.id;
    }
    if(manual){session.manualAudio=true;pref.audioLanguage=t.language||'en';persist()}
    render();return true;
  }
  function preferAudio(){
    if(!session||session.manualAudio)return;
    const options=audioOptions(),preferred=options.find(t=>isoCode(t.language)===isoCode(pref.audioLanguage))
      ||(isEnglish(pref.audioLanguage)?options.find(t=>isEnglish(t.language)):null);
    if(preferred)selectAudio(preferred);
  }
  function setChannel(c){
    channel=c||null;
    const hint=document.getElementById('veloraSourceEdition');
    if(hint){hint.textContent=edition(channel);hint.hidden=!edition(channel)}
    render();
  }
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
    for(let i=0;i<ts.length;i++)try{if(ts[i].mode!=='disabled')ts[i].mode='disabled'}catch{}
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
    preferAudio();
    const options=available();
    if(!pref.enabled){
      if(selected){apply(null);return}
      disableNative();
      if(session.hls?.subtitleDisplay)try{session.hls.subtitleDisplay=false;session.hls.subtitleTrack=-1}catch{}
      return render();
    }
    if(selected&&!options.some(t=>matches(t,selected)))selected=null;
    if(pref.enabled&&!selected&&options.length){
      const preferred=options.find(t=>pref.language&&normalize(t.language)===normalize(pref.language))||options.find(t=>isEnglish(t.language))||options[0];
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
    const languageHint=edition(channel);
    if(languageHint){
      const note=document.createElement('p');
      note.textContent='Channel guide: '+languageHint+'. Captions do not change the spoken audio.';
      el.appendChild(note);
    }
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
      note.textContent=ready?'No subtitles supplied by this stream. Live speech translation is not available.':'Checking this stream for subtitle tracks…';
      el.appendChild(note);
    }
    const audioHeading=document.createElement('strong');
    audioHeading.className='veloraCcAudioHeading';
    audioHeading.textContent='Audio language';
    el.appendChild(audioHeading);
    const audio=audioOptions();
    for(const t of audio){
      const b=document.createElement('button');
      b.type='button';
      b.className='veloraCcChoice';
      b.dataset.captionAudioKind=t.kind;
      b.dataset.captionAudioId=String(t.id);
      b.textContent=t.label+(t.language?' · '+t.language.toUpperCase():'');
      const on=t.kind==='hls-audio'?session?.hls?.audioTrack===t.id:!!session?.video?.audioTracks?.[t.id]?.enabled;
      b.setAttribute('aria-pressed',String(on));
      if(on)b.classList.add('selected');
      el.appendChild(b);
    }
    if(!audio.length){
      const note=document.createElement('p');
      note.textContent='This stream has no selectable alternative audio track.';
      el.appendChild(note);
    }
    if(channel&&languageHint){
      const b=document.createElement('button');
      b.className='veloraCcFind';
      b.type='button';
      b.dataset.captionBrowse='1';
      b.textContent='Search other channel editions ↗';
      el.appendChild(b);
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
      video?.audioTracks?.removeEventListener?.('addtrack',handler);
      video?.audioTracks?.removeEventListener?.('removetrack',handler);
      video?.audioTracks?.removeEventListener?.('change',handler);
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
    session={video,hls,handler,events,manualAudio:false};
    disableNative();
    if(hls){
      try{hls.subtitleDisplay=false;hls.subtitleTrack=-1}catch{}
      for(const eventName of [window.Hls?.Events?.SUBTITLE_TRACKS_UPDATED,window.Hls?.Events?.AUDIO_TRACKS_UPDATED,window.Hls?.Events?.AUDIO_TRACK_SWITCHED,window.Hls?.Events?.MANIFEST_PARSED,window.Hls?.Events?.MEDIA_ATTACHED]){
        if(!eventName||events.includes(eventName))continue;
        events.push(eventName);
        hls.on?.(eventName,handler);
      }
    }
    video.addEventListener?.('loadedmetadata',handler);
    for(const type of ['addtrack','removetrack','change']){
      video.textTracks?.addEventListener?.(type,handler);
      video.audioTracks?.addEventListener?.(type,handler);
    }
    sync();
  }
  document.addEventListener('click',event=>{
    const choice=event.target?.closest?.('[data-caption-choice]');
    if(choice){
      event.preventDefault();
      choose(choice.dataset.captionChoice==='off'?'off':choice.dataset.captionKind,choice.dataset.captionId);
      return;
    }
    const audio=event.target?.closest?.('[data-caption-audio-kind]');
    if(audio){
      event.preventDefault();
      const t=audioOptions().find(x=>x.kind===audio.dataset.captionAudioKind&&x.id===Number(audio.dataset.captionAudioId));
      selectAudio(t,true);
      return;
    }
    if(event.target?.closest?.('[data-caption-browse]')){
      event.preventDefault();
      const input=document.getElementById('channelSearch');
      if(input&&channel){
        input.value=String(channel.name||'').replace(/\([^)]*\)/g,'').trim();
        window.veloraLiveV15?.openSearch?.();
        if(typeof window.drawChannelList==='function')window.drawChannelList(input.value);
      }
      open=false;render();return;
    }
    if(open&&!event.target?.closest?.('.veloraCcAnchor')){open=false;render()}
  });
  document.addEventListener('keydown',event=>{
    if(open&&event.key==='Escape'){open=false;render();control()?.focus()}
  });
  window.veloraCaptions={attach,reset,refresh:sync,toggle,choose,available,audioOptions,selectAudio,setChannel,edition};
})();
