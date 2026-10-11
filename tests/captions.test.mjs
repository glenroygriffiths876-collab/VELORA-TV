import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const code=readFileSync('velora-captions.js','utf8');
function harness(){
  const nodes={
    button:{classList:{toggle(){}},setAttribute(){}},
    menu:{hidden:true,children:[],replaceChildren(){this.children=[]},appendChild(el){this.children.push(el)},querySelector(){return {focus(){}}}}
  };
  const document={
    querySelector:q=>q==='[data-v15-control="cc"]'?nodes.button:null,
    getElementById:id=>id==='veloraCcMenu'?nodes.menu:null,
    createElement:tag=>({tagName:tag,dataset:{},className:'',classList:{add(){}},setAttribute(){},textContent:''}),
    addEventListener(){}
  };
  const prefs=new Map();
  const localStorage={getItem:k=>prefs.get(k)||null,setItem:(k,v)=>prefs.set(k,v)};
  const window={};
  const ctx={window,document,localStorage,JSON,String,Number,Array};
  vm.runInNewContext(code,ctx);
  return {api:window.veloraCaptions,nodes};
}
function video(){
  const events={};
  const tracks=[];
  tracks.addEventListener=(name,fn)=>events[name]=fn;
  tracks.removeEventListener=name=>delete events[name];
  return {textTracks:tracks,addEventListener(name,fn){events[name]=fn},removeEventListener(name){delete events[name]},fire:name=>events[name]?.()};
}
test('closed captions can appear after stream starts, be selected, and switched off',()=>{
  const {api,nodes}=harness();
  const v=video();
  api.attach(v);
  assert.equal(api.available().length,0);
  api.toggle();
  assert.match(nodes.menu.children.at(-1).textContent,/Checking/);
  v.textTracks.push({kind:'captions',label:'English CC',language:'en',mode:'disabled'});
  v.fire('addtrack');
  assert.equal(api.available().length,1);
  assert.equal(api.choose('native',0),true);
  assert.equal(v.textTracks[0].mode,'showing');
  assert.equal(api.choose('off'),true);
  assert.equal(v.textTracks[0].mode,'disabled');
  // A late in-band caption should remain off until the viewer explicitly enables it.
  v.textTracks.push({kind:'captions',label:'Spanish CC',language:'es',mode:'showing'});
  v.fire('addtrack');
  assert.equal(v.textTracks[1].mode,'disabled');
});
test('HLS subtitle language selection survives a channel switch without keeping stale tracks',()=>{
  const {api}=harness();
  const v=video(),handlers={};
  const hls={subtitleTracks:[{name:'English',lang:'en'},{name:'Español',lang:'es'}],subtitleDisplay:false,subtitleTrack:-1,
    on(name,fn){handlers[name]=fn},off(name){delete handlers[name]}};
  api.attach(v,hls);
  assert.equal(api.available().length,2);
  assert.equal(api.choose('hls',1),true);
  assert.equal(hls.subtitleTrack,1);
  assert.equal(hls.subtitleDisplay,true);
  api.reset();
  assert.equal(api.available().length,0);
  assert.equal(hls.subtitleDisplay,true); // Decoder teardown, not a new selection.
  const next=video();
  next.textTracks.push({kind:'captions',label:'Spanish CC',language:'es',mode:'disabled'});
  api.attach(next);
  assert.equal(next.textTracks[0].mode,'showing');
});
test('live controller and A&E pipeline are wired to browser and native captions',()=>{
  const html=readFileSync('index.html','utf8');
  const v15=readFileSync('ux-v15.js','utf8');
  const v7=readFileSync('real-v7-ingest.js','utf8');
  const sw=readFileSync('sw.js','utf8');
  assert.match(v15,/data-v15-control="cc"/);
  assert.match(v15,/veloraCaptions\?\.toggle/);
  assert.match(v7,/veloraCaptions\?\.attach/);
  assert.match(html,/velora-captions\.js\?v=2/);
  assert.match(sw,/velora-captions\.css\?v=2/);
});

test('guide identifies the French SciFi edition, without guessing all channel audio languages',()=>{
  const {api,nodes}=harness();
  assert.equal(api.edition({epgId:'SciFi.fr@HD'}),'French edition');
  assert.equal(api.edition({epgId:'SYFY.us@East'}),'');
  api.setChannel({name:'SciFi (720p)',epgId:'SciFi.fr@HD'});
  api.toggle();
  assert.ok(nodes.menu.children.some(x=>String(x.textContent).includes('French edition')));
  assert.ok(nodes.menu.children.some(x=>String(x.textContent).includes('no selectable alternative audio')));
});
test('HLS prefers offered English audio and respects manual language selection',()=>{
  const {api}=harness();
  const v=video();
  const hls={
    audioTracks:[{name:'Français',lang:'fr'},{name:'English',lang:'en'}],
    audioTrack:0, subtitleTracks:[],
    on(){},off(){}
  };
  api.attach(v,hls);
  assert.equal(hls.audioTrack,1);
  assert.equal(api.selectAudio(api.audioOptions()[0],true),true);
  assert.equal(hls.audioTrack,0);
  api.refresh();
  assert.equal(hls.audioTrack,0);
  api.reset();
  const next={audioTracks:[{name:'Deutsch',lang:'de'},{name:'Français',lang:'fr'}],audioTrack:0,subtitleTracks:[],on(){},off(){}};
  api.attach(video(),next);
  assert.equal(next.audioTrack,1); // Explicitly preferred French survives channel changes.
});
test('English preference never fabricates missing tracks or captions',()=>{
  const {api,nodes}=harness();
  const hls={audioTracks:[{name:'Français',lang:'fr'}],audioTrack:0,subtitleTracks:[],on(){},off(){}};
  api.attach(video(),hls);
  assert.equal(hls.audioTrack,0);
  assert.equal(api.available().length,0);
  api.toggle();
  assert.ok(nodes.menu.children.some(x=>String(x.textContent).includes('No subtitles supplied')));
});
