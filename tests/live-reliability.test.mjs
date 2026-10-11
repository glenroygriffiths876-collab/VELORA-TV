import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {EventEmitter} from 'node:events';

const source=fs.readFileSync('ux-v17-quiet-scan.js','utf8');
function harness(channels, responses={}) {
  let now=1_800_000_000_000,id=0;
  const timers=new Map(),listeners={},videos=new Set(),selections=[],attempts=[];
  const later=(fn,ms,repeat=0)=>{timers.set(++id,{at:now+ms,fn,repeat});return id};
  const storage=new Map();
  const current={id:'tvj',name:'TVJ',url:'tvj.m3u8'};
  const doc={hidden:false,body:{appendChild(v){videos.add(v)}},
    addEventListener(n,f){listeners[n]=f},getElementById(){return null},
    createElement(){return {style:{},setAttribute(){},removeAttribute(){},load(){},pause(){this.paused=true},
      remove(){videos.delete(this)},play(){this.paused=false;return Promise.resolve()},
      requestVideoFrameCallback(fn){this.frame=fn;return 1},cancelVideoFrameCallback(){this.frame=null}}}};
  class Hls {
    static isSupported(){return true} static Events={ERROR:'error',MANIFEST_PARSED:'manifest'};
    constructor(){this.events={}} on(n,f){this.events[n]=f} attachMedia(v){this.v=v}
    loadSource(url){attempts.push(url);const r=responses[url];if(!r)return;
      this.timer=later(()=>{if(r.error){this.events.error?.(null,{fatal:true});return}
        Object.assign(this.v,{videoWidth:640,videoHeight:360,readyState:3,currentTime:1,paused:false});this.v.frame?.();},r.delay||5000)}
    destroy(){timers.delete(this.timer)}
  }
  class Clock extends Date {static now(){return now}}
  const context={Date:Clock,Map,Set,Promise,Math,JSON,Number,String,Array,Hls,navigator:{onLine:true},
    document:doc,localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},
    state:{currentChannel:current},V7_SESSION_FAILED_IDS:new Set(),
    filteredChannels:()=>[current,...channels],v7LiveCandidates:c=>c.urls||[c.url],v7IsTVJ:c=>c.id==='tvj',
    v7ReportPlayback(){},selectChannel(id){selections.push(id);context.state.currentChannel=channels.find(c=>c.id===id)||current},
    drawChannelList(){},toast(){},setTimeout:(f,m)=>later(f,m),setInterval:(f,m)=>later(f,m,m),
    clearTimeout:i=>timers.delete(i),clearInterval:i=>timers.delete(i),addEventListener(){}};
  context.window=context;vm.createContext(context);vm.runInContext(source,context);
  async function tick(ms){const end=now+ms;for(let guard=0;guard<100000;guard++){
    await Promise.resolve();await Promise.resolve();
    const next=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];
    if(!next){now=end;await Promise.resolve();break}
    const [key,t]=next;now=t.at;timers.delete(key);if(t.repeat)timers.set(key,{...t,at:now+t.repeat});t.fn();
  }}
  return {context,tick,listeners,videos,selections,attempts,api:context.veloraVerifiedChannels};
}

test('video arriving after five seconds verifies without changing selected TVJ',async()=>{
 const c={id:'slow',url:'slow.m3u8'};const h=harness([c],{'slow.m3u8':{delay:5000}});
 await h.tick(7000);assert.deepEqual([...h.api.ids()],['slow']);assert.equal(h.api.scanStatus().checked,1);
 assert.equal(h.context.state.currentChannel.id,'tvj');assert.deepEqual(h.selections,[]);assert.equal(h.videos.size,0);
});
test('HTTP/source metadata never substitutes for decoded video',async()=>{
 const h=harness([{id:'audio',url:'audio.m3u8',availability:'up'}]);await h.tick(18000);
 assert.equal(h.api.count(),0);assert.equal(h.api.scanStatus().outcomes.timeout,1);
});
test('backgrounding cancels probes without counting or blocking the channel',async()=>{
 const h=harness([{id:'slow',url:'slow.m3u8'}],{'slow.m3u8':{delay:5000}});
 await h.tick(2000);h.context.document.hidden=true;h.listeners.visibilitychange();await h.tick(100);
 assert.equal(h.videos.size,0);assert.equal(h.api.scanStatus().checked,0);
 h.context.document.hidden=false;h.listeners.visibilitychange();await h.tick(7000);assert.equal(h.api.count(),1);
});
test('third source is tried on later round instead of ignored forever',async()=>{
 const h=harness([{id:'alt',urls:['one.m3u8','two.m3u8','three.m3u8']}],{'three.m3u8':{delay:5000}});
 await h.tick(120000);assert.equal(h.api.count(),1);assert.ok(h.attempts.includes('three.m3u8'));
});
test('repeated failures enter visible recovery and retain the selected channel',async()=>{
 const rows=Array.from({length:30},(_,i)=>({id:'bad'+i,url:'bad'+i+'.m3u8'}));
 const replies=Object.fromEntries(rows.map(c=>[c.url,{error:true,delay:10}]));
 const h=harness(rows,replies);await h.tick(3000);assert.equal(h.api.scanStatus().recovering,true);
 assert.ok(h.api.scanStatus().checked<30);assert.deepEqual(h.selections,[]);
 const firstRound=h.api.scanStatus().checked;await h.tick(70000);
 assert.ok(h.api.scanStatus().checked>=firstRound+12,'recovery resumes a batch, not one failed probe per minute');
});
test('a background recheck timeout retains a previously verified channel',async()=>{
 const c={id:'saved',url:'saved.m3u8'};const h=harness([c]);h.context.v7ReportPlayback(c,c.url,true);
 await h.tick(4*3600000+30000);assert.equal(h.api.count(),1);
});
test('fresh video clears historical session failure; remote uses verified channels only',async()=>{
 const good={id:'good',url:'good.m3u8'},bad={id:'bad',url:'bad.m3u8'};const h=harness([good,bad]);
 h.context.V7_SESSION_FAILED_IDS.add('good');h.context.v7ReportPlayback(good,good.url,true);
 assert.equal(h.api.count(),1);h.context.veloraTuneWorkingChannel(1);assert.deepEqual(h.selections,['good']);
 h.context.veloraTuneWorkingChannel(1);assert.deepEqual(h.selections,['good']);
});

test('relay survives completed request and aborts only unfinished response disconnect',async()=>{
 const text=fs.readFileSync('server.mjs','utf8');
 const fn=text.slice(text.indexOf('async function relayPublicUrl('),text.indexOf('const PUBLIC_DISCOVERY_INDEXES'));
 for(const disconnect of [false,true]){
  const req=new EventEmitter();req.headers={};const res=new EventEmitter();res.writableFinished=false;
  let signal,release;const started=new Promise(r=>release=r);
  res.writeHead=()=>{};res.end=()=>{res.writableFinished=true};
  const c={AbortController,Buffer,assertSafeUrl:async()=>{},rewriteHls:b=>b,
   fetch:async(_url,opts)=>{signal=opts.signal;release();await new Promise(r=>setImmediate(r));
    assert.equal(signal.aborted,disconnect);return {status:200,url:'https://example.com/a.m3u8',headers:new Headers({'content-type':'application/vnd.apple.mpegurl'}),text:async()=>'#EXTM3U'};}};
  vm.createContext(c);vm.runInContext(fn,c);const pending=c.relayPublicUrl(req,res,'https://example.com/a.m3u8');
  await started;req.emit('close');assert.equal(signal.aborted,false);if(disconnect)res.emit('close');await pending;
 }
});
