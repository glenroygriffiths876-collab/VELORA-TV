import test from 'node:test';
import assert from 'node:assert/strict';
import {recordSharedVideo,sharedVideoSnapshot,SHARED_FRESH_MS} from '../shared-video-pool.mjs';

const channel=(url='https://example.test/a.m3u8')=>({id:'scifi',name:'SciFi',sourceId:'public_series',url,
  sources:[{providerId:'public_series',url}]});
test('two profiles share real decoded-video evidence without exporting identifiers or stream URLs',()=>{
  const c=channel(),db={channels:[c]},now=Date.now();
  assert.equal(recordSharedVideo(db,c,{viewerKey:'viewer-A',sourceIndex:1,reason:'video-frame'},now),true);
  assert.equal(recordSharedVideo(db,c,{viewerKey:'viewer-B',sourceIndex:1,reason:'background-video-frame'},now+1000),true);
  const hints=sharedVideoSnapshot(db,now+2000);
  assert.equal(hints.length,1);assert.equal(hints[0].viewers,2);assert.equal(hints[0].sourceIndex,1);
  assert.equal(JSON.stringify(hints).includes('viewer-A'),false);
  assert.equal(JSON.stringify(hints).includes('example.test'),false);
});
test('HTTP probes and forged playback reasons never enter the shared pool; repeat reports are deduplicated',()=>{
  const c=channel(),db={channels:[c]},now=Date.now();
  assert.equal(recordSharedVideo(db,c,{viewerKey:'one',sourceIndex:0,reason:'probe'},now),false);
  assert.equal(recordSharedVideo(db,c,{viewerKey:'one',sourceIndex:0,reason:'video-frame'},now),true);
  assert.equal(recordSharedVideo(db,c,{viewerKey:'one',sourceIndex:0,reason:'video-frame'},now+1000),false);
  assert.equal(sharedVideoSnapshot(db,now+2000)[0].viewers,1);
  assert.equal(recordSharedVideo(db,c,{viewerKey:'one',sourceIndex:1000,reason:'video-frame'},now+3000),false);
});
test('stale reports and changed stream fingerprints expire without poisoning new catalogue data',()=>{
  const c=channel(),db={channels:[c]},now=Date.now();
  recordSharedVideo(db,c,{viewerKey:'one',sourceIndex:0,reason:'video-frame'},now);
  assert.equal(sharedVideoSnapshot(db,now+SHARED_FRESH_MS+1).length,0);
  const changed=channel('https://example.test/replaced.m3u8');
  db.channels=[changed];
  assert.equal(sharedVideoSnapshot(db,now+1000).length,0);
  recordSharedVideo(db,changed,{viewerKey:'new',sourceIndex:0,reason:'video-frame'},now+2000);
  assert.equal(sharedVideoSnapshot(db,now+3000)[0].viewers,1);
});
test('private provider reports cannot make private sources public',()=>{
  const c={...channel(),sourceId:'private_xtream'};
  const db={channels:[c]};
  assert.equal(recordSharedVideo(db,c,{viewerKey:'a',sourceIndex:0,reason:'video-frame'}),false);
  assert.equal(sharedVideoSnapshot(db).length,0);
});
