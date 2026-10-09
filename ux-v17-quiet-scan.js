// VELORA V17 — responsive TV remote, separate quiet discovery of playable video.
// Never tune an unknown/broken channel when pressing CH+ or CH−.
(() => {
  'use strict';
  const KEY='velora_verified_video_v17';
  const FRESH_MS=4*60*60*1000;
  const RETRY_MS=15*60*1000;
  const FAIL_MS=20*60*1000;
  // No fixed channel target or per-session attempt cap. Scanning is a
  // rotating, rate-limited process while the browser tab stays visible.
  const DISCOVERY_BATCH=36;
  const HEARTBEAT_MS=12000;
  const BATCH_PAUSE_MS=900;
  const MAX_WORKERS=3;
  const ACTIVE_VIEW_WORKERS=2;
  const PROBE_MS=3000;
  const known=new Map();
  const workingUrls=new Map(); // confirmed stream URL kept in RAM, never in storage
  const blocked=new Map();
  const checked=new Map();
  let order=[];
  let scanning=false;
  let generation=0;
  let autoFailover=false;
  let failoverTimer=null;
  let startupTimer=null;
  let lastMessage=0;
  let lastGoodId='';
  let pendingNext=null;
  let checkedInSession=0;
  let successfulInSession=0;
  let cycles=0;
  let lastAttemptAt=0;
  let lastNewChannelAt=0;
  let scanRestartTimer=null;

  function fingerprint(c) {
    // Keep any source URLs/tokens out of persistent storage.
    const source=String(c.id||'')+'|'+String(c.url||'')+'|'+String(c.upstreamUrl||'');
    let hash=2166136261;
    for(let i=0;i<source.length;i++){hash^=source.charCodeAt(i);hash=Math.imul(hash,16777619)}
    return String(c.id||'')+'|'+(hash>>>0).toString(36);
  }
  function remember() {
    try {
      // Save every still-fresh verified channel, without a 1,250-item cap.
      // Expired records are pruned first to avoid unbounded local storage use.
      const now=Date.now();
      const saved=[...known.entries()].filter(([id,x])=>
        id&&x&&now-Number(x.at||0)<FRESH_MS);
      for(const [id,x] of [...known])if(now-Number(x?.at||0)>=FRESH_MS)known.delete(id);
      localStorage.setItem(KEY,JSON.stringify(saved));
    } catch {}
  }
  try {
    const data=JSON.parse(localStorage.getItem(KEY)||'[]');
    if(Array.isArray(data))for(const entry of data) {
      if(!Array.isArray(entry)||entry.length!==2)continue;
      const [id,x]=entry;
      if(typeof id==='string'&&x&&Date.now()-Number(x.at||0)<FRESH_MS)known.set(id,x);
    }
  } catch {}

  function catalog() {
    const rows=filteredChannels();
    const byId=new Map(rows.map(c=>[c.id,c]));
    // Freeze the remote order at first catalog load. A newly arrived channel is
    // appended, never moved around due to a server health probe.
    if(!order.length)order=rows.map(c=>c.id);
    else {
      const seen=new Set(order);
      for(const c of rows)if(!seen.has(c.id)){order.push(c.id);seen.add(c.id)}
    }
    return {rows,byId};
  }
  function working(c) {
    if(!c||blocked.get(c.id)>Date.now()||V7_SESSION_FAILED_IDS.has(c.id))return false;
    const stored=known.get(c.id);
    if(!stored)return false;
    if(Date.now()-Number(stored.at||0)>=FRESH_MS||stored.fingerprint!==fingerprint(c)) {
      known.delete(c.id);return false;
    }
    return true;
  }
  function readyList() {
    const {byId}=catalog();
    // The remote follows the order channels became video-verified, not the
    // original (frequently changing) catalogue popularity rankings.
    // Keep the main TVJ first, but never mistake TVJ Sports for TVJ.
    const verified=[...known.keys()].map(id=>byId.get(id)).filter(working);
    const tvj=verified.find(c=>v7IsTVJ(c));
    return tvj?[tvj,...verified.filter(c=>c.id!==tvj.id)]:verified;
  }
  function countLabel() {
    const n=readyList().length;
    return n+' video-verified channel'+(n===1?'':'s');
  }
  function mark(c,fromBackground=false,verifiedUrl='') {
    if(!c?.id)return;
    blocked.delete(c.id);
    // A fresh decoded video frame overrides a historical session failure.
    // Otherwise a recovered channel would never reappear in the guide.
    V7_SESSION_FAILED_IDS.delete(c.id);
    checked.set(c.id,Date.now());
    const localCandidates=v7LiveCandidates(c);
    if(verifiedUrl)workingUrls.set(c.id,verifiedUrl);
    const chosen=workingUrls.get(c.id)||verifiedUrl||'';
    const index=localCandidates.indexOf(chosen);
    const previous=known.get(c.id);
    known.set(c.id,{at:Date.now(),fingerprint:fingerprint(c),
      sourceIndex:index>=0?index:Number(previous?.sourceIndex||0)});
    if(!previous){successfulInSession++;lastNewChannelAt=Date.now()}
    remember();
    window.veloraVerifiedGuide?.refresh?.();
    // Background discovery may only refresh listings, never tune away from
    // the explicitly selected channel, even after a timeout or stream failure.
    if(document.getElementById('view-live')?.classList.contains('active')){
      const input=document.getElementById('channelSearch');
      if(!input?.value)try{drawChannelList('')}catch{}
    }
  }
  function fail(c) {
    if(!c?.id)return;
    known.delete(c.id);
    workingUrls.delete(c.id);
    checked.set(c.id,Date.now());
    blocked.set(c.id,Date.now()+FAIL_MS);
    remember();
    window.veloraVerifiedGuide?.refresh?.();
  }
  function message(s) {
    const now=Date.now();
    if(now-lastMessage>300 || s!==message.previous) {
      toast(s);message.previous=s;lastMessage=now;
    }
  }
  function quietFindMore(urgent=false) {
    // Scan More wakes a sleeping scanner but never removes source cooldowns
    // or launches multiple competing video decoders.
    if(urgent)clearTimeout(scanRestartTimer);
    if(!scanning)startDiscovery();
  }
  function activePlaying() {
    const v=document.getElementById('inlineLive');
    return !!(v&&!v.classList.contains('hidden')&&!v.paused&&
      v.readyState>=2&&v.videoWidth>0&&v.videoHeight>0&&v.currentTime>.1);
  }

  // CH navigation uses ONLY real video-confirmed items. No queue of 14 failed
  // channels, no 90-second foreground wait, and no surprise TVJ wrap-around
  // when the verified pool is still small.
  window.veloraTuneWorkingChannel=(delta=1,preferredId='')=>{
    clearTimeout(failoverTimer);
    const {byId}=catalog();
    const onScreen=state.currentChannel;
    if(preferredId) {
      pendingNext=null;
      const requested=byId.get(preferredId);
      const ready=readyList();
      const target=ready.find(c=>c.id===preferredId)||
        (ready.length?ready[0]:requested);
      quietFindMore();
      if(!target) {
        message('No channel has verified video yet. Checking sources in the background.');
        return false;
      }
      if(target.id===onScreen?.id&&activePlaying())return true;
      selectChannel(target.id,true);
      return true;
    }

    const verified=readyList();
    quietFindMore();
    if(!verified.length) {
      message('No video-verified channels yet. Open Search to try a channel.');
      return false;
    }
    const currentIndex=verified.findIndex(c=>c.id===onScreen?.id);
    const step=delta<0?-1:1;
    let nextIndex;
    if(currentIndex<0) {
      // A stream that died should return to the previous working channel,
      // rather than jumping arbitrarily to TVJ at the start of the list.
      const previous=verified.findIndex(c=>c.id===lastGoodId);
      if(previous>=0){selectChannel(verified[previous].id,true);return true}
      nextIndex=step>0?0:verified.length-1;
    }
    else nextIndex=currentIndex+step;
    if(nextIndex<0||nextIndex>=verified.length) {
      // Never wrap at the end of the VERIFIED lineup: three channels is not
      // a licence to loop TVJ -> NBC -> Fox -> TVJ forever.
      quietFindMore(true);
      message(countLabel()+' currently playable. Staying on '+
        String(onScreen?.name||'this channel')+' while finding more.');
      return false;
    }
    const next=verified[nextIndex];
    if(!next||next.id===onScreen?.id) {
      message('Only '+countLabel()+' available. Checking for more.');
      return false;
    }
    // This is ONE known channel selection, not a scan on the visible player.
    pendingNext=null;
    if(onScreen?.id&&working(onScreen))lastGoodId=onScreen.id;
    selectChannel(next.id,true);
    return true;
  };

  const reportBefore=v7ReportPlayback;
  v7ReportPlayback=function(c,url,ok,reason='',final=false) {
    reportBefore(c,url,ok,reason,final);
    if(ok===true) {
      mark(c,false,url);
      autoFailover=false;
      return;
    }
    if(final===true)fail(c); // Keep selected channel on screen for retry.
  };

  function advanceAfterFailure(c) {
    if(state.currentChannel?.id!==c?.id||autoFailover)return;
    const remaining=readyList().filter(x=>x.id!==c.id);
    if(!remaining.length) {
      message('No other verified channels yet. VELORA is checking more quietly.');
      quietFindMore();
      return;
    }
    autoFailover=true;
    // Use only the next verified channel; do not expose failed stream attempts.
    const position=order.indexOf(c.id);
    const choice=remaining.find(x=>x.id===lastGoodId)||
      remaining.find(x=>order.indexOf(x.id)>position)||remaining[0];
    selectChannel(choice.id,true);
    setTimeout(()=>{autoFailover=false},1000);
  }

  // The tuned source is reused directly by V7; do not run a fresh multi-source
  // backend resolve on every remote press. Old successes are rechecked when used.
  window.veloraFastLiveUrls=function(c) {
    if(!working(c))return [];
    const urls=v7LiveCandidates(c);
    const remembered=known.get(c.id);
    const best=workingUrls.get(c.id)||
      urls[Math.min(urls.length-1,Math.max(0,Number(remembered?.sourceIndex||0)))];
    return best?[best]:[];
  };

  // V7's original unavailable overlay remains for explicit Search selections.
  // On a failed remote selection, the report handler above switches to a known
  // good channel. It does not initiate another visible search.
  const originalSelect=selectChannel;
  selectChannel=function(id,autoplay=true) {
    clearTimeout(failoverTimer);
    if(pendingNext && pendingNext.fromId!==id)pendingNext=null;
    return originalSelect(id,autoplay);
  };

  function isCandidate(c) {
    if(!c?.id||working(c)||blocked.get(c.id)>Date.now())return false;
    // A prior selection failure cannot ban a stream forever. Its cooldown
    // expires just like failures discovered by the background scanner.
    // Check Jamaican streams directly from the viewer's territory too.
    if(!v7LiveCandidates(c).length)return false;
    const last=checked.get(c.id)||0;
    return !last||Date.now()-last>=RETRY_MS;
  }
  function priority(c) {
    const played=Date.parse(c.lastPlaybackSuccessAt||0)||0;
    const failed=Date.parse(c.lastPlaybackFailureAt||0)||0;
    if(played>failed&&Date.now()-played<24*3600000)return 100000;
    if(c.availability==='up')return 4000;
    if((c.sources||[]).some(s=>s.health==='up'))return 2000;
    if(c.availability==='down')return -5000;
    return 0;
  }
  function probeVideo(c,url,ms=PROBE_MS) {
    return new Promise(resolve=>{
      if(!url)return resolve(false);
      let finished=false,hls=null,frameId=null;
      const v=document.createElement('video');
      v.muted=true;v.defaultMuted=true;v.autoplay=true;
      v.playsInline=true;v.setAttribute('playsinline','');
      v.preload='auto';
      // Must be attached for decoded frames on Android WebView/Chrome.
      v.style.cssText='position:fixed;left:-9999px;top:0;width:8px;height:8px;opacity:0;pointer-events:none;';
      document.body.appendChild(v);
      const finish=ok=>{
        if(finished)return;
        finished=true;
        clearTimeout(timer);clearInterval(poll);
        try{if(frameId!==null)v.cancelVideoFrameCallback?.(frameId)}catch{}
        try{hls?.destroy()}catch{}
        try{v.pause();v.removeAttribute('src');v.load()}catch{}
        v.remove();
        resolve(!!ok);
      };
      const decoded=()=>v.videoWidth>0&&v.videoHeight>0&&!v.paused&&v.readyState>=2&&v.currentTime>.08;
      const poll=setInterval(()=>{if(decoded())finish(true)},250);
      const timer=setTimeout(()=>finish(false),ms);
      v.onerror=()=>finish(false);
      v.onloadeddata=()=>{v.play().catch(()=>{})};
      v.oncanplay=()=>{v.play().catch(()=>{})};
      if(typeof v.requestVideoFrameCallback==='function') {
        try {
          frameId=v.requestVideoFrameCallback(()=>{
            if(v.videoWidth>0&&v.videoHeight>0)finish(true);
          });
        }catch{}
      }
      try {
        if(window.Hls&&Hls.isSupported()&&(/\.m3u8(?:$|\?)/i.test(url)||url.includes('/api/public/'))) {
          hls=new Hls({enableWorker:true,maxBufferLength:3,manifestLoadingTimeOut:4000,
            levelLoadingTimeOut:4000,fragLoadingTimeOut:4000});
          hls.on(Hls.Events.ERROR,(_,detail)=>{if(detail?.fatal)finish(false)});
          hls.attachMedia(v);
          hls.loadSource(url);
          hls.on(Hls.Events.MANIFEST_PARSED,()=>{v.play().catch(()=>{})});
        } else {
          v.src=url;v.load();v.play().catch(()=>{});
        }
      } catch {finish(false)}
    });
  }
  async function checkCandidate(c,epoch) {
    if(epoch!==generation||document.hidden||!isCandidate(c))return;
    checked.set(c.id,Date.now());
    const urls=v7LiveCandidates(c).slice(0,2);
    let winningUrl='';
    for(const url of urls) {
      if(epoch!==generation||document.hidden)break;
      if(await probeVideo(c,url)){winningUrl=url;break}
    }
    if(epoch!==generation)return;
    if(winningUrl)mark(c,true,winningUrl);
    else blocked.set(c.id,Date.now()+FAIL_MS);
  }
  function discoveryPool() {
    const {rows}=catalog();
    const current=state.currentChannel?.id;
    return rows.filter(c=>c.id!==current&&isCandidate(c))
      .map((c,i)=>({
        c,i,
        // Never-tested sources first, then previously successful/high-quality
        // sources, without repeatedly rescanning the same small top-100 pool.
        score:(checked.has(c.id)?0:1000000)+priority(c)
      }))
      .sort((a,b)=>b.score-a.score||a.i-b.i)
      .slice(0,DISCOVERY_BATCH).map(x=>x.c);
  }
  function startDiscovery() {
    if(scanning||document.hidden)return;
    clearTimeout(scanRestartTimer);
    const queue=discoveryPool();
    if(!queue.length){
      // All currently eligible sources may be on cooldown. A separate
      // heartbeat wakes the scanner when cooldowns expire or feeds arrive.
      return;
    }
    scanning=true;
    const epoch=++generation;
    let next=0;
    const worker=async()=>{
      while(epoch===generation&&!document.hidden&&next<queue.length){
        const c=queue[next++];
        checkedInSession++;
        lastAttemptAt=Date.now();
        await checkCandidate(c,epoch);
      }
    };
    const live=document.getElementById('view-live')?.classList.contains('active');
    // Preserve decoder/network bandwidth for the selected channel.
    const playing=activePlaying();
    const workers=live?(playing?ACTIVE_VIEW_WORKERS:1):MAX_WORKERS;
    Promise.all(Array.from({length:workers},worker)).finally(()=>{
      if(epoch!==generation)return;
      scanning=false;cycles++;
      if(!document.hidden) {
        // Unlimited rounds, using cooldowns to avoid hammering dead streams.
        scanRestartTimer=setTimeout(startDiscovery,BATCH_PAUSE_MS);
      }
    });
  }
  // Browsers throttle hidden tabs and installed PWAs in the background.
  // Keep discovery alive whenever the app is foregrounded, and wake it after
  // a cooldown even if an earlier batch had zero eligible candidates.
  setInterval(()=>{
    if(!document.hidden&&!scanning)startDiscovery();
  },HEARTBEAT_MS);
  // A slow provider catalogue must also trigger scanning when it finally
  // arrives. Previously, the scanner could finish before these rows existed.
  if(typeof v7ApplySnapshot==='function') {
    const beforeSnapshot=v7ApplySnapshot;
    v7ApplySnapshot=function(...args) {
      const result=beforeSnapshot(...args);
      setTimeout(()=>{
        if(!document.hidden) {
          catalog();
          quietFindMore();
        }
      },350);
      return result;
    };
  }

  function kick() {
    clearTimeout(startupTimer);
    startupTimer=setTimeout(()=>{
      if(!document.hidden) {
        catalog();
        // Adopt the channel already playing even if it was started before V17.
        if(activePlaying()&&state.currentChannel)mark(state.currentChannel);
        startDiscovery();
      }
    },1300);
  }
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){
      generation++;scanning=false;
      clearTimeout(scanRestartTimer);
      pendingNext=null;
    } else kick();
  });
  document.addEventListener('playing',e=>{
    if(e.target?.id!=='inlineLive')return;
    setTimeout(()=>{if(activePlaying()&&state.currentChannel)mark(state.currentChannel)},800);
  },true);
  window.veloraVerifiedChannels={
    ids:()=>readyList().map(c=>c.id),
    count:()=>readyList().length,
    scan:()=>quietFindMore(true),
    scanStatus:()=>({verified:readyList().length,checked:checkedInSession,
      scanning,cycles,successful:successfulInSession,lastAttemptAt,
      lastNewChannelAt,continuous:true,paused:document.hidden})
  };
  kick();
})();
