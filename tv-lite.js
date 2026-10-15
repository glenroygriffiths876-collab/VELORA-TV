/* VELORA Lite: ES5-only, standalone smart-TV browser fallback.
 * Shared accounts and authorized channel lineup; never promises video codec support.
 */
(function () {
  'use strict';
  var DEFAULT_BACKEND = 'https://velora-tv-api-production.up.railway.app';
  var TOKEN_KEY = 'velora_auth_token';
  var token = '';
  var channels = [];
  var filtered = [];
  var chosen = null;
  var sourceList = [];
  var sourceIndex = -1;
  var lastSource = '';
  var hasVideo = false;
  var pendingTimer = 0;
  var showing = 60;
  var authBusy = false;
  function el(id) { return document.getElementById(id); }
  function storeGet(k) { try { return localStorage.getItem(k) || ''; } catch (ignore) { return ''; } }
  function storeSet(k,v) { try { localStorage.setItem(k,v); return true; } catch (ignore) { return false; } }
  function storeDelete(k) { try { localStorage.removeItem(k); } catch (ignore) {} }
  function base() { return (storeGet('velora_backend_base') || DEFAULT_BACKEND).replace(/\/$/, ''); }
  function apiPath(url) {
    if (!url) return '';
    if (url.charAt(0) === '/' && url.indexOf('/api/') === 0) return base() + url;
    return /^https?:\/\//i.test(url) ? url : '';
  }
  function text(id, value) { var node = el(id); if (node) node.textContent = value; }
  function display(id, yes) { var node = el(id); if (node) node.style.display = yes ? 'block' : 'none'; }
  function msg(id,value,error) {
    var node = el(id);
    if (!node) return;
    node.textContent = value;
    node.className = 'notice' + (error ? ' error' : '');
  }
  function request(method,path,body,bearer,done) {
    var xhr = new XMLHttpRequest(), finished = false;
    function finish(err,value) { if (finished) return; finished = true; done(err,value); }
    try {
      xhr.open(method,base() + path,true);
      xhr.timeout = 25000;
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return;
        var reply = {};
        try { reply = JSON.parse(xhr.responseText || '{}'); } catch (ignore) {}
        if (xhr.status < 200 || xhr.status >= 300)
          return finish(new Error(reply.error || (xhr.status ? 'Service error ' + xhr.status : 'Cannot connect to the VELORA backend.')));
        finish(null,reply);
      };
      xhr.onerror = function () { finish(new Error('The TV could not connect to VELORA.')); };
      xhr.ontimeout = function () { finish(new Error('The connection timed out. Please retry.')); };
      if (method !== 'GET') xhr.setRequestHeader('Content-Type','application/json');
      if (bearer) xhr.setRequestHeader('Authorization','Bearer ' + bearer);
      xhr.send(body ? JSON.stringify(body) : null);
    } catch (error) { finish(new Error('TV network request failed.')); }
  }
  function deviceId() {
    var old = storeGet('velora_client_device_id');
    if (old) return old;
    old = 'velora-lite-' + (new Date()).getTime() + '-' + Math.floor(Math.random() * 9999999);
    storeSet('velora_client_device_id',old);
    return old;
  }
  function setBusy(form, value) {
    authBusy = value;
    var b = form.querySelector('button[type="submit"]');
    if (b) b.disabled = value;
  }
  function authMode(register) {
    el('registration').className = register ? 'visible' : '';
    display('loginFormLite',!register);
    msg('authStatus',register ? 'Create your personal VELORA profile.' : 'Ready to sign in.',false);
    setTimeout(function () { try { el(register?'regName':'loginIdentity').focus(); } catch (ignore) {} },60);
  }
  function showLogin() {
    display('viewer',false);
    display('auth',true);
    authMode(false);
  }
  function enter(user,newToken) {
    token = newToken;
    storeSet(TOKEN_KEY,token);
    display('auth',false);
    el('viewer').className = 'visible';
    text('viewerName',user.name || user.username || 'Viewer');
    msg('playStatus','Select Play to watch. Unsupported TV formats will be reported.',false);
    loadChannels();
  }
  function signIn(e,register) {
    if (e && e.preventDefault) e.preventDefault();
    if (authBusy) return false;
    var form = el(register?'registration':'loginFormLite');
    var data = {deviceId:deviceId(),platform:navigator.userAgent || 'TV browser'};
    if (register) {
      data.name = el('regName').value.replace(/^\s+|\s+$/g,'');
      data.username = el('regUser').value.replace(/^\s+|\s+$/g,'');
      data.email = el('regEmail').value.replace(/^\s+|\s+$/g,'');
      data.password = el('regPass').value;
      if (data.password.length < 8) { msg('authStatus','Password must be at least 8 characters.',true);return false; }
    } else {
      data.identifier = el('loginIdentity').value.replace(/^\s+|\s+$/g,'');
      data.password = el('loginPass').value;
    }
    setBusy(form,true);
    msg('authStatus',register?'Creating your profile...':'Signing in...',false);
    request('POST',register?'/api/auth/register':'/api/auth/login',data,'',function (err,result) {
      setBusy(form,false);
      if (err) { msg('authStatus',err.message,true);return; }
      if (!result.user || !result.token) { msg('authStatus','Incomplete response from VELORA.',true);return; }
      enter(result.user,result.token);
    });
    return false;
  }
  function logout() {
    var old = token;
    token = '';
    storeDelete(TOKEN_KEY);
    clearTimeout(pendingTimer);
    try { el('tvVideo').pause(); el('tvVideo').removeAttribute('src'); } catch (ignore) {}
    request('POST','/api/auth/logout',{},old,function () {});
    showLogin();
  }
  function tvj(ch) {
    return ch.id === 'jm_tvj_direct' || /^tvj(?:\s+television)?$/i.test(ch.name||'');
  }
  function sortChannels(data) {
    var list = data.slice(0);
    list.sort(function (a,b) {
      var at = tvj(a)?0:1, bt = tvj(b)?0:1;
      return at === bt ? 0 : at-bt;
    });
    return list;
  }
  function loadChannels() {
    text('catalogueStatus','Loading live channels...');
    request('GET','/api/live/lineup',null,'',function (err,result) {
      if (!token) return;
      if (err || !result.channels || !result.channels.length) {
        text('catalogueStatus',err ? err.message : 'No channels were returned. Try again later.');
        return;
      }
      channels = sortChannels(result.channels);
      showing = 60;
      text('catalogueStatus',channels.length + ' channels in the directory. Availability is confirmed by playback on this TV.');
      renderChannels();
      if (!chosen) selectChannel(channels[0],false);
      else {
        for (var i=0;i<channels.length;i++) if (channels[i].id === chosen.id) {
          chosen = channels[i];
          break;
        }
      }
    });
  }
  function channelLabel(ch) { return String(ch.name || ch.title || 'Unnamed channel'); }
  function renderChannels() {
    var q = String(el('searchChannels').value || '').toLowerCase().replace(/^\s+|\s+$/g,'');
    filtered = [];
    for (var i=0;i<channels.length;i++) {
      var ch = channels[i];
      if (!q || (channelLabel(ch)+' '+String(ch.group||'')).toLowerCase().indexOf(q)>=0) filtered.push(ch);
    }
    text('channelCount',filtered.length+' matching channels');
    var list = el('channelList');
    while (list.firstChild) list.removeChild(list.firstChild);
    var count = Math.min(showing,filtered.length);
    for (var j=0;j<count;j++) {
      var channel = filtered[j];
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'channel'+(chosen && channel.id === chosen.id?' selected':'');
      b.setAttribute('data-id',String(channel.id));
      b.appendChild(document.createTextNode(channelLabel(channel)));
      var small = document.createElement('small');
      small.appendChild(document.createTextNode(channel.group || 'Live TV'));
      b.appendChild(small);
      b.onclick = function () {
        var id = this.getAttribute('data-id');
        for (var a=0;a<channels.length;a++) if(String(channels[a].id)===id) {
          selectChannel(channels[a],true);
          break;
        }
      };
      list.appendChild(b);
    }
    display('showMore',filtered.length>count);
    text('showMore','Show more ('+count+' of '+filtered.length+')');
  }
  function playableCandidates(ch) {
    var all = [], unique = {};
    function add(url) {
      url = apiPath(String(url||''));
      if (!url || unique[url]) return;
      unique[url] = true; all.push(url);
    }
    // Prefer Velora's own relay URLs before upstream direct links.
    add(ch.url);
    var sources = ch.sources || [];
    for (var i=0;i<sources.length;i++) add(sources[i].url);
    add(ch.upstreamUrl);
    var extra = ch.clientUrls || [];
    for (var j=0;j<extra.length;j++) add(extra[j]);
    return all;
  }
  function selectChannel(ch,playNow) {
    if (!ch) return;
    chosen = ch;
    sourceList = playableCandidates(ch);
    sourceIndex = -1;
    hasVideo = false;
    clearTimeout(pendingTimer);
    try { el('tvVideo').pause(); el('tvVideo').removeAttribute('src'); el('tvVideo').load(); } catch (ignore) {}
    text('nowPlaying',channelLabel(ch));
    text('sourceInfo',sourceList.length + ' stream source(s). Select Play to test this TV\'s video decoder.');
    msg('playStatus',sourceList.length ? 'Select Play to watch ' + channelLabel(ch) + '.' : 'No direct stream is available for this channel.',!sourceList.length);
    var official = apiPath(ch.watchUrl);
    if (official) { el('officialLink').href = official; el('officialLink').className='btn secondary visible'; }
    else el('officialLink').className='btn secondary';
    el('playerArea').className = 'panel playerpanel visible';
    renderChannels();
    if (playNow) startNextSource();
  }
  function startNextSource() {
    if (!chosen) return;
    clearTimeout(pendingTimer);
    hasVideo = false;
    sourceIndex++;
    if (sourceIndex >= sourceList.length) {
      msg('playStatus','No source produced playable video. This TV browser may not support the channel format or source. Try another channel, or an Android TV streaming device.',true);
      text('sourceInfo','Selected channel: '+channelLabel(chosen)+'. No automatic channel switching.');
      return;
    }
    lastSource = sourceList[sourceIndex];
    var video = el('tvVideo');
    try { video.pause(); video.src = lastSource; video.load(); } catch (ignore) {}
    text('sourceInfo','Testing source '+(sourceIndex+1)+' of '+sourceList.length);
    msg('playStatus','Connecting to '+channelLabel(chosen)+'... Press Play if your TV blocks autoplay.',false);
    try {
      var promise = video.play();
      if (promise && promise['catch']) promise['catch'](function () {
        msg('playStatus','Press Play on the video controls if your TV requires a remote gesture.',false);
      });
    } catch (ignore2) {}
    // A slow or unsupported stream should not leave an endless spinner.
    pendingTimer = setTimeout(function () {
      if (!hasVideo && chosen) startNextSource();
    },18000);
  }
  function onVideoPlaying() {
    clearTimeout(pendingTimer);
    hasVideo = true;
    var v = el('tvVideo');
    if (v.videoWidth > 0 && v.videoHeight > 0)
      msg('playStatus','Playing '+channelLabel(chosen)+' on this TV.',false);
    else
      msg('playStatus','Audio may be playing, but this TV has not confirmed video decoding. Try next source if the screen stays black.',true);
  }
  function onVideoError() {
    if (!chosen || sourceIndex<0) return;
    clearTimeout(pendingTimer);
    startNextSource();
  }
  function fullscreen() {
    var v = el('tvVideo');
    try {
      if (v.requestFullscreen) v.requestFullscreen();
      else if (v.webkitEnterFullscreen) v.webkitEnterFullscreen();
      else if (v.webkitRequestFullscreen) v.webkitRequestFullscreen();
      else msg('playStatus','Fullscreen is controlled by your TV browser.',false);
    } catch (ignore) { msg('playStatus','Fullscreen is not supported by this TV browser.',true); }
  }
  function remoteKeys(e) {
    var key = e.key || '';
    if (e.keyCode === 40 || key === 'Down') key = 'ArrowDown';
    if (e.keyCode === 38 || key === 'Up') key = 'ArrowUp';
    if (e.keyCode === 13 && !key) key = 'Enter';
    if (key !== 'ArrowDown' && key !== 'ArrowUp') return;
    if (document.activeElement && /^(input|textarea|select)$/i.test(document.activeElement.tagName)) return;
    var controls = document.querySelectorAll('input,button,a[href]');
    var items = [];
    for (var i=0;i<controls.length;i++) {
      var c = controls[i];
      var style = window.getComputedStyle ? getComputedStyle(c) : c.currentStyle;
      if (!c.disabled && (!style || style.display !== 'none') && c.offsetWidth !== 0 && c.offsetHeight !== 0) items.push(c);
    }
    var n = -1;
    for (var j=0;j<items.length;j++) if (items[j] === document.activeElement) { n=j;break; }
    var target = key==='ArrowDown' ? n+1 : n-1;
    if (n<0) target=0;
    if (target < 0 || target>=items.length) return;
    if (e.preventDefault) e.preventDefault();
    items[target].focus();
    try { items[target].scrollIntoView(false); } catch (ignore) {}
  }
  function init() {
    el('showRegistration').onclick = function () { authMode(true); };
    el('backLogin').onclick = function () { authMode(false); };
    el('loginFormLite').onsubmit = function (e) { return signIn(e,false); };
    el('registration').onsubmit = function (e) { return signIn(e,true); };
    el('signOut').onclick=logout;
    el('showMore').onclick=function(){showing+=60;renderChannels();};
    el('searchChannels').onkeyup=function(){showing=60;renderChannels();};
    el('tvPlay').onclick = function () {
      if (!chosen) return;
      if (sourceIndex<0) startNextSource();
      else {
        try { el('tvVideo').play(); } catch (ignore) {}
      }
    };
    el('trySource').onclick=startNextSource;
    el('tvFull').onclick=fullscreen;
    el('tvVideo').addEventListener('playing',onVideoPlaying,false);
    el('tvVideo').addEventListener('error',onVideoError,false);
    document.addEventListener('keydown',remoteKeys,false);
    token = storeGet(TOKEN_KEY);
    if (!token) { showLogin(); return; }
    msg('authStatus','Restoring your profile...',false);
    request('GET','/api/auth/me',null,token,function (err,result) {
      if (!err && result && result.user) enter(result.user,token);
      else { if (err && /expired/i.test(err.message)) storeDelete(TOKEN_KEY); showLogin(); }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init,false);
  else init();
})();
