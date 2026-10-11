import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {gzip,gunzipSync} from 'node:zlib';
import {promisify} from 'node:util';
const client=fs.readFileSync('real-v7-ingest.js','utf8');
const between=(text,start,end)=>text.slice(text.indexOf(start),text.indexOf(end,text.indexOf(start)));

test('channel selection begins local playback without awaiting a source search',async()=>{
 const selected={id:'jm_tvj_direct',clientUrls:['https://example.com/tvj.m3u8']};let resolverCalls=0,started=[];
 const ctx={state:{},filteredChannels:()=>[selected],V7_SELECTION_TOKEN:0,V7_SEARCH_ATTEMPTS:new Map(),V7_NATIVE_ATTEMPTS:new Set(),
  V7_RETRY_TIMER:null,clearTimeout(){},document:{getElementById(){return null}},drawChannelList(){},v7ResetInline(){},v7ShowLiveStatus(){},
  v7LiveCandidates:c=>c.clientUrls,v7PlayLiveDirect:(c,urls)=>started.push({id:c.id,urls}),v7ResolveCandidates:()=>{resolverCalls++;return new Promise(()=>{})}};
 ctx.window=ctx;vm.createContext(ctx);vm.runInContext(between(client,'selectChannel=async function','v5OpenChannel=function'),ctx);
 const result=ctx.selectChannel(selected.id);assert.equal(started.length,1,'stream begins in same turn as selection');
 assert.equal(resolverCalls,0);await result;assert.equal(ctx.state.currentChannel.id,selected.id);
});
test('catalogue refresh keeps the existing live player and selection',()=>{
 let rendered=0,persisted=0,refreshed=0;const playing={id:'chosen'},video={};
 const ctx={state:{currentChannel:playing},v7ProviderToLocal:x=>x,v7MediaUrl:x=>x,
  persist(){persisted++},renderAll(){rendered++},drawChannelList(){refreshed++},
  document:{getElementById:id=>id==='inlineLive'?video:id==='view-live'?{classList:{contains:()=>true}}:null}};
 ctx.window=ctx;vm.createContext(ctx);vm.runInContext(between(client,'function v7ApplySnapshot','async function v7LoadSnapshot'),ctx);
 ctx.v7ApplySnapshot({channels:[{id:'new'}]});assert.equal(rendered,0);assert.equal(persisted,1);assert.equal(refreshed,1);
 assert.equal(ctx.state.currentChannel,playing);assert.equal(ctx.document.getElementById('inlineLive'),video);
});

test('saved channel gets time to decode and cancelled frame callbacks cannot verify another selection',()=>{
 let now=0,next=0;const timers=new Map(),reports=[];let frame;
 const later=(fn,ms)=>{timers.set(++next,{at:now+ms,fn});return next};
 const tick=ms=>{const end=now+ms;while(true){const pair=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!pair)break;now=pair[1].at;timers.delete(pair[0]);pair[1].fn()}now=end};
 const classes=new Set(['hidden']);const video={classList:{add:k=>classes.add(k),remove:k=>classes.delete(k)},
   pause(){},removeAttribute(){},load(){},requestVideoFrameCallback(fn){frame=fn;return 1},cancelVideoFrameCallback(){}};
 const panel={classList:{add(){}}};let ctx;
 class Hls{static isSupported(){return true}static Events={ERROR:'error',MANIFEST_PARSED:'manifest'};
  constructor(){this.callbacks={}}on(n,f){this.callbacks[n]=f}loadSource(){}attachMedia(){later(()=>{video.onloadedmetadata();this.callbacks.manifest?.()},100)}destroy(){}}
 ctx={Hls,state:{},V7_SELECTION_TOKEN:1,V7_SESSION_FAILED_IDS:new Set(),
  document:{getElementById:id=>id==='inlineLive'?video:panel},setTimeout:later,clearTimeout:id=>timers.delete(id),
  v7ResetInline(){ctx.veloraCancelLiveAttempt?.()},v7ShowLiveStatus(){},v7StartPlayback:async()=>true,
  v7ReportPlayback:(c,u,ok)=>reports.push({id:c.id,ok}),v7RecoverLiveSources(){throw new Error('premature recovery')},
  v7TryNativePlayer:()=>false,veloraFastLiveUrls:()=>['saved.m3u8']};ctx.window=ctx;vm.createContext(ctx);
 vm.runInContext(between(client,'function v7PlayLiveDirect','selectChannel=async function'),ctx);
 ctx.v7PlayLiveDirect({id:'saved'},['saved.m3u8']);assert.equal(classes.has('hidden'),false);
 tick(5000);Object.assign(video,{videoWidth:640,videoHeight:360});frame();assert.deepEqual(reports,[{id:'saved',ok:true}]);
 ctx.v7PlayLiveDirect({id:'old'},['old.m3u8']);tick(200);const staleFrame=frame;
 ctx.V7_SELECTION_TOKEN++;ctx.v7ResetInline();staleFrame();assert.equal(reports.length,1);
});

test('catalogue gzip preserves every record, reduces bytes, and honors clients declining gzip',async()=>{
 const server=fs.readFileSync('server.mjs','utf8');const ctx={gzipAsync:promisify(gzip)};vm.createContext(ctx);
 vm.runInContext(between(server,'async function sendCatalogue','function publicSnapshot'),ctx);
 const snapshot={channels:Array.from({length:100},(_,id)=>({id,name:'Test channel',url:'/api/public/channel/'+id}))};
 for(const encoding of ['gzip','gzip;q=0','identity']){
  let headers,body;const res={writeHead(_status,h){headers=h},end(b){body=b}};
  await ctx.sendCatalogue({headers:{'accept-encoding':encoding}},res,snapshot);
  if(encoding==='gzip'){assert.equal(headers['content-encoding'],'gzip');assert.ok(body.length<JSON.stringify(snapshot).length/2);body=gunzipSync(body).toString()}
  else assert.equal(headers['content-encoding'],undefined);
  assert.deepEqual(JSON.parse(body),{ok:true,...snapshot});
 }
});


test('duplicate relay routes are tried once while distinct sources and Jamaica direct playback remain',()=>{
 const ctx={v7MediaUrl:u=>u};vm.createContext(ctx);
 vm.runInContext(between(client,'function v7LiveCandidates','async function v7ResolveCandidates'),ctx);
 const upstream='https://publisher.example/live.m3u8';
 const urls=ctx.v7LiveCandidates({clientUrls:[upstream],url:'/api/public/channel/one',upstreamUrl:upstream,
   sources:[{url:'/api/public/relay?token=one',upstreamUrl:upstream},{url:'/api/public/relay?token=two',upstreamUrl:'https://other.example/live.m3u8'}]});
 assert.deepEqual([...urls],[upstream,'/api/public/channel/one','/api/public/relay?token=two']);
});
