// A cross-profile *hint* pool; it never certifies playback on a new device.
// Persist only channel IDs, source positions and pseudonymous contributor keys.
import crypto from 'node:crypto';

export const SHARED_FRESH_MS=4*60*60*1000;
const MAX_CHANNELS=800;
const MAX_CONTRIBUTORS=64;
const MIN_SPACING_MS=2*60*1000;
export function sharedSourceSignature(channel){
  const sources=(channel.sources||[]).map(s=>[s.providerId||'',s.url||'',s.upstreamUrl||''].join(':')).sort();
  const identity=[channel.id||'',channel.url||'',channel.upstreamUrl||'',...(channel.clientUrls||[]),...sources].join('|');
  return crypto.createHash('sha256').update(identity).digest('hex').slice(0,20);
}
export function recordSharedVideo(db,channel,{viewerKey,sourceIndex,reason},now=Date.now()){
  if(!channel?.id||!String(channel.sourceId||'').startsWith('public_'))return false;
  if(!['video-frame','background-video-frame'].includes(reason)||typeof viewerKey!=='string'||!viewerKey)return false;
  if(!Number.isInteger(sourceIndex)||sourceIndex<0||sourceIndex>=64)return false;
  db.sharedVideoPool??={};
  const sig=sharedSourceSignature(channel);
  const existing=db.sharedVideoPool[channel.id];
  const record=existing?.signature===sig?existing:{signature:sig,contributors:[]};
  record.contributors=(record.contributors||[]).filter(x=>now-Number(x.at||0)<SHARED_FRESH_MS&&Number(x.at||0)<=now);
  const previous=record.contributors.find(x=>x.key===viewerKey);
  if(previous&&now-Number(previous.at||0)<MIN_SPACING_MS&&previous.sourceIndex===sourceIndex)return false;
  record.contributors=record.contributors.filter(x=>x.key!==viewerKey);
  record.contributors.push({key:viewerKey,at:now,sourceIndex});
  record.contributors.sort((a,b)=>b.at-a.at);
  record.contributors.length=Math.min(record.contributors.length,MAX_CONTRIBUTORS);
  db.sharedVideoPool[channel.id]=record;
  // Bound persistent metadata growth even if public catalogues churn.
  const keys=Object.keys(db.sharedVideoPool);
  if(keys.length>MAX_CHANNELS){
    keys.sort((a,b)=>Math.max(0,...(db.sharedVideoPool[a]?.contributors||[]).map(x=>x.at))-
      Math.max(0,...(db.sharedVideoPool[b]?.contributors||[]).map(x=>x.at)));
    for(const id of keys.slice(0,keys.length-MAX_CHANNELS))delete db.sharedVideoPool[id];
  }
  return true;
}
export function sharedVideoSnapshot(db,now=Date.now(),limit=256){
  const byId=new Map((db.channels||[]).map(c=>[c.id,c]));
  const output=[];
  for(const [id,record] of Object.entries(db.sharedVideoPool||{})){
    const c=byId.get(id);
    if(!c||!String(c.sourceId||'').startsWith('public_')||record.signature!==sharedSourceSignature(c))continue;
    const fresh=(record.contributors||[]).filter(x=>x&&x.at<=now&&now-x.at<SHARED_FRESH_MS);
    if(!fresh.length)continue;
    const counts=new Map();
    for(const entry of fresh)counts.set(entry.sourceIndex,(counts.get(entry.sourceIndex)||0)+1);
    const best=[...counts].sort((a,b)=>b[1]-a[1])[0]?.[0];
    if(!Number.isInteger(best))continue;
    output.push({id,sourceIndex:best,viewers:fresh.length,
      lastVerifiedAt:new Date(Math.max(...fresh.map(x=>x.at))).toISOString()});
  }
  return output.sort((a,b)=>b.viewers-a.viewers||Date.parse(b.lastVerifiedAt)-Date.parse(a.lastVerifiedAt)).slice(0,limit);
}
