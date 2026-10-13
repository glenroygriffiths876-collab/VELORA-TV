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
test('community video hints test the shared source first but retain all fallbacks and TVJ selection',()=>{
 const c={id:'jm_tvj_direct',clientUrls:['slow.m3u8','known.m3u8','alternate.m3u8']};
 const attempts=[],ctx={state:{},filteredChannels:()=>[c],V7_SELECTION_TOKEN:0,V7_SEARCH_ATTEMPTS:new Map(),
 V7_NATIVE_ATTEMPTS:new Set(),clearTimeout(){},V7_RETRY_TIMER:null,
 document:{getElementById(){return null}},drawChannelList(){},v7ResetInline(){},v7ShowLiveStatus(){},
 v7LiveCandidates:x=>x.clientUrls,veloraFastLiveUrls:()=>[],
 v7PlayLiveDirect:(_c,urls)=>attempts.push([...urls])};
 ctx.window=ctx;ctx.veloraSharedPool=new Map([[c.id,{id:c.id,sourceIndex:1,viewers:3}]]);
 vm.createContext(ctx);vm.runInContext(between(client,'selectChannel=async function','v5OpenChannel=function'),ctx);
 ctx.selectChannel(c.id);
 assert.deepEqual(attempts,[['known.m3u8','slow.m3u8','alternate.m3u8']]);
 assert.equal(ctx.state.currentChannel.id,c.id);
});
test('catalogue refresh keeps the existing live player and selection',()=>{
 let rendered=0,persisted=0,refreshed=0;const playing={id:'chosen'},video={};
 const ctx={state:{currentChannel:playing},v7LiveCandidates:()=>['playing.m3u8'],v7ProviderToLocal:x=>x,v7MediaUrl:x=>x,
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


test('late sign-in hydrates catalogue once even when startup timer also fires',async()=>{
 let resolve,calls=0,applied=0;const ctx={state:{user:null},Promise,console,
 v7Request:()=>{calls++;return new Promise(r=>resolve=r)},v7ApplySnapshot:()=>applied++};vm.createContext(ctx);
 vm.runInContext('let V7_FULL_CATALOGUE_READY=false;',ctx);
 vm.runInContext(between(client,'let V7_HYDRATE_PENDING','setTimeout(v7AutoHydrate'),ctx);
 await ctx.v7AutoHydrate();assert.equal(calls,0);
 ctx.state.user={id:'tester'};const first=ctx.v7AutoHydrate(),second=ctx.v7AutoHydrate();
 assert.equal(first,second);assert.equal(calls,1);resolve({stats:{channels:1}});await first;assert.equal(applied,1);
 const app=fs.readFileSync('app.js','utf8');assert.ok(between(app,'window.veloraEnterApp=function','window.veloraExitApp').includes('window.v7AutoHydrate?.()'));
});
test('first catalogue upgrades the selected placeholder only, preserving channel identity',()=>{
 const selected={id:'official-tvj',name:'TVJ'};const tuned=[];
 const ctx={state:{currentChannel:selected},v7ProviderToLocal:x=>x,v7MediaUrl:x=>x,
 v7LiveCandidates:c=>c.url?[c.url]:[],v7ChannelNameKey:c=>c.name.toLowerCase(),
 selectChannel:id=>tuned.push(id),persist(){},renderAll(){throw new Error('must not rebuild player')},drawChannelList(){},
 document:{getElementById:id=>id==='inlineLive'?{}:id==='view-live'?{classList:{contains:()=>true}}:null}};
 ctx.window=ctx;vm.createContext(ctx);vm.runInContext(between(client,'function v7ApplySnapshot','async function v7LoadSnapshot'),ctx);
 ctx.v7ApplySnapshot({channels:[{id:'bbc',name:'BBC',url:'bbc.m3u8'},{id:'direct-tvj',name:'TVJ',url:'tvj.m3u8'}]});assert.deepEqual(tuned,['direct-tvj']);
});

test('shared discovery excludes stale/down hints and puts fresh source first without declaring video',()=>{
 const server=fs.readFileSync('server.mjs','utf8'),now=Date.now();
 const fresh={url:'good',health:'up',lastChecked:new Date(now).toISOString(),latencyMs:100};
 const ctx={sharedVideoSnapshot:()=>[],db:{channels:[{id:'jm_tvj_direct'},{id:'good',sources:[{url:'bad',health:'down'},fresh]},
 {id:'stale',sources:[{...fresh,lastChecked:new Date(now-21*60000).toISOString()}]},
 {id:'bad',sources:[{health:'down'}]}]}};
 vm.createContext(ctx);vm.runInContext(between(server,'function discoverySnapshot','function computeStats'),ctx);
 const d=ctx.discoverySnapshot(now);assert.deepEqual(Array.from(d.channels,c=>c.id),['jm_tvj_direct','good']);
 assert.equal(d.sharedVerified.length,0);
 assert.equal(d.channels[1].sources[0].url,'good');assert.equal(d.kind,'transport-hints');
 assert.equal(d.channels[1].videoVerified,undefined);
});
test('shortlist merges without dropping search catalogue or changing current selection and ignores logout',()=>{
 const selected={id:'chosen'},ctx={state:{user:{id:1},currentChannel:selected,channels:[{id:'existing'}],catalog:[{id:'movie'}],providers:[]},
 document:{hidden:false},setInterval(){},v7ApplySnapshot(d){Object.assign(ctx.state,d)}};
 ctx.window=ctx;vm.createContext(ctx);
 vm.runInContext(between(client,'let V7_DISCOVERY_PENDING','let V7_HYDRATE_PENDING'),ctx);
 ctx.v7ApplyDiscovery({channels:[{id:'new',availability:'up'}],sharedVerified:[{id:'new',sourceIndex:0,viewers:2,lastVerifiedAt:new Date().toISOString(),recent:true}]});
 assert.deepEqual(Array.from(ctx.state.channels,c=>c.id),['existing','new']);assert.equal(ctx.state.currentChannel,selected);
 assert.equal(ctx.state.catalog[0].id,'movie');assert.ok(ctx.veloraDiscoveryHints.has('new'));
 assert.equal(ctx.veloraSharedPool.get('new').viewers,2);
 ctx.state.user=null;ctx.v7ApplyDiscovery({channels:[{id:'after-logout'}]});assert.equal(ctx.state.channels.length,2);
});
test('public startup reads avoid auth preflight while private requests retain authorization',async()=>{
 const requests=[];const ctx={localStorage:{getItem:()=> 'token'},v7Api:x=>x,fetch:async(url,opts)=>{
 requests.push({url,...opts});return {ok:true,headers:{get:()=> 'application/json'},json:async()=>({ok:true})}}};
 vm.createContext(ctx);vm.runInContext(between(client,'async function v7Request','function v7StatusBadge'),ctx);
 await ctx.v7Request('/api/catalogue');await ctx.v7Request('/api/discovery');
 await ctx.v7Request('/api/live/lineup');await ctx.v7Request('/api/private');
 assert.equal(requests[0].headers.authorization,undefined);assert.equal(requests[1].headers['content-type'],undefined);
 assert.equal(requests[2].headers.authorization,undefined);
 assert.equal(requests[2].headers['content-type'],undefined);
 assert.equal(requests[3].headers.authorization,'Bearer token');
});
test('fresh successful alternate is tried before dead primary without dropping direct device URLs',()=>{
 const ctx={v7MediaUrl:u=>u};vm.createContext(ctx);vm.runInContext(between(client,'function v7LiveCandidates','async function v7ResolveCandidates'),ctx);
 const urls=ctx.v7LiveCandidates({clientUrls:['direct'],url:'dead',sources:[{url:'good',health:'up',lastChecked:new Date().toISOString()}]});
 assert.deepEqual(Array.from(urls),['direct','good','dead']);
});

test('feed refresh retains health for identical upstreams and discards it when URL changes',()=>{
 const server=fs.readFileSync('server.mjs','utf8');
 const ctx={db:{channels:[{id:'a',name:'A',url:'same',sources:[{providerId:'p',url:'same',health:'up',lastChecked:'recent'}]},
 {id:'b',name:'B',url:'old',sources:[{providerId:'p',url:'old',health:'up',lastChecked:'recent'}]}]},channelKey:c=>c.name,scoreSource:()=>0};
 vm.createContext(ctx);vm.runInContext(between(server,'function mergeChannels','function mergeCatalog'),ctx);
 ctx.mergeChannels({id:'p'},[{id:'a',name:'A',url:'same',sources:[{providerId:'p',url:'same',health:'unknown'}]},
 {id:'b',name:'B',url:'new',sources:[{providerId:'p',url:'new',health:'unknown'}]}]);
 assert.equal(ctx.db.channels[0].sources[0].health,'up');assert.equal(ctx.db.channels[0].sources[0].lastChecked,'recent');
 assert.equal(ctx.db.channels[1].sources[0].health,'unknown');assert.equal(ctx.db.channels[1].sources[0].lastChecked,undefined);
});

test('Sci-Fi search accepts spacing, punctuation and SYFY while preserving full catalogue search',()=>{
 const rows=[{id:'syfy',name:'SYFY (720p)'},{id:'scifi',name:'SciFi (720p)'},{id:'pluto',name:'Pluto TV Sci-Fi'},{id:'science',name:'Science TV'}];
 const ctx={state:{currentFilter:'All'},filteredChannels:()=>rows,v7DefaultBrowseChannels:()=>[]};vm.createContext(ctx);
 vm.runInContext(between(client,'function v7SearchText','drawChannelList=function'),ctx);
 for(const q of ['sci fi','sci-fi','SCIFI','syfy'])assert.deepEqual(Array.from(ctx.v7LiveMatches(q),c=>c.id),['syfy','scifi','pluto']);
 assert.equal(ctx.v7LiveMatches('').length,0,'empty browse still uses verified list');
 assert.deepEqual(Array.from(ctx.v7LiveMatches('science'),c=>c.id),['science']);
});

test('server quarantine does not erase a channel from the searchable catalogue',()=>{
 const start=client.indexOf('let V7_SORTED_CHANNELS_CACHE');
 const end=client.indexOf('\n};',start)+3;
 const ctx={state:{channels:[{id:'syfy',name:'SYFY',availability:'down',lastAvailabilityCheck:new Date().toISOString()}]},V5_OFFICIAL_CHANNELS:[],
 v7ChannelNameKey:c=>c.name, v7IsPublicDirectoryItem:()=>true,rightsActive:()=>false,
 v7IsTVJ:()=>false,localStorage:{getItem:()=>null},window:{},V7_SESSION_FAILED_IDS:new Set()};
 vm.createContext(ctx);vm.runInContext(client.slice(start,end),ctx);
 assert.equal(ctx.filteredChannels()[0].id,'syfy');
});

test('merged A&E channel uses its retained ID instead of a discarded imported playback route',()=>{
 const ctx={v7MediaUrl:u=>u};vm.createContext(ctx);vm.runInContext(between(client,'function v7LiveCandidates','async function v7ResolveCandidates'),ctx);
 for(const prefix of ['', 'https://velora.example']){
  const urls=ctx.v7LiveCandidates({id:'retained',url:prefix+'/api/public/channel/discarded',upstreamUrl:'https://source.example/ae.m3u8',
   sources:[{url:'/api/public/relay?token=alternative',upstreamUrl:'https://source.example/ae.m3u8'}]});
  assert.deepEqual(Array.from(urls),[prefix+'/api/public/channel/retained']);
 }
});

test('English A&E prioritizes browser conversion without relabeling regional editions',()=>{
 const ctx={v7MediaUrl:u=>u};vm.createContext(ctx);vm.runInContext(between(client,'function v7LiveCandidates','async function v7ResolveCandidates'),ctx);
 assert.equal(ctx.v7LiveCandidates({name:'A&E (720p)',url:'raw'})[0],'/api/public/compatible/ae/index.m3u8');
 assert.deepEqual(Array.from(ctx.v7LiveCandidates({name:'A&E Latin America (1080p)',url:'regional'})),['regional']);
});

test('shared discovery with historical hints does not alter a selected channel',()=>{
 const selected={id:'chosen'},ctx={state:{user:{id:1},currentChannel:selected,channels:[{id:'old'}],catalog:[],providers:[]},
 document:{hidden:false},setInterval(){},v7ApplySnapshot(d){Object.assign(ctx.state,d)}};
 ctx.window=ctx;vm.createContext(ctx);
 vm.runInContext(between(client,'let V7_DISCOVERY_PENDING','let V7_HYDRATE_PENDING'),ctx);
 const now=new Date().toISOString();
 ctx.v7ApplyDiscovery({channels:[{id:'shared',url:'x.m3u8'}],
   sharedVerified:[{id:'shared',sourceIndex:0,lastVerifiedAt:now,recent:false,viewers:1}]});
 assert.equal(ctx.veloraSharedPool.get('shared').recent,false);
 assert.equal(ctx.state.currentChannel,selected);
});

test('shared channel history remains separate from genuinely confirmed working rows',()=>{
 const script=fs.readFileSync('ux-v18-guide.js','utf8');
 const scan=fs.readFileSync('ux-v17-quiet-scan.js','utf8');
 assert.match(script,/Previously played channels/);
 assert.match(script,/veloraStandbySection/);
 assert.match(script,/veloraVerifiedChannels\?\.history/);
 assert.match(script,/only locally confirmed video enters Working/i);
 assert.match(scan,/const HISTORY_MS=7\*24\*60\*60\*1000/);
 assert.match(scan,/return Date\.now\(\)-Number\(stored\.at\|\|0\)<FRESH_MS/);
});

test('compact channel-only lineup does not include the movie and provider catalogues',()=>{
 const source=fs.readFileSync('server.mjs','utf8');
 const ctx={db:{updatedAt:'today',channels:[{id:'tvj',url:'tvj.m3u8'}],catalog:[{id:'movie'}],providers:[{id:'private'}]}};
 vm.createContext(ctx);vm.runInContext(between(source,'function instantLineupSnapshot','function publicSnapshot'),ctx);
 const snapshot=ctx.instantLineupSnapshot();
 assert.equal(snapshot.channels.length,1);
 assert.equal(snapshot.catalog,undefined);
 assert.equal(snapshot.providers,undefined);
 assert.equal(snapshot.stats.channels,1);
 assert.match(source,/p==='\/api\/live\/lineup'/);
});
test('instant guide is a complete catalogue, not an expanded unverified Working count',()=>{
 const source=fs.readFileSync('ux-v20-instant-tv.js','utf8');
 assert.match(source,/filteredChannels\(\)/);
 assert.match(source,/all\.slice\(0,shown\)/);
 assert.match(source,/const PAGE=60/);
 assert.match(source,/Tap to try/);
 assert.match(source,/veloraVerifiedChannels\?\.ids/);
 assert.match(source,/data-channel/);
 assert.doesNotMatch(source,/window\.veloraTuneWorkingChannel\s*=/);
});

test('Instant TV starts first and defers the full catalogue until after the Live response',async()=>{
 const calls=[],timers=[];let didReplace=0;
 const ctx={state:{user:{id:'tester'}},Date,Promise,console,
   setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length},
   clearTimeout(){},
   v7Request:async(path)=>{calls.push(path);return {stats:{channels:1},channels:[{id:'tvj'}]}},
   v7ApplySnapshot:()=>{didReplace++}};
 ctx.window=ctx;
 ctx.v7FastLiveHydrate=async()=>({channels:[{id:'tvj'}]});
 vm.createContext(ctx);
 vm.runInContext('let V7_FULL_CATALOGUE_READY=false;',ctx);
 vm.runInContext(between(client,'let V7_HYDRATE_PENDING','setTimeout(v7AutoHydrate,900)'),ctx);
 await ctx.v7AutoHydrate();
 assert.equal(calls.length,0,'large VOD endpoint must not race against instant TV');
 assert.equal(didReplace,0);
 const later=timers.find(t=>t.ms===6500);
 assert.ok(later,'VOD is explicitly deferred');
 later.fn();
 for(let i=0;i<5;i++)await Promise.resolve();
 assert.deepEqual(calls,['/api/catalogue']);
 assert.equal(didReplace,1);
});
test('a failed Instant TV endpoint falls back to the full catalogue',async()=>{
 const calls=[];let applied=0;
 const ctx={state:{user:{id:'tester'}},Promise,Date,console,
   v7Request:async path=>{calls.push(path);return {stats:{channels:1}};},
   v7ApplySnapshot:()=>{applied++}};
 ctx.window=ctx;ctx.v7FastLiveHydrate=async()=>null;
 vm.createContext(ctx);
 vm.runInContext('let V7_FULL_CATALOGUE_READY=false;',ctx);
 vm.runInContext(between(client,'let V7_HYDRATE_PENDING','setTimeout(v7AutoHydrate,900)'),ctx);
 await ctx.v7AutoHydrate();
 assert.deepEqual(calls,['/api/catalogue']);assert.equal(applied,1);
});
test('frequent Live guide refreshes reuse channel sorting; new snapshots invalidate it',()=>{
 const script=fs.readFileSync('real-v7-ingest.js','utf8');
 const ctx={state:{channels:[{id:'espn',name:'ESPN'},{id:'tvj',name:'TVJ'}],history:[],territory:'JM'},
 V5_OFFICIAL_CHANNELS:[],v7IsPublicDirectoryItem:()=>true,rightsActive:()=>true,
 v7ChannelNameKey:x=>x.name.toLowerCase(),Date};
 vm.createContext(ctx);
 vm.runInContext(between(script,'let V7_SORTED_CHANNELS_CACHE','function v7CatalogueSummary'),ctx);
 const first=ctx.filteredChannels(),second=ctx.filteredChannels();
 assert.equal(first,second);assert.equal(first[0].id,'tvj');
 ctx.state.channels=[...ctx.state.channels,{id:'news',name:'News'}];
 const changed=ctx.filteredChannels();
 assert.notEqual(changed,first);assert.equal(changed.length,3);
});
