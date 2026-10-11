import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {EventEmitter} from 'node:events';
import {createCompatibleFeed} from '../compatible-feed.mjs';

function response(){return {destroyed:false,status:0,writeHead(s,h){this.status=s;this.headers=h},end(b){this.body=b}}}
test('A&E viewers share one H264/AAC encoder; arbitrary filenames cannot start it; idle encoder stops',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'velora-feed-test-'));let count=0,killed=0,args;
 const feed=createCompatibleFeed({root,idleMs:500,getSource:async()=> 'https://publisher.example/ae.m3u8',validateSource:async()=>{},
 spawnProcess(_command,a){count++;args=a;const child=new EventEmitter();child.stderr=new EventEmitter();
 child.kill=()=>{killed++;queueMicrotask(()=>child.emit('close'))};
 fs.writeFile(a.at(-1),'#EXTM3U\n#EXTINF:2,\nsegment-123456789abc-00000000.ts\n');return child;}});
 try{
  const invalid=response();await feed.serve({},invalid,'../../secret');assert.equal(invalid.status,404);assert.equal(count,0);
  const a=response(),b=response();await Promise.all([feed.serve({},a,'index.m3u8'),feed.serve({},b,'index.m3u8')]);
  assert.equal(count,1);assert.equal(a.status,200);assert.equal(b.status,200);
  assert.equal(args[args.indexOf('-c:v')+1],'libx264');assert.equal(args[args.indexOf('-c:a')+1],'aac');
  assert.equal(args[args.indexOf('-a53cc')+1],'1'); // Preserve in-band A/53 captions when supplied.
  assert.equal(args[args.indexOf('-threads')+1],'2');assert.ok(!args[args.indexOf('-protocol_whitelist')+1].includes('file'));
  await new Promise(r=>setTimeout(r,1050));assert.ok(killed>0);
 }finally{feed.close();await fs.rm(root,{recursive:true,force:true})}
});
test('failed A&E startup returns a retryable error and stops encoder',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'velora-feed-fail-'));let killed=0;
 const feed=createCompatibleFeed({root,startupMs:10,getSource:async()=> 'https://publisher.example/ae.m3u8',validateSource:async()=>{},
 spawnProcess(){const c=new EventEmitter();c.stderr=new EventEmitter();c.kill=()=>{killed++;queueMicrotask(()=>c.emit('close'))};return c;}});
 try{const r=response();await feed.serve({},r,'index.m3u8');assert.equal(r.status,503);assert.ok(killed>0)}
 finally{feed.close();await fs.rm(root,{recursive:true,force:true})}
});
