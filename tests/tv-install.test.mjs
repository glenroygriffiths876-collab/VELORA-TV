import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../tv-setup.html',import.meta.url),'utf8');
const js=fs.readFileSync(new URL('../tv-setup.js',import.meta.url),'utf8');
const lite=fs.readFileSync(new URL('../tv-lite.html',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const install=fs.readFileSync(new URL('../install.js',import.meta.url),'utf8');
const tvCss=fs.readFileSync(new URL('../tv-mode.css',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const workflow=fs.readFileSync(new URL('../.github/workflows/deploy-v4.yml',import.meta.url),'utf8');

test('TV setup guide is accessible without using bookmark menus',()=>{
  assert.match(lite,/id="tvInstallNav" href="tv-setup.html">Install on TV/);
  assert.match(index,/href="tv-setup.html">Install VELORA on a smart TV/);
  assert.match(html,/href="downloads\/VELORA-TV.apk"/);
  assert.match(html,/href="tv-lite.html\?tv=1"/);
  assert.match(html,/id="chooseAndroid"/);
  assert.match(html,/id="chooseOther"/);
  assert.match(html,/id="chooseUnknown"/);
  assert.match(html,/id="routeAndroid"/);
  assert.match(html,/id="routeOther"/);
  assert.match(html,/id="routeUnknown"/);
});
test('TV installer is available and modal can open in TV mode',()=>{
  assert.doesNotMatch(tvCss,/body\.tvMode \.installAppBtn,\s*body\.tvMode \.installModal/);
  assert.match(tvCss,/body\.tvMode \.installAppBtn\{display:flex!important/);
  assert.match(tvCss,/body\.tvMode \.installModal\.on\{display:grid!important/);
  assert.match(install,/Choose TV Installation Method/);
  assert.match(install,/tv-setup\.html/);
  assert.match(install,/\|JVC\//);
});
test('deployment includes TV setup and aligned SW shell',()=>{
  assert.match(index,/tv-mode\.css\?v=3/);
  assert.match(index,/install\.js\?v=3/);
  assert.match(sw,/velora-shell-v78/);
  assert.match(sw,/tv-setup\.html/);
  assert.match(sw,/tv-setup\.js\?v=1/);
  assert.match(workflow,/cp index\.html tv-lite\.html tv-lite\.js tv-setup\.html tv-setup\.js app\.js/);
});
test('TV setup code uses syntax supported by older smart-TV browsers',()=>{
  assert.doesNotMatch(js,/\b(?:const|let|async)\b|=>|\?\.|\?\?/);
});
function simulatedTV(ua){
 const nodes={};
 const ids=['platformHint','routeAndroid','routeOther','routeUnknown','chooseAndroid','chooseOther','chooseUnknown','backChoices','choices'];
 for(const id of ids)nodes[id]={id,className:'panel route',textContent:'',scrollIntoView(){},focus(){}};
 const doc={readyState:'complete',getElementById:id=>nodes[id]};
 const ctx={document:doc,navigator:{userAgent:ua},window:null};
 ctx.window=ctx;
 vm.runInNewContext(js,ctx);
 return nodes;
}
test('unknown JVC software is never incorrectly promised an Android APK',()=>{
 const nodes=simulatedTV('JVC TruSound Browser');
 assert.match(nodes.platformHint.textContent,/not confirmed/);
 nodes.chooseUnknown.onclick();
 assert.equal(nodes.routeUnknown.className,'panel route visible');
 assert.equal(nodes.routeAndroid.className,'panel route');
});
test('Android TV and non-Android JVC families are presented differently',()=>{
 const android=simulatedTV('Mozilla Android TV Chrome');
 assert.match(android.platformHint.textContent,/Android \/ Google TV/);
 android.chooseAndroid.onclick();
 assert.equal(android.routeAndroid.className,'panel route visible');
 const tizen=simulatedTV('JVC TV Tizen Browser');
 assert.match(tizen.platformHint.textContent,/TV-specific system/);
 tizen.chooseOther.onclick();
 assert.equal(tizen.routeOther.className,'panel route visible');
});
