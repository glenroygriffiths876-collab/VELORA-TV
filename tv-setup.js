/* VELORA remote-friendly TV setup (legacy ES5 syntax; no modern app dependencies). */
(function () {
  'use strict';
  function get(id) { return document.getElementById(id); }
  var routeIds = ['routeAndroid','routeOther','routeUnknown'];
  function show(id) {
    for (var i=0;i<routeIds.length;i++) {
      var node=get(routeIds[i]);
      if (!node) continue;
      node.className = 'panel route' + (routeIds[i]===id?' visible':'');
    }
    var target=get(id);
    if (target) {
      try { target.scrollIntoView(true); } catch (ignore) {}
    }
  }
  function detect() {
    var ua = navigator.userAgent || '';
    var androidTV = /Android TV|GoogleTV|Google TV|BRAVIA|SHIELD|MiTV|MiBOX|Chromecast|ADT-/i.test(ua);
    var fire = /AFT|FireTV|Fire TV|Silk\//i.test(ua);
    var nonAndroid = /Tizen|SMART-TV|SmartTV|Web0S|WebOS|webOS|NetCast|VIDAA|HisenseBrowser|Roku|DVP-/i.test(ua);
    var hint = get('platformHint');
    if (!hint) return;
    if (androidTV || fire) {
      hint.textContent = 'This browser appears to be on ' + (fire?'Fire TV':'Android / Google TV') + '. You can try the Android TV app option below.';
    } else if (nonAndroid) {
      hint.textContent = 'This browser appears to use a TV-specific system. An Android APK may not install. Choose the other TV system option.';
    } else {
      hint.textContent = 'TV system not confirmed. Choose an option below—JVC TruSound alone does not identify the TV software.';
    }
  }
  function init() {
    detect();
    get('chooseAndroid').onclick = function () {show('routeAndroid');};
    get('chooseOther').onclick = function () {show('routeOther');};
    get('chooseUnknown').onclick = function () {show('routeUnknown');};
    get('backChoices').onclick = function () {
      show('');
      try {get('chooseAndroid').focus();get('choices').scrollIntoView(true);} catch (ignore) {}
    };
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,false);
  else init();
})();