import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import { URL } from 'node:url';

const PORT=Number(process.env.PORT||8094);
const HOST=process.env.HOST||'0.0.0.0';
const ROOT=process.cwd();
const DATA_DIR=process.env.VELORA_DATA_DIR||path.join(ROOT,'.velora-data');
const DB_FILE=path.join(DATA_DIR,'catalogue.json');
const MASTER_KEY=process.env.VELORA_MASTER_KEY||'';
const DEFAULT_REFRESH_MINUTES=Number(process.env.VELORA_REFRESH_MINUTES||30);
const FETCH_TIMEOUT_MS=Number(process.env.VELORA_FETCH_TIMEOUT_MS||30000);
const MAX_JSON_BYTES=Number(process.env.VELORA_MAX_JSON_BYTES||50*1024*1024);
const MAX_PLAYLIST_BYTES=Number(process.env.VELORA_MAX_PLAYLIST_BYTES||20*1024*1024);
const HEALTH_CONCURRENCY=Math.max(1,Number(process.env.VELORA_HEALTH_CONCURRENCY||12));
const PUBLIC_RELAY_KEY=crypto.createHash('sha256').update(process.env.VELORA_RELAY_KEY||('velora-public-relay-'+process.pid)).digest();


const PUBLIC_DIRECT_OVERRIDES=[
  {
    id:'jm_cvm_direct',
    epgId:'CVMTV.jm',
    name:'CVM TV',
    group:'Jamaica',
    sourceName:'CVM TV Jamaica',
    upstreamUrls:['https://fl5.moveonjoy.com/CVM_TV_CARIBBEAN/index.m3u8','https://fl1.moveonjoy.com/CVM_TV_CARIBBEAN/index.m3u8'],
    territory:'WORLD',
    priority:95
  }
];

async function upsertDirectOverrides(){
  for(const o of PUBLIC_DIRECT_OVERRIDES){
    const providerId='public_direct';
    let provider=db.providers.find(p=>p.id===providerId);
    if(!provider){
      provider={
        id:providerId,
        type:'direct-public',
        name:'Velora Jamaica Direct',
        territory:'WORLD',
        priority:95,
        enabled:true,
        publicDirectory:true,
        createdAt:new Date().toISOString(),
        counts:{channels:0,movies:0,series:0}
      };
      db.providers.push(provider);
    }
    let chosen=o.upstreamUrls?.[0]||o.upstreamUrl||'';
    for(const candidate of (o.upstreamUrls||[o.upstreamUrl]).filter(Boolean)){
      const h=await checkUrl(candidate);
      console.log('Direct override probe:',o.name,candidate,h.status,h.httpStatus||'',h.latencyMs+'ms');
      if(h.status==='up'){chosen=candidate;break}
    }
    const item={
      id:o.id,
      epgId:o.epgId,
      num:'302',
      name:o.name,
      group:o.group,
      logo:'',
      now:'Live',
      access:'Velora direct stream',
      desc:o.name+' direct live stream',
      url:'/api/public/channel/'+o.id,
      upstreamUrl:chosen,
      sourceId:providerId,
      sourceName:o.sourceName,
      priority:o.priority,
      territory:o.territory,
      sources:[{
        providerId,
        providerName:provider.name,
        kind:'m3u',
        url:chosen,
        priority:o.priority,
        territory:o.territory,
        health:'unknown',
        lastChecked:null
      }]
    };
    db.channels=db.channels.filter(x=>x.id!==o.id&&channelKey(x)!==channelKey(item));
    db.channels.unshift(item);
    provider.counts.channels=(provider.counts.channels||0)+1;
  }
  saveDB();
}

const PUBLIC_BOOTSTRAP_FEEDS=[
  {id:'public_us',name:'US Public TV Directory',playlistUrl:'https://iptv-org.github.io/iptv/countries/us.m3u',territory:'WORLD',region:'USA',priority:45,refreshMinutes:1440},
  {id:'public_caribbean',name:'Caribbean Public TV Directory',playlistUrl:'https://iptv-org.github.io/iptv/regions/carib.m3u',territory:'WORLD',region:'Caribbean',priority:55,refreshMinutes:1440},
  {id:'public_movies',name:'Public Movie Channels',playlistUrl:'https://iptv-org.github.io/iptv/categories/movies.m3u',territory:'WORLD',priority:35,refreshMinutes:1440},
  {id:'public_series',name:'Public Series Channels',playlistUrl:'https://iptv-org.github.io/iptv/categories/series.m3u',territory:'WORLD',priority:35,refreshMinutes:1440},
  {id:'public_sports',name:'Public Sports Channels',playlistUrl:'https://iptv-org.github.io/iptv/categories/sports.m3u',territory:'WORLD',priority:35,refreshMinutes:1440}
];

async function bootstrapPublicFeeds(){
  if(process.env.VELORA_PUBLIC_FEEDS==='0')return;
  for(const cfg of PUBLIC_BOOTSTRAP_FEEDS){
    let provider=db.providers.find(p=>p.id===cfg.id);
    if(!provider){
      provider={
        id:cfg.id,
        type:'m3u-url',
        name:cfg.name,
        territory:cfg.territory,
        region:cfg.region||'Global',
        priority:cfg.priority,
        enabled:true,
        refreshMinutes:cfg.refreshMinutes,
        createdAt:new Date().toISOString(),
        publicDirectory:true,
        secret:protectSecret({playlistUrl:cfg.playlistUrl})
      };
      db.providers.push(provider);
      saveDB();
    }
    try{
      await syncProvider(provider);
      console.log('Public feed synced:',provider.name,provider.counts?.channels||0,'unique total:',db.channels.length);
    }catch(e){
      console.error('Public feed sync failed:',provider.name,e.message);
    }
  }
}


fs.mkdirSync(DATA_DIR,{recursive:true});

const emptyDB=()=>({
  version:7,
  updatedAt:new Date().toISOString(),
  providers:[],
  channels:[],
  catalog:[],
  epg:{},
  health:{},
  stats:{syncs:0,lastSync:null}
});

let db=loadDB();

function loadDB(){
  try{return {...emptyDB(),...JSON.parse(fs.readFileSync(DB_FILE,'utf8'))}}
  catch{return emptyDB()}
}
function saveDB(){
  db.updatedAt=new Date().toISOString();
  const tmp=DB_FILE+'.tmp';
  fs.writeFileSync(tmp,JSON.stringify(db,null,2));
  fs.renameSync(tmp,DB_FILE);
}
function json(res,status,obj){
  const body=JSON.stringify(obj);
  res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*'});
  res.end(body);
}
function text(res,status,body,type='text/plain; charset=utf-8'){
  res.writeHead(status,{'content-type':type,'cache-control':'no-store','access-control-allow-origin':'*'});
  res.end(body);
}
function readBody(req,limit=2*1024*1024){
  return new Promise((resolve,reject)=>{
    let total=0;const chunks=[];
    req.on('data',c=>{total+=c.length;if(total>limit){reject(new Error('Request body too large'));req.destroy();return}chunks.push(c)});
    req.on('end',()=>resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error',reject);
  });
}
function cleanBase(u){const x=new URL(u);x.pathname=x.pathname.replace(/\/+$/,'');return x.toString().replace(/\/$/,'')}
function uid(prefix='p'){return prefix+'_'+crypto.randomUUID().replaceAll('-','').slice(0,18)}
function slug(s=''){return String(s).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,100)}
function yearOf(v){const m=String(v||'').match(/\b(19|20)\d{2}\b/);return m?m[0]:''}
function normalizeTitle(s=''){return String(s).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/\([^)]*\)|\[[^\]]*\]/g,' ').replace(/\b(4k|uhd|fhd|hd|sd|hevc|h265|h264|multi|dubbed|subbed)\b/g,' ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim()}
function catalogKey(x){return [x.type||'movie',normalizeTitle(x.title),yearOf(x.year)].join('|')}
function channelKey(x){return (x.epgId||x.tvgId||normalizeTitle(x.name)).toLowerCase()}
function scoreSource(x){return Number(x.priority||50)+(x.health==='up'?30:x.health==='down'?-50:0)}
function sourceMeta(provider,item,kind){
  return {providerId:provider.id,providerName:provider.name,kind,streamId:item.stream_id??item.series_id??item.id??null,container:item.container_extension||item.container||'',priority:Number(provider.priority||50),territory:provider.territory||'WORLD',health:'unknown',lastChecked:null};
}
function publicProvider(p){
  const {secret,...rest}=p;
  return rest;
}
function publicSnapshot(){
  return {
    updatedAt:db.updatedAt,
    providers:db.providers.map(publicProvider),
    channels:db.channels,
    catalog:db.catalog,
    stats:computeStats()
  };
}
function computeStats(){
  const sourceAssets=db.catalog.reduce((n,x)=>n+(x.sources?.length||1),0)+db.channels.reduce((n,x)=>n+(x.sources?.length||1),0);
  const down=Object.values(db.health||{}).filter(x=>x.status==='down').length;
  return {
    providers:db.providers.length,
    channels:db.channels.length,
    movies:db.catalog.filter(x=>x.type==='movie').length,
    series:db.catalog.filter(x=>x.type==='series').length,
    vod:db.catalog.length,
    sourceAssets,
    duplicatesMerged:Math.max(0,sourceAssets-db.catalog.length-db.channels.length),
    unhealthySources:down,
    syncs:db.stats?.syncs||0,
    lastSync:db.stats?.lastSync||null
  };
}

function keyBytes(){
  if(!MASTER_KEY)return null;
  return crypto.createHash('sha256').update(MASTER_KEY).digest();
}
function protectSecret(obj){
  const key=keyBytes();
  if(!key)return {mode:'plain',value:obj};
  const iv=crypto.randomBytes(12);
  const cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
  const data=Buffer.concat([cipher.update(JSON.stringify(obj),'utf8'),cipher.final()]);
  return {mode:'aes-256-gcm',iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),value:data.toString('base64')};
}
function revealSecret(box){
  if(!box)return {};
  if(box.mode==='plain')return box.value||{};
  const key=keyBytes();if(!key)throw new Error('VELORA_MASTER_KEY is required to decrypt provider credentials');
  const decipher=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(box.iv,'base64'));
  decipher.setAuthTag(Buffer.from(box.tag,'base64'));
  const data=Buffer.concat([decipher.update(Buffer.from(box.value,'base64')),decipher.final()]).toString('utf8');
  return JSON.parse(data);
}

function isPrivateIp(ip){
  if(ip==='::1'||ip==='127.0.0.1')return true;
  if(ip.startsWith('10.')||ip.startsWith('192.168.')||ip.startsWith('169.254.'))return true;
  const m=ip.match(/^172\.(\d+)\./);if(m&&Number(m[1])>=16&&Number(m[1])<=31)return true;
  if(ip.startsWith('fc')||ip.startsWith('fd')||ip.startsWith('fe80:'))return true;
  return false;
}
async function assertSafeUrl(input){
  const u=new URL(input);
  if(!['http:','https:'].includes(u.protocol))throw new Error('Only HTTP/HTTPS feed URLs are allowed');
  const host=u.hostname.toLowerCase();
  if(['localhost','localhost.localdomain'].includes(host))throw new Error('Local/private feed hosts are blocked');
  const addrs=await dns.lookup(host,{all:true});
  if(!addrs.length||addrs.some(a=>isPrivateIp(a.address)))throw new Error('Private/internal feed hosts are blocked');
  return u;
}
async function fetchBuffer(url,{headers={},maxBytes=MAX_JSON_BYTES,method='GET'}={}){
  await assertSafeUrl(url);
  const ac=new AbortController();const timer=setTimeout(()=>ac.abort(),FETCH_TIMEOUT_MS);
  try{
    const r=await fetch(url,{method,headers,signal:ac.signal,redirect:'follow'});
    if(!r.ok)throw new Error('Upstream returned HTTP '+r.status);
    const reader=r.body.getReader();let total=0;const chunks=[];
    while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>maxBytes)throw new Error('Upstream response exceeded size limit');chunks.push(value)}
    return {buffer:Buffer.concat(chunks.map(x=>Buffer.from(x))),headers:r.headers,status:r.status,url:r.url};
  }finally{clearTimeout(timer)}
}
async function fetchJSON(url){
  const {buffer}=await fetchBuffer(url,{headers:{accept:'application/json'},maxBytes:MAX_JSON_BYTES});
  return JSON.parse(buffer.toString('utf8'));
}
async function fetchText(url,maxBytes=MAX_PLAYLIST_BYTES){
  const {buffer}=await fetchBuffer(url,{maxBytes});
  return buffer.toString('utf8');
}

function xtreamUrl(provider,action){
  const s=revealSecret(provider.secret);
  const u=new URL('/player_api.php',provider.serverUrl);
  u.searchParams.set('username',s.username);u.searchParams.set('password',s.password);
  if(action)u.searchParams.set('action',action);
  return u.toString();
}
function playbackUrl(provider,kind,item){
  const s=revealSecret(provider.secret);
  const id=item.stream_id??item.series_id??item.id;
  if(kind==='live')return new URL('/live/'+encodeURIComponent(s.username)+'/'+encodeURIComponent(s.password)+'/'+id+'.ts',provider.serverUrl).toString();
  const ext=item.container_extension||'mp4';
  return new URL('/movie/'+encodeURIComponent(s.username)+'/'+encodeURIComponent(s.password)+'/'+id+'.'+ext,provider.serverUrl).toString();
}
function proxyPath(providerId,kind,id,ext=''){
  return '/api/play/'+encodeURIComponent(providerId)+'/'+encodeURIComponent(kind)+'/'+encodeURIComponent(id)+(ext?('?ext='+encodeURIComponent(ext)):'');
}

function normalizeXtreamChannel(provider,x,i){
  return {
    id:'ch_'+slug(x.epg_channel_id||x.name||String(x.stream_id))+'_'+String(x.stream_id||i),
    epgId:x.epg_channel_id||'',
    num:String(x.num??i+1),
    name:x.name||'Channel '+(i+1),
    group:String(x.category_name||x.category_id||'Other'),
    logo:x.stream_icon||'',
    now:'Live',
    next:'',
    desc:'Provider live channel',
    url:proxyPath(provider.id,'live',x.stream_id),
    sourceId:provider.id,
    sourceName:provider.name,
    priority:Number(provider.priority||50),
    territory:provider.territory||'WORLD',
    sources:[sourceMeta(provider,x,'live')]
  };
}
function normalizeXtreamMovie(provider,x,i){
  return {
    id:'mv_'+String(x.stream_id||i),
    type:'movie',
    title:x.name||x.title||'Untitled',
    year:yearOf(x.year||x.releaseDate||x.added),
    rating:String(x.rating_5based||x.rating||'NR'),
    genre:String(x.genre||x.category_name||'Other'),
    quality:/4k|uhd/i.test(x.name||'')?'4K':/hd|1080/i.test(x.name||'')?'HD':'',
    description:x.plot||x.description||'',
    art:x.stream_icon||x.cover||'',
    backdrop:Array.isArray(x.backdrop_path)?x.backdrop_path[0]||'':x.backdrop_path||'',
    url:proxyPath(provider.id,'movie',x.stream_id,x.container_extension||'mp4'),
    sourceId:provider.id,sourceName:provider.name,priority:Number(provider.priority||50),territory:provider.territory||'WORLD',
    sources:[sourceMeta(provider,x,'movie')]
  };
}
function normalizeXtreamSeries(provider,x,i){
  return {
    id:'sr_'+String(x.series_id||i),
    type:'series',
    title:x.name||x.title||'Untitled Series',
    year:yearOf(x.year||x.releaseDate||x.last_modified),
    rating:String(x.rating_5based||x.rating||'NR'),
    genre:String(x.genre||x.category_name||'Other'),
    quality:/4k|uhd/i.test(x.name||'')?'4K':/hd|1080/i.test(x.name||'')?'HD':'',
    description:x.plot||x.description||'',
    art:x.cover||x.stream_icon||'',
    backdrop:Array.isArray(x.backdrop_path)?x.backdrop_path[0]||'':x.backdrop_path||'',
    providerSeriesId:x.series_id,
    sourceId:provider.id,sourceName:provider.name,priority:Number(provider.priority||50),territory:provider.territory||'WORLD',
    sources:[sourceMeta(provider,x,'series')]
  };
}

function mergeChannels(provider,items){
  const foreign=db.channels.filter(x=>!(x.sources||[]).some(s=>s.providerId===provider.id));
  const map=new Map(foreign.map(x=>[channelKey(x),x]));
  for(const item of items){
    const key=channelKey(item),existing=map.get(key),src=item.sources[0];
    if(existing){
      existing.sources=[...(existing.sources||[]).filter(s=>s.providerId!==provider.id),src].sort((a,b)=>scoreSource(b)-scoreSource(a));
      const best=existing.sources[0];
      if(best.providerId===provider.id)Object.assign(existing,{...item,id:existing.id,sources:existing.sources});
    }else map.set(key,item);
  }
  db.channels=[...map.values()];
}
function mergeCatalog(provider,items){
  const foreign=db.catalog.filter(x=>!(x.sources||[]).some(s=>s.providerId===provider.id));
  const map=new Map(foreign.map(x=>[catalogKey(x),x]));
  for(const item of items){
    const key=catalogKey(item),existing=map.get(key),src=item.sources[0];
    if(existing){
      existing.sources=[...(existing.sources||[]).filter(s=>s.providerId!==provider.id),src].sort((a,b)=>scoreSource(b)-scoreSource(a));
      const best=existing.sources[0];
      if(best.providerId===provider.id)Object.assign(existing,{...item,id:existing.id,sources:existing.sources});
    }else map.set(key,item);
  }
  db.catalog=[...map.values()];
}

async function syncXtream(provider){
  const started=Date.now();
  const [live,vod,series]=await Promise.all([
    fetchJSON(xtreamUrl(provider,'get_live_streams')),
    fetchJSON(xtreamUrl(provider,'get_vod_streams')),
    fetchJSON(xtreamUrl(provider,'get_series'))
  ]);
  const channels=(Array.isArray(live)?live:[]).map((x,i)=>normalizeXtreamChannel(provider,x,i));
  const catalog=[
    ...(Array.isArray(vod)?vod:[]).map((x,i)=>normalizeXtreamMovie(provider,x,i)),
    ...(Array.isArray(series)?series:[]).map((x,i)=>normalizeXtreamSeries(provider,x,i))
  ];
  mergeChannels(provider,channels);mergeCatalog(provider,catalog);
  provider.lastSync=new Date().toISOString();provider.status='active';provider.lastError=null;
  provider.counts={channels:channels.length,movies:catalog.filter(x=>x.type==='movie').length,series:catalog.filter(x=>x.type==='series').length};
  db.stats.syncs=(db.stats.syncs||0)+1;db.stats.lastSync=provider.lastSync;saveDB();
  return {channels,catalog,durationMs:Date.now()-started};
}


function relayToken(url){
  const body=Buffer.from(url,'utf8').toString('base64url');
  const sig=crypto.createHmac('sha256',PUBLIC_RELAY_KEY).update(body).digest('base64url');
  return body+'.'+sig;
}
function relayDecode(token){
  const [body,sig]=String(token||'').split('.');
  if(!body||!sig)return null;
  const expected=crypto.createHmac('sha256',PUBLIC_RELAY_KEY).update(body).digest('base64url');
  if(sig.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return null;
  return Buffer.from(body,'base64url').toString('utf8');
}
function relayPath(url){return '/api/public/relay?token='+encodeURIComponent(relayToken(url))}
function rewriteHls(body,baseUrl){
  const base=new URL(baseUrl);
  return body.split(/\r?\n/).map(line=>{
    if(!line)return line;
    if(line.startsWith('#')){
      return line.replace(/URI="([^"]+)"/g,(_,u)=>{
        try{return 'URI="'+relayPath(new URL(u,base).toString())+'"'}catch{return 'URI="'+u+'"'}
      });
    }
    try{return relayPath(new URL(line,base).toString())}catch{return line}
  }).join('\n');
}
async function relayPublicUrl(req,res,target){
  await assertSafeUrl(target);
  const headers={};
  if(req.headers.range)headers.range=req.headers.range;
  const ac=new AbortController();req.on('close',()=>ac.abort());
  const r=await fetch(target,{headers,signal:ac.signal,redirect:'follow'});
  const ct=(r.headers.get('content-type')||'').toLowerCase();
  const isHls=ct.includes('mpegurl')||/\.m3u8(?:$|\?)/i.test(r.url||target);
  if(isHls){
    const body=await r.text();
    const rewritten=rewriteHls(body,r.url||target);
    res.writeHead(r.status,{
      'content-type':'application/vnd.apple.mpegurl',
      'cache-control':'no-store',
      'access-control-allow-origin':'*'
    });
    return res.end(rewritten);
  }
  const outHeaders={'cache-control':'no-store','access-control-allow-origin':'*'};
  for(const h of ['content-type','content-length','content-range','accept-ranges']){
    const v=r.headers.get(h);if(v)outHeaders[h]=v;
  }
  res.writeHead(r.status,outHeaders);
  if(!r.body)return res.end();
  const reader=r.body.getReader();
  while(true){
    const {done,value}=await reader.read();if(done)break;
    if(!res.write(Buffer.from(value)))await new Promise(ok=>res.once('drain',ok));
  }
  res.end();
}

function parseM3U(textBody,provider){
  const lines=textBody.replace(/\r/g,'').split('\n'),out=[];let meta=null;
  for(const raw of lines){
    const line=raw.trim();
    if(line.startsWith('#EXTINF:')){
      const attr={};for(const m of line.matchAll(/([\w-]+)="([^"]*)"/g))attr[m[1]]=m[2];
      const name=(line.split(',').slice(1).join(',')||attr['tvg-name']||'Channel').trim();
      meta={name,epgId:attr['tvg-id']||'',group:attr['group-title']||'Other',logo:attr['tvg-logo']||''};
    }else if(line&&!line.startsWith('#')&&meta){
      const id=uid('m3u');
      const publicRelay=!!provider.publicDirectory;
      out.push({id,num:String(out.length+1),name:meta.name,epgId:meta.epgId,group:meta.group,logo:meta.logo,now:'Live',url:publicRelay?('/api/public/channel/'+id):line,upstreamUrl:publicRelay?line:'',sourceId:provider.id,sourceName:provider.name,priority:Number(provider.priority||50),territory:provider.territory||'WORLD',sources:[{providerId:provider.id,providerName:provider.name,kind:'m3u',url:line,priority:Number(provider.priority||50),territory:provider.territory||'WORLD',health:'unknown',lastChecked:null}]});
      meta=null;
    }
  }
  return out;
}
async function syncM3U(provider){
  const secret=revealSecret(provider.secret),body=await fetchText(secret.playlistUrl);
  const channels=parseM3U(body,provider);mergeChannels(provider,channels);
  provider.lastSync=new Date().toISOString();provider.status='active';provider.lastError=null;provider.counts={channels:channels.length,movies:0,series:0};
  db.stats.syncs=(db.stats.syncs||0)+1;db.stats.lastSync=provider.lastSync;saveDB();
  return {channels,catalog:[]};
}
async function syncProvider(provider){
  try{
    if(provider.type==='xtream')return await syncXtream(provider);
    if(provider.type==='m3u-url')return await syncM3U(provider);
    throw new Error('Unsupported provider type: '+provider.type);
  }catch(e){
    provider.status='error';provider.lastError=String(e.message||e);provider.lastSyncAttempt=new Date().toISOString();saveDB();throw e;
  }
}
async function syncAll(){
  const results=[];
  for(const p of db.providers){
    if(p.enabled===false)continue;
    try{const r=await syncProvider(p);results.push({id:p.id,ok:true,channels:r.channels.length,catalog:r.catalog.length})}
    catch(e){results.push({id:p.id,ok:false,error:String(e.message||e)})}
  }
  return results;
}

async function checkUrl(url){
  const started=Date.now();
  try{
    await assertSafeUrl(url);
    const ac=new AbortController();const timer=setTimeout(()=>ac.abort(),8000);
    let r;
    try{r=await fetch(url,{method:'HEAD',signal:ac.signal,redirect:'follow'})}catch{}
    if(!r||!r.ok)r=await fetch(url,{method:'GET',headers:{range:'bytes=0-2047'},signal:ac.signal,redirect:'follow'});
    clearTimeout(timer);
    return {status:r.ok?'up':'down',httpStatus:r.status,latencyMs:Date.now()-started,checkedAt:new Date().toISOString()};
  }catch(e){return {status:'down',error:String(e.message||e),latencyMs:Date.now()-started,checkedAt:new Date().toISOString()}}
}
async function pooled(items,limit,fn){
  const out=new Array(items.length);let next=0;
  async function worker(){while(true){const i=next++;if(i>=items.length)return;out[i]=await fn(items[i],i)}}
  await Promise.all(Array.from({length:Math.min(limit,items.length)},worker));return out;
}
async function healthScan({limit=250}={}){
  const targets=[];
  for(const ch of db.channels){
    for(const s of ch.sources||[]){
      if(targets.length>=limit)break;
      const provider=db.providers.find(p=>p.id===s.providerId);
      let url=s.url||'';
      if(!url&&provider&&s.streamId&&s.kind==='live')url=playbackUrl(provider,'live',{stream_id:s.streamId});
      if(url)targets.push({key:'channel:'+ch.id+':'+s.providerId,url,source:s});
    }
    if(targets.length>=limit)break;
  }
  const checked=await pooled(targets,HEALTH_CONCURRENCY,async t=>{
    const h=await checkUrl(t.url);db.health[t.key]=h;t.source.health=h.status;t.source.lastChecked=h.checkedAt;return {...t,...h};
  });
  saveDB();
  return {checked:checked.length,up:checked.filter(x=>x.status==='up').length,down:checked.filter(x=>x.status==='down').length,results:checked};
}

async function proxyUpstream(req,res,provider,kind,id,ext=''){
  let target;
  if(kind==='live')target=playbackUrl(provider,'live',{stream_id:id});
  else if(kind==='movie')target=playbackUrl(provider,'movie',{stream_id:id,container_extension:ext||'mp4'});
  else return json(res,400,{error:'Unsupported playback kind'});
  await assertSafeUrl(target);
  const headers={};
  if(req.headers.range)headers.range=req.headers.range;
  const ac=new AbortController();req.on('close',()=>ac.abort());
  const r=await fetch(target,{headers,signal:ac.signal,redirect:'follow'});
  const outHeaders={'cache-control':'no-store','access-control-allow-origin':'*'};
  for(const h of ['content-type','content-length','content-range','accept-ranges']){const v=r.headers.get(h);if(v)outHeaders[h]=v}
  res.writeHead(r.status,outHeaders);
  if(!r.body)return res.end();
  const reader=r.body.getReader();
  while(true){const {done,value}=await reader.read();if(done)break;if(!res.write(Buffer.from(value)))await new Promise(ok=>res.once('drain',ok))}
  res.end();
}

function mime(p){
  const ext=path.extname(p).toLowerCase();
  return ({'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.xml':'application/xml; charset=utf-8','.m3u':'audio/x-mpegurl','.m3u8':'application/vnd.apple.mpegurl','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon'})[ext]||'application/octet-stream';
}
function serveStatic(req,res){
  const u=new URL(req.url,'http://localhost');
  let rel=decodeURIComponent(u.pathname);
  if(rel==='/'||rel==='')rel='/index.html';
  const file=path.resolve(ROOT,'.'+rel);
  if(rel.startsWith('/.velora-data')||rel==='/server.mjs'||rel.startsWith('/.env'))return text(res,404,'Not found');
  if(!file.startsWith(path.resolve(ROOT)))return text(res,403,'Forbidden');
  if(!fs.existsSync(file)||!fs.statSync(file).isFile())return text(res,404,'Not found');
  res.writeHead(200,{'content-type':mime(file),'cache-control':/\.(js|css)$/.test(file)?'no-cache':'no-store'});
  fs.createReadStream(file).pipe(res);
}

async function api(req,res){
  if(req.method==='OPTIONS'){res.writeHead(204,{'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,DELETE,OPTIONS','access-control-allow-headers':'content-type'});return res.end()}
  const u=new URL(req.url,'http://localhost');
  const p=u.pathname;

  if(req.method==='GET'&&p==='/api/system/status')return json(res,200,{ok:true,engine:'Velora Ingest V7',version:7,port:PORT,persistent:true,encryptedSecrets:!!MASTER_KEY,refreshMinutes:DEFAULT_REFRESH_MINUTES,stats:computeStats()});
  if(req.method==='GET'&&p==='/api/catalogue')return json(res,200,{ok:true,...publicSnapshot()});
  if(req.method==='GET'&&p==='/api/providers')return json(res,200,{ok:true,providers:db.providers.map(publicProvider)});

  if(req.method==='POST'&&p==='/api/providers/xtream/connect'){
    const b=JSON.parse(await readBody(req));
    if(!b.serverUrl||!b.username||!b.password)return json(res,400,{error:'serverUrl, username and password are required'});
    const provider={
      id:uid('xt'),type:'xtream',name:b.name||'Xtream Provider',serverUrl:cleanBase(b.serverUrl),territory:String(b.territory||'WORLD').toUpperCase(),
      priority:Number(b.priority||50),enabled:true,refreshMinutes:Number(b.refreshMinutes||DEFAULT_REFRESH_MINUTES),createdAt:new Date().toISOString(),
      secret:protectSecret({username:String(b.username),password:String(b.password)})
    };
    await assertSafeUrl(provider.serverUrl);
    db.providers.push(provider);saveDB();
    try{
      const result=await syncProvider(provider);
      return json(res,200,{ok:true,provider:publicProvider(provider),channels:result.channels,catalog:result.catalog,stats:computeStats()});
    }catch(e){
      db.providers=db.providers.filter(x=>x.id!==provider.id);saveDB();
      return json(res,502,{error:String(e.message||e)});
    }
  }

  if(req.method==='POST'&&p==='/api/providers/m3u/connect'){
    const b=JSON.parse(await readBody(req));
    if(!b.playlistUrl)return json(res,400,{error:'playlistUrl is required'});
    await assertSafeUrl(b.playlistUrl);
    const provider={id:uid('m3u'),type:'m3u-url',name:b.name||'M3U Provider',territory:String(b.territory||'WORLD').toUpperCase(),priority:Number(b.priority||50),enabled:true,refreshMinutes:Number(b.refreshMinutes||DEFAULT_REFRESH_MINUTES),createdAt:new Date().toISOString(),secret:protectSecret({playlistUrl:b.playlistUrl})};
    db.providers.push(provider);saveDB();
    try{const result=await syncProvider(provider);return json(res,200,{ok:true,provider:publicProvider(provider),channels:result.channels,catalog:[],stats:computeStats()})}
    catch(e){db.providers=db.providers.filter(x=>x.id!==provider.id);saveDB();return json(res,502,{error:String(e.message||e)})}
  }

  const syncMatch=p.match(/^\/api\/providers\/([^/]+)\/sync$/);
  if(req.method==='POST'&&syncMatch){
    const provider=db.providers.find(x=>x.id===syncMatch[1]);if(!provider)return json(res,404,{error:'Provider not found'});
    try{const result=await syncProvider(provider);return json(res,200,{ok:true,provider:publicProvider(provider),channels:result.channels.length,catalog:result.catalog.length,stats:computeStats()})}
    catch(e){return json(res,502,{error:String(e.message||e)})}
  }
  if(req.method==='POST'&&p==='/api/providers/sync-all'){
    const results=await syncAll();return json(res,200,{ok:true,results,stats:computeStats()});
  }
  const delMatch=p.match(/^\/api\/providers\/([^/]+)$/);
  if(req.method==='DELETE'&&delMatch){
    const id=delMatch[1];db.providers=db.providers.filter(x=>x.id!==id);
    db.channels=db.channels.map(x=>({...x,sources:(x.sources||[]).filter(s=>s.providerId!==id)})).filter(x=>x.sources.length);
    db.catalog=db.catalog.map(x=>({...x,sources:(x.sources||[]).filter(s=>s.providerId!==id)})).filter(x=>x.sources.length);
    saveDB();return json(res,200,{ok:true,stats:computeStats()});
  }

  if(req.method==='POST'&&p==='/api/health/scan'){
    const body=JSON.parse((await readBody(req).catch(()=>''))||'{}');
    const result=await healthScan({limit:Math.min(2000,Math.max(1,Number(body.limit||250)))});
    return json(res,200,{ok:true,...result,stats:computeStats()});
  }

  const publicChannelMatch=p.match(/^\/api\/public\/channel\/([^/]+)$/);
  if(req.method==='GET'&&publicChannelMatch){
    const ch=db.channels.find(x=>x.id===publicChannelMatch[1]);
    if(!ch||!ch.upstreamUrl)return json(res,404,{error:'Public channel source not found'});
    return relayPublicUrl(req,res,ch.upstreamUrl);
  }
  if(req.method==='GET'&&p==='/api/public/relay'){
    const target=relayDecode(u.searchParams.get('token')||'');
    if(!target)return json(res,400,{error:'Invalid relay token'});
    return relayPublicUrl(req,res,target);
  }

  const play=p.match(/^\/api\/play\/([^/]+)\/(live|movie)\/([^/]+)$/);
  if(req.method==='GET'&&play){
    const provider=db.providers.find(x=>x.id===play[1]);if(!provider)return json(res,404,{error:'Provider not found'});
    return proxyUpstream(req,res,provider,play[2],play[3],u.searchParams.get('ext')||'');
  }

  const seriesMatch=p.match(/^\/api\/providers\/([^/]+)\/xtream\/series\/([^/]+)$/);
  if(req.method==='GET'&&seriesMatch){
    const provider=db.providers.find(x=>x.id===seriesMatch[1]);if(!provider||provider.type!=='xtream')return json(res,404,{error:'Provider not found'});
    const apiUrl=new URL(xtreamUrl(provider,'get_series_info'));apiUrl.searchParams.set('series_id',seriesMatch[2]);
    try{
      const data=await fetchJSON(apiUrl.toString());
      const seasons=[];
      for(const [season,eps] of Object.entries(data.episodes||{})){
        for(const e of eps||[]){
          const id=e.id||e.episode_id;
          seasons.push({id:'ep_'+id,num:Number(e.episode_num||e.episode||0),season:Number(season),title:e.title||('Episode '+(e.episode_num||'')),description:e.info?.plot||'',art:e.info?.movie_image||data.info?.cover||'',url:'/api/play/'+provider.id+'/movie/'+id+'?ext='+(e.container_extension||'mp4')});
        }
      }
      return json(res,200,{ok:true,episodes:seasons,info:data.info||{}});
    }catch(e){return json(res,502,{error:String(e.message||e)})}
  }

  if(req.method==='GET'&&p.match(/^\/api\/providers\/([^/]+)\/epg$/)){
    return text(res,200,'<?xml version="1.0"?><tv></tv>','application/xml; charset=utf-8');
  }
  return json(res,404,{error:'API route not found'});
}

const server=http.createServer(async(req,res)=>{
  try{
    if(req.url.startsWith('/api/'))return await api(req,res);
    return serveStatic(req,res);
  }catch(e){
    console.error(e);if(!res.headersSent)return json(res,500,{error:String(e.message||e)});res.end();
  }
});
server.listen(PORT,HOST,()=>{console.log('Velora Ingest V7 listening on http://'+HOST+':'+PORT);setTimeout(()=>bootstrapPublicFeeds().catch(e=>console.error('Public bootstrap failed',e)),750)});

let schedulerBusy=false;
setInterval(async()=>{
  if(schedulerBusy)return;schedulerBusy=true;
  try{
    const now=Date.now();
    for(const p of db.providers){
      if(p.enabled===false)continue;
      const interval=Math.max(5,Number(p.refreshMinutes||DEFAULT_REFRESH_MINUTES))*60000;
      const last=Date.parse(p.lastSync||0)||0;
      if(now-last>=interval){try{await syncProvider(p)}catch(e){console.error('Scheduled sync failed for',p.name,e.message)}}
    }
  }finally{schedulerBusy=false}
},60000).unref();
