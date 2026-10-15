/* VELORA TV access bridge. ES5 syntax for older built-in TV browsers.
   Handles remote access and sign-in if the modern client is unavailable,
   without changing normal phone/desktop sign-in. */
(function () {
  'use strict';
  var backend = 'https://velora-tv-api-production.up.railway.app';
  var remoteSeen = false;
  var tvUA = /smart.?tv|hbbtv|tizen|webos|netcast|bravia|viera|roku|googletv|android[^)]*tv|aft[bstm]|jvc|television|tv.?browser/i.test(navigator.userAgent || '');
  var queryTV = /(?:[?&])tv=1(?:&|$)/.test(location.search || '');
  function tvActive() { return tvUA || queryTV || remoteSeen || window.VELORA_TV_SHELL === true; }
  function byId(id) { return document.getElementById(id); }
  function visible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    var style = window.getComputedStyle ? getComputedStyle(el) : el.currentStyle;
    if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
    var r = el.getBoundingClientRect();
    // Include off-screen buttons: TV remotes must be able to scroll to them.
    return r.width > 2 && r.height > 2 && !el.disabled;
  }
  function loginVisible() { return visible(byId('login')); }
  function activateTV() {
    if (!tvActive()) return;
    var wasActive = window.__VELORA_TV__ === true;
    window.__VELORA_TV__ = true;
    if (document.documentElement.classList) document.documentElement.classList.add('tvMode');
    if (document.body && document.body.classList) document.body.classList.add('tvMode');
    if (!wasActive) {
      try {
        var event = document.createEvent('Event');
        event.initEvent('velora-tv-activate', false, false);
        document.dispatchEvent(event);
      } catch (ignored) {}
    }
  }
  function controls() {
    var root = byId('login');
    if (!root) return [];
    var all = root.querySelectorAll('input, button, a[href]');
    var out = [];
    for (var i = 0; i < all.length; i++) if (visible(all[i])) out.push(all[i]);
    return out;
  }
  function focusOn(el) {
    if (!el) return;
    try { el.focus(); } catch (ignored) {}
    try { el.scrollIntoView(false); } catch (ignored2) {}
  }
  function focusFirst() {
    var list = controls();
    if (!list.length) return;
    if (list.indexOf(document.activeElement) >= 0) return;
    focusOn(list[0]);
  }
  function move(key) {
    var list = controls();
    if (!list.length) return;
    var current = document.activeElement;
    if (list.indexOf(current) < 0) { focusOn(list[0]); return; }
    var a = current.getBoundingClientRect();
    var ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    var best = null, score = Infinity;
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (el === current) continue;
      var b = el.getBoundingClientRect();
      var dx = b.left + b.width / 2 - ax, dy = b.top + b.height / 2 - ay;
      var p, cross;
      if (key === 'ArrowDown') { if (dy <= 4) continue; p = dy; cross = Math.abs(dx); }
      else if (key === 'ArrowUp') { if (dy >= -4) continue; p = -dy; cross = Math.abs(dx); }
      else if (key === 'ArrowRight') { if (dx <= 4) continue; p = dx; cross = Math.abs(dy); }
      else { if (dx >= -4) continue; p = -dx; cross = Math.abs(dy); }
      var s = p + 1.8 * cross + (cross > p * 2.8 ? 5000 : 0);
      if (s < score) { score = s; best = el; }
    }
    if (best) focusOn(best);
  }
  document.addEventListener('keydown', function (e) {
    var k = e.key || '';
    if (e.keyCode === 40 || k === 'Down') k = 'ArrowDown';
    if (e.keyCode === 38 || k === 'Up') k = 'ArrowUp';
    if (e.keyCode === 37 || k === 'Left') k = 'ArrowLeft';
    if (e.keyCode === 39 || k === 'Right') k = 'ArrowRight';
    if (k !== 'ArrowDown' && k !== 'ArrowUp' && k !== 'ArrowLeft' && k !== 'ArrowRight') return;
    if (!loginVisible()) return;
    remoteSeen = true;
    activateTV();
    var active = document.activeElement;
    if (active && active.tagName === 'INPUT' && (k === 'ArrowLeft' || k === 'ArrowRight')) return;
    if (e.preventDefault) e.preventDefault();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    move(k);
  }, true);
  function status(form, message) {
    var el = byId(form === 'registerForm' ? 'registerAuthStatus' : 'loginAuthStatus');
    if (!el) return;
    el.textContent = message || '';
    el.style.display = message ? 'block' : 'none';
    el.setAttribute('role', 'alert');
  }
  function setBusy(form, busy, text) {
    var btn = form.querySelector('button[type="submit"]');
    if (!btn) return;
    if (!btn.getAttribute('data-normal-label')) btn.setAttribute('data-normal-label', btn.textContent);
    btn.disabled = busy;
    btn.textContent = busy ? text : btn.getAttribute('data-normal-label');
  }
  function show(which) {
    var login = byId('loginForm'), register = byId('registerForm');
    if (!login || !register) return;
    if (which === 'register') {
      login.classList.add('hidden');
      register.classList.remove('hidden');
    } else {
      register.classList.add('hidden');
      login.classList.remove('hidden');
    }
    if (tvActive()) { activateTV(); focusOn(controls()[0]); }
  }
  document.addEventListener('click', function (e) {
    var id = e.target && e.target.id;
    if (id === 'showRegister') { show('register'); }
    if (id === 'showLogin') { show('login'); }
  }, true);
  function getStore(key) { try { return localStorage.getItem(key) || ''; } catch (ignored) { return ''; } }
  function deviceId() {
    var id = getStore('velora_client_device_id');
    if (id) return id;
    id = 'velora-tv-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1000000000).toString(36);
    try { localStorage.setItem('velora_client_device_id', id); } catch (ignored) {}
    return id;
  }
  function api(path, method, body, token, done) {
    var xhr = new XMLHttpRequest();
    var base = getStore('velora_backend_base') || backend;
    try { xhr.open(method, base.replace(/\/$/, '') + path, true); }
    catch (err) { done(new Error('Could not reach the VELORA service.')); return; }
    xhr.timeout = 20000;
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var data;
      try { data = JSON.parse(xhr.responseText || '{}'); } catch (ignored) { data = {}; }
      if (xhr.status < 200 || xhr.status >= 300) {
        done(new Error(data.error || (xhr.status ? 'Service error (' + xhr.status + ')' : 'TV browser could not connect to VELORA.')));
        return;
      }
      done(null, data);
    };
    xhr.onerror = function () { done(new Error('Network or TV browser connection error.')); };
    xhr.ontimeout = function () { done(new Error('Sign-in connection timed out. Please try again.')); };
    try {
      xhr.setRequestHeader('Content-Type', 'application/json');
      if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token);
      xhr.send(body ? JSON.stringify(body) : null);
    } catch (err2) { done(new Error('Unable to send sign-in request from this TV browser.')); }
  }
  function openCompatibleTV() {
    // Keep the same user session in same-origin storage; never put tokens into URLs.
    try { window.location.href = 'tv-lite.html?tv=1'; }
    catch (err) { status('loginForm', 'Use the TV-compatible Live TV link below to continue.'); }
  }
  function enter(data, form) {
    if (!data || !data.user || !data.token) { status(form, 'Sign-in response was incomplete.'); return; }
    try { localStorage.setItem('velora_auth_token', data.token); } catch (ignored) {}
    if (typeof window.veloraEnterApp !== 'function') {
      openCompatibleTV();
      return;
    }
    try {
      window.veloraCurrentUser = data.user;
      window.veloraEnterApp(data.user);
      if (typeof window.veloraTrack === 'function') window.veloraTrack('session_start', { view: 'home' });
    } catch (err) {
      openCompatibleTV();
    }
  }
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form || (form.id !== 'loginForm' && form.id !== 'registerForm')) return;
    // The modern client remains authoritative for ordinary phones and desktops.
    if (!tvActive() && window.VeloraAuth) return;
    e.preventDefault();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    var isReg = form.id === 'registerForm';
    var body = { deviceId: deviceId(), platform: navigator.userAgent || 'TV browser' };
    if (isReg) {
      body.name = (byId('registerName').value || '').replace(/^\s+|\s+$/g, '');
      body.username = (byId('registerUsername').value || '').replace(/^\s+|\s+$/g, '');
      body.email = (byId('registerEmail').value || '').replace(/^\s+|\s+$/g, '');
      body.password = byId('registerPassword').value || '';
    } else {
      body.identifier = (byId('loginEmail').value || '').replace(/^\s+|\s+$/g, '');
      body.password = byId('loginPassword').value || '';
    }
    status(form.id, '');
    setBusy(form, true, isReg ? 'Creating profile...' : 'Signing in...');
    api(isReg ? '/api/auth/register' : '/api/auth/login', 'POST', body, '', function (error, data) {
      setBusy(form, false);
      if (error) { status(form.id, error.message); return; }
      enter(data, form.id);
    });
  }, true);
  function restoreFallback() {
    activateTV();
    if (location.hash === '#create-profile') show('register');
    if (window.VeloraAuth) return; // modern client handles restoration
    var token = getStore('velora_auth_token');
    if (!token) { if (tvActive()) focusFirst(); return; }
    api('/api/auth/me', 'GET', null, token, function (err, data) {
      if (!err && data && data.user && typeof window.veloraEnterApp === 'function') {
        try { window.veloraCurrentUser = data.user; window.veloraEnterApp(data.user); return; } catch (ignored) {}
      }
      if (err && /Session expired/i.test(err.message)) {
        try { localStorage.removeItem('velora_auth_token'); } catch (ignored2) {}
      }
      if (tvActive()) focusFirst();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', restoreFallback);
  else restoreFallback();
})();