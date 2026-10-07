// VELORA UX V14 — compact Live TV remote.
(() => {
  function remoteMarkup(){
    return `<aside class="veloraLiveRemote" aria-label="Live TV remote control">
      <div class="veloraRemoteTop">
        <span class="veloraRemoteDot"></span>
        <b>REMOTE</b>
      </div>
      <div class="veloraRemoteChannel">
        <button type="button" data-velora-remote="channel-up" aria-label="Next channel"><span>CH</span><b>▲</b></button>
        <div class="veloraRemoteChannelLabel">CHANNEL</div>
        <button type="button" data-velora-remote="channel-down" aria-label="Previous channel"><span>CH</span><b>▼</b></button>
      </div>
      <div class="veloraRemoteVolume">
        <span>VOL</span>
        <div>
          <button type="button" data-velora-remote="vol-down" aria-label="Volume down">−</button>
          <button type="button" data-velora-remote="mute" aria-label="Mute or unmute">◉</button>
          <button type="button" data-velora-remote="vol-up" aria-label="Volume up">＋</button>
        </div>
        <small id="veloraRemoteVolumeLabel">100%</small>
      </div>
      <button type="button" class="veloraRemoteFullscreen" data-velora-remote="fullscreen" aria-label="Full screen">⛶ <span>FULL</span></button>
    </aside>`;
  }

  function decorateLiveRemote(){
    const pane=document.querySelector('#view-live .channelPane');
    if(!pane||pane.querySelector('.veloraLiveRemote'))return;
    const cats=pane.querySelector('.channelCats');
    const list=pane.querySelector('.channelList');
    if(!cats||!list)return;

    const layout=document.createElement('div');
    layout.className='veloraChannelRemoteLayout';
    const channelCol=document.createElement('div');
    channelCol.className='veloraChannelColumn';

    pane.insertBefore(layout,cats);
    layout.appendChild(channelCol);
    channelCol.appendChild(cats);
    channelCol.appendChild(list);

    const holder=document.createElement('div');
    holder.innerHTML=remoteMarkup();
    layout.appendChild(holder.firstElementChild);

    const oldFullscreen=document.getElementById('openFullLive');
    if(oldFullscreen)oldFullscreen.classList.add('veloraLegacyFullscreenHidden');
    updateRemoteVolume();
  }

  const priorRenderLive=renderLive;
  renderLive=function(){
    priorRenderLive();
    decorateLiveRemote();
  };

  function visibleChannelIds(){
    return [...document.querySelectorAll('#channelList [data-channel]')]
      .map(el=>el.dataset.channel)
      .filter(Boolean);
  }

  function changeChannel(delta){
    const ids=visibleChannelIds();
    if(!ids.length){toast('No channels in this list.');return}
    let index=state.currentChannel?ids.indexOf(state.currentChannel.id):-1;
    if(index<0)index=delta>0?-1:0;
    const next=(index+delta+ids.length)%ids.length;
    selectChannel(ids[next],true);
    setTimeout(()=>{
      document.querySelector(`#channelList [data-channel="${CSS.escape(ids[next])}"]`)?.scrollIntoView({behavior:'smooth',block:'nearest'});
    },80);
  }

  function activeVideo(){
    const v=document.getElementById('inlineLive');
    return v&&!v.classList.contains('hidden')?v:null;
  }

  function updateRemoteVolume(){
    const v=activeVideo()||document.getElementById('inlineLive');
    const label=document.getElementById('veloraRemoteVolumeLabel');
    const mute=document.querySelector('[data-velora-remote="mute"]');
    if(!label)return;
    if(!v){
      label.textContent='—';
      return;
    }
    label.textContent=v.muted?'MUTE':Math.round((Number(v.volume)||0)*100)+'%';
    if(mute)mute.classList.toggle('active',!!v.muted);
  }

  function volume(delta){
    const v=activeVideo();
    if(!v){toast('Volume is controlled by this channel source or your device.');return}
    v.muted=false;
    v.volume=Math.max(0,Math.min(1,(Number(v.volume)||0)+delta));
    updateRemoteVolume();
  }

  function toggleMute(){
    const v=activeVideo();
    if(!v){toast('Mute is controlled by this channel source or your device.');return}
    v.muted=!v.muted;
    updateRemoteVolume();
  }

  async function fullScreen(){
    const video=activeVideo();
    const frame=document.getElementById('inlineLiveEmbed');
    const embed=frame&&!frame.classList.contains('hidden')?frame:null;
    const target=video||embed;
    if(!target){toast('Start a working channel before using full screen.');return}
    try{
      if(document.fullscreenElement){await document.exitFullscreen?.();return}
      if(target.requestFullscreen){await target.requestFullscreen();return}
      if(video?.webkitEnterFullscreen){video.webkitEnterFullscreen();return}
      if(target.webkitRequestFullscreen){target.webkitRequestFullscreen();return}
      toast('Full screen is not available for this source.');
    }catch{
      toast('Full screen is not available for this source.');
    }
  }

  document.addEventListener('click',e=>{
    const btn=e.target.closest('[data-velora-remote]');
    if(!btn)return;
    e.preventDefault();e.stopImmediatePropagation();
    const action=btn.dataset.veloraRemote;
    if(action==='channel-up')changeChannel(1);
    else if(action==='channel-down')changeChannel(-1);
    else if(action==='vol-up')volume(.1);
    else if(action==='vol-down')volume(-.1);
    else if(action==='mute')toggleMute();
    else if(action==='fullscreen')fullScreen();
  },true);

  document.addEventListener('volumechange',e=>{
    if(e.target?.id==='inlineLive')updateRemoteVolume();
  },true);

  if(state.user)try{decorateLiveRemote()}catch{}
})();