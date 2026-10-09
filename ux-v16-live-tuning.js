// VELORA V16 — verify real video before accepting a channel during CH+/CH− tuning.
// The existing player/remote/UI remain unchanged. A responsive URL is NOT proof of video.
(() => {
  const confirmed = new Map(); // verified decoded video frame on this device/session
  const excluded = new Set();
  const ATTEMPTS = 14;
  const TUNE_BUDGET_MS = 90000;
  const PER_CHANNEL_MS = 16000;
  let tuning = null;
  let bufferTimer = null;
  let recovering = false;

  function isEligible(c) {
    if (!c?.id || excluded.has(c.id) || V7_SESSION_FAILED_IDS.has(c.id)) return false;
    // Preserve the existing default-browse decision to omit unverified Jamaican
    // feeds, except TVJ; explicit search can still find those channels.
    if (v7IsJamaicanChannel(c) && !v7IsTVJ(c)) return false;
    const last = Date.parse(c.lastAvailabilityCheck || 0) || 0;
    if (String(c.availability || '').toLowerCase() === 'down' &&
        last && Date.now() - last < 30 * 60000) return false;
    return v7LiveCandidates(c).length > 0;
  }

  function evidence(c) {
    if (confirmed.has(c.id)) return 10000;
    const played = Date.parse(c.lastPlaybackSuccessAt || 0) || 0;
    const failed = Date.parse(c.lastPlaybackFailureAt || 0) || 0;
    if (played > failed && Date.now() - played < 2 * 3600000) return 2000;
    const checked = Date.parse(c.lastAvailabilityCheck || 0) || 0;
    if (String(c.availability || '').toLowerCase() === 'up' &&
        checked && Date.now() - checked < 2 * 3600000) return 700;
    if ((c.sources || []).some(s => String(s.health || '').toLowerCase() === 'up' &&
        Date.now() - (Date.parse(s.lastChecked || 0) || 0) < 2 * 3600000)) return 450;
    return 0;
  }

  function candidates(delta, preferredId) {
    const all = filteredChannels().filter(isEligible);
    if (!all.length) return [];
    const direction = delta < 0 ? -1 : 1;
    const current = state.currentChannel?.id;
    const position = all.findIndex(c => c.id === (preferredId || current));
    const selected = [];
    const seen = new Set();
    if (preferredId) {
      const preferred = all.find(c => c.id === preferredId);
      if (preferred) { selected.push(preferred); seen.add(preferred.id); }
    }
    for (let step = 1; step <= all.length; step++) {
      const index = position < 0
        ? (direction > 0 ? step - 1 : all.length - step)
        : (position + step * direction % all.length + all.length) % all.length;
      const c = all[index];
      if (!c || seen.has(c.id) || (!preferredId && c.id === current)) continue;
      seen.add(c.id);
      selected.push(c);
    }
    // Channels already confirmed here come first; then recent playback
    // successes, then fresh server probes; unknown channels are tried last.
    // Keep the CH direction/order stable within each evidence class.
    return selected.map((c, i) => ({c, i, score:evidence(c)}))
      .sort((a,b) => b.score - a.score || a.i - b.i)
      .slice(0, ATTEMPTS).map(x => x.c);
  }

  function closeTune(t) {
    if (!t || tuning !== t) return;
    clearTimeout(t.timer);
    tuning = null;
  }

  function searchStatus(t) {
    const n = document.getElementById('nowChannel');
    const p = document.getElementById('nowProgram');
    if (n) n.textContent = 'Finding a working channel…';
    if (p) p.textContent = 'Checking actual video • '+t.index+' of '+t.queue.length;
  }

  function scanNext(t) {
    if (tuning !== t) return;
    clearTimeout(t.timer);
    if (t.index >= t.queue.length || Date.now() - t.started > TUNE_BUDGET_MS) {
      closeTune(t);
      const current = state.currentChannel;
      if (current) {
        v7ShowLiveStatus(current,'No playable channel confirmed',
          'The available sources could not deliver working video. Try Next again or search for a channel.',false);
      }
      const p = document.getElementById('nowProgram');
      if (p) p.textContent = 'No working video confirmed';
      return;
    }
    const c = t.queue[t.index++];
    t.currentId = c.id;
    t.timer = setTimeout(() => {
      if (tuning !== t || t.currentId !== c.id) return;
      excluded.add(c.id);
      V7_SESSION_FAILED_IDS.add(c.id);
      v7ReportPlayback(c,c.url || '',false,'tuning-timeout',true);
      scanNext(t);
    }, PER_CHANNEL_MS);
    // The existing player's selection token invalidates late responses from
    // sources abandoned by the tuner.
    selectChannel(c.id,true);
    searchStatus(t);
  }

  window.veloraTuneWorkingChannel = function(delta = 1, preferredId = '') {
    if (tuning) closeTune(tuning);
    clearTimeout(bufferTimer);
    recovering = false;
    const queue = candidates(delta,preferredId);
    if (!queue.length) {
      toast('No working video sources are available to try.');
      return false;
    }
    const t = {queue,index:0,currentId:'',started:Date.now(),timer:null};
    tuning = t;
    scanNext(t);
    return true;
  };

  // A channel is only accepted after V7's frame verification reports success.
  const originalReport = v7ReportPlayback;
  v7ReportPlayback = function(c,url,ok,reason='',final=false) {
    originalReport(c,url,ok,reason,final);
    if (!c?.id) return;
    if (ok === true) {
      confirmed.set(c.id,Date.now());
      excluded.delete(c.id);
      if (tuning && tuning.currentId === c.id) closeTune(tuning);
      if (state.currentChannel?.id === c.id) {
        const n = document.getElementById('nowChannel');
        const p = document.getElementById('nowProgram');
        if (n) n.textContent = c.name;
        if (p) p.textContent = (c.now || 'Live') + ' • Video verified on this device';
      }
      recovering = false;
      watchHlsFailures(c);
    } else if (final === true) {
      excluded.add(c.id);
    }
  };

  const originalUnavailable = v7KeepSearching;
  v7KeepSearching = function(c,token) {
    const t = tuning;
    originalUnavailable(c,token);
    if (t && tuning === t && t.currentId === c?.id && token === V7_SELECTION_TOKEN) {
      excluded.add(c.id);
      scanNext(t); // skip failed channel automatically, no selection required
    }
  };

  // Never present an unverified candidate as a working channel while scanning.
  const originalStatus = v7ShowLiveStatus;
  v7ShowLiveStatus = function(c,title,message,busy=false) {
    if (tuning && tuning.currentId === c?.id) {
      return originalStatus(c,'Finding a working channel',
        'Testing video playback before selecting the channel…',true);
    }
    return originalStatus(c,title,message,busy);
  };

  const originalSelect = selectChannel;
  selectChannel = function(id,autoplay=true) {
    // An explicit channel choice cancels any background CH scanning.
    if (tuning && tuning.currentId !== id) closeTune(tuning);
    clearTimeout(bufferTimer);
    const result = originalSelect(id,autoplay);
    const p = document.getElementById('nowProgram');
    if (tuning && tuning.currentId === id) searchStatus(tuning);
    else if (p) p.textContent = 'Checking video playback…';
    return result;
  };

  function watchHlsFailures(c) {
    const player = state.hls;
    if (!player || !window.Hls?.Events?.ERROR || typeof player.on !== 'function') return;
    player.on(Hls.Events.ERROR,(_,event) => {
      if (event?.fatal && state.hls === player &&
          state.currentChannel?.id === c.id) onPlaybackLost(c);
    });
  }

  function onPlaybackLost(c) {
    if (!c?.id || recovering || tuning || state.currentChannel?.id !== c.id) return;
    recovering = true;
    excluded.add(c.id);
    V7_SESSION_FAILED_IDS.add(c.id);
    v7ReportPlayback(c,c.url || '',false,'playback-stopped',true);
    // Playback interruptions never override the channel the viewer picked.
    v7ResetInline();
    v7ShowLiveStatus(c,c.name,'Playback interrupted. Retry the same channel when ready.',false);
    toast('Playback interrupted. Retry this channel when ready.');
  }
  window.veloraChannelPlaybackLost = onPlaybackLost;

  // Only react to errors/stalls for video that was actually confirmed playing;
  // startup failures are handled by V7's normal source retry and CH tuner.
  document.addEventListener('error',e => {
    if (e.target?.id === 'inlineLive' && !e.target.classList.contains('hidden')) {
      const c = state.currentChannel;
      if (c && confirmed.has(c.id)) onPlaybackLost(c);
    }
  },true);
  document.addEventListener('waiting',e => {
    if (e.target?.id !== 'inlineLive' || e.target.classList.contains('hidden')) return;
    const c = state.currentChannel;
    if (!c || !confirmed.has(c.id) || tuning) return;
    clearTimeout(bufferTimer);
    bufferTimer = setTimeout(() => {
      if (state.currentChannel?.id === c.id && !e.target.paused &&
          e.target.readyState < 3) onPlaybackLost(c);
    },14000);
  },true);
  for (const event of ['playing','timeupdate','pause','canplay']) {
    document.addEventListener(event,e => {
      if (e.target?.id === 'inlineLive') clearTimeout(bufferTimer);
    },true);
  }

  // Explicit search remains unrestricted: selecting a named channel tells the
  // viewer if THAT channel is down, rather than silently choosing another name.
})();
