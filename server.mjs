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
const MEDIA_GRAPH_FILE=path.join(DATA_DIR,'media-graph.json');
const MASTER_KEY=process.env.VELORA_MASTER_KEY||'';
const DEFAULT_REFRESH_MINUTES=Number(process.env.VELORA_REFRESH_MINUTES||30);
const FETCH_TIMEOUT_MS=Number(process.env.VELORA_FETCH_TIMEOUT_MS||30000);
const MAX_JSON_BYTES=Number(process.env.VELORA_MAX_JSON_BYTES||50*1024*1024);
const MAX_PLAYLIST_BYTES=Number(process.env.VELORA_MAX_PLAYLIST_BYTES||20*1024*1024);
const HEALTH_CONCURRENCY=Math.max(1,Number(process.env.VELORA_HEALTH_CONCURRENCY||12));
const PUBLIC_RELAY_KEY=crypto.createHash('sha256').update(process.env.VELORA_RELAY_KEY||('velora-public-relay-'+process.pid)).digest();



const VOD_PUBLISHER_CHANNELS=[
  {id:'indie-rights',name:'Indie Rights Movies For Free',channelId:'UCJuyiB0GT9-q92gC_M3XLpg',kind:'movie'},
  {id:'movie-central',name:'Movie Central',channelId:'UCGBzBkV-MinlBvHBzZawfLQ',kind:'movie'},
  {id:'maverick-movies',name:'Maverick Movies',channelId:'UC2u3R3pjOiPZu4LtTlKkxdw',kind:'movie'},
  {id:'filmrise-television',name:'FilmRise Television',channelId:'UCVVXDVee0JZ2dlPYtpdTZVg',kind:'series'}
];
const VOD_PUBLISHER_CACHE=new Map();

function decodeXmlText(v=''){
  return String(v)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1')
    .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
    .replace(/&quot;/g,'"').replace(/&#39;/g,"'");
}
function xmlTag(block,tag){
  const m=block.match(new RegExp('<'+tag+'[^>]*>([\\s\\S]*?)<\\/'+tag+'>','i'));
  return m?decodeXmlText(m[1]).trim():'';
}
function xmlAttr(block,tag,attr){
  const m=block.match(new RegExp('<'+tag+'[^>]*\\s'+attr+'="([^"]+)"','i'));
  return m?decodeXmlText(m[1]).trim():'';
}
function publisherEntryLooksPlayable(title,kind){
  const t=String(title||'').toLowerCase();
  if(/trailer|teaser|clip|shorts?|behind the scenes|interview|preview/.test(t))return false;
  if(kind==='series')return /full episode|episode\s*\d|s\d+\s*e\d+|season\s*\d/.test(t);
  return /full movie|full film|movie\b|film\b/.test(t);
}
async function fetchPublisherFeed(src){
  const cached=VOD_PUBLISHER_CACHE.get(src.channelId);
  if(cached&&Date.now()-cached.at<10*60*1000)return cached.items;
  const url='https://www.youtube.com/feeds/videos.xml?channel_id='+encodeURIComponent(src.channelId);
  const body=await fetchText(url,2*1024*1024);
  const entries=[...body.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)].map(m=>m[1]);
  const items=entries.map((entry,i)=>{
    const videoId=xmlTag(entry,'yt:videoId');
    const title=xmlTag(entry,'title');
    const published=xmlTag(entry,'published');
    const art=xmlAttr(entry,'media:thumbnail','url')||('https://i.ytimg.com/vi/'+videoId+'/hq720.jpg');
    if(!videoId||!title||!publisherEntryLooksPlayable(title,src.kind))return null;
    const yr=(title.match(/\b(20\d{2}|19\d{2})\b/)||[])[0]||String(published||'').slice(0,4);
    return {
      id:'pub_'+src.id+'_'+videoId,
      type:src.kind,
      title,
      year:yr,
      rating:'NR',
      genre:src.kind==='series'?'Television':'Movie',
      quality:'HD',
      description:'Full '+(src.kind==='series'?'episode':'movie')+' from '+src.name+'.',
      art,
      backdrop:art,
      youtubeId:videoId,
      publisher:src.name,
      sourceName:src.name,
      publishedAt:published,
      playableInVelora:true,
      url:'',
      priority:80-i
    };
  }).filter(Boolean);
  VOD_PUBLISHER_CACHE.set(src.channelId,{at:Date.now(),items});
  return items;
}

async function sandboxArchiveVod(kind='movie',rows=96){
  const collection=kind==='series'?'classic_tv':'feature_films';
  const q='collection:'+collection+' AND mediatype:movies';
  const u=new URL('https://archive.org/advancedsearch.php');
  u.searchParams.set('q',q);
  for(const field of ['identifier','title','description','year','date','subject','creator','downloads'])u.searchParams.append('fl[]',field);
  u.searchParams.append('sort[]','downloads desc');
  u.searchParams.set('rows',String(rows));
  u.searchParams.set('page','1');
  u.searchParams.set('output','json');
  const data=await fetchJSON(u.toString());
  return (data?.response?.docs||[]).map((d,i)=>{
    const id=String(d.identifier||'').trim();
    const title=String(Array.isArray(d.title)?d.title[0]:d.title||'Untitled').replace(/<[^>]+>/g,'').trim();
    const yr=(String(d.year||d.date||'').match(/\b(18|19|20)\d{2}\b/)||[])[0]||'';
    const subject=Array.isArray(d.subject)?d.subject.join(' '):String(d.subject||'');
    const genre=/horror/i.test(subject)?'Horror':/comedy/i.test(subject)?'Comedy':/western/i.test(subject)?'Western':/documentary/i.test(subject)?'Documentary':/animation|cartoon/i.test(subject)?'Animation':kind==='series'?'Classic TV':'Classic Film';
    return {
      id:'sandbox_archive_'+id,
      type:kind==='series'?'series':'movie',
      title,year:yr,rating:'NR',genre,quality:'Archive',
      description:String(Array.isArray(d.description)?d.description[0]:d.description||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim(),
      art:'https://archive.org/services/img/'+encodeURIComponent(id),
      backdrop:'https://archive.org/services/img/'+encodeURIComponent(id),
      archiveId:id,openSource:true,sourceName:'Internet Archive',
      publishedAt:String(d.date||''),
      downloads:Number(d.downloads||0),
      priority:25-i
    };
  }).filter(x=>x.archiveId);
}
function sandboxSeriesKey(title=''){
  return normalizeTitle(String(title)
    .replace(/\b(full episode|episode\s*\d+|s\d+\s*e\d+|season\s*\d+).*$/i,'')
    .replace(/[-:|]+$/,'').trim());
}
function sandboxGroupPublisherSeries(items=[]){
  const groups=new Map();
  for(const item of items){
    const key=sandboxSeriesKey(item.title)||normalizeTitle(item.publisher||'Series');
    if(!groups.has(key))groups.set(key,{
      id:'sandbox_series_'+slug(key||item.title),
      type:'series',
      title:String(item.title||'Series').replace(/\b(full episode|episode\s*\d+|s\d+\s*e\d+).*$/i,'').replace(/[-:|]+$/,'').trim()||item.title,
      year:item.year||'',
      rating:'NR',
      genre:'Television',
      quality:'HD',
      description:'Full episodes from '+(item.publisher||item.sourceName||'publisher')+'.',
      art:item.art||'',backdrop:item.backdrop||item.art||'',
      sourceName:item.publisher||item.sourceName||'Publisher',
      publishedAt:item.publishedAt||'',
      episodes:[]
    });
    const show=groups.get(key);
    const m=String(item.title||'').match(/S(\d{1,2})\s*E(\d{1,3})/i)||String(item.title||'').match(/episode\s*(\d+)/i);
    const season=m&&m.length>2?Number(m[1]):1;
    const episode=m?Number(m[m.length-1]):show.episodes.length+1;
    show.episodes.push({
      id:item.id,num:episode,season,title:item.title,description:item.description||'',
      art:item.art||'',youtubeId:item.youtubeId||'',publisherUrl:item.youtubeId?'https://www.youtube.com/watch?v='+item.youtubeId:''
    });
    if(String(item.publishedAt||'')>String(show.publishedAt||''))show.publishedAt=item.publishedAt;
  }
  return [...groups.values()].map(x=>({...x,episodes:x.episodes.sort((a,b)=>(a.season-b.season)||(a.num-b.num))}));
}
async function sandboxProviderPayload(){
  const [publisherMovies,publisherEpisodes,archiveMovies,archiveSeries]=await Promise.all([
    publisherVod('movie'),
    publisherVod('series'),
    sandboxArchiveVod('movie',96),
    sandboxArchiveVod('series',96)
  ]);
  const groupedSeries=sandboxGroupPublisherSeries(publisherEpisodes);
  const movies=[...publisherMovies,...archiveMovies]
    .sort((a,b)=>String(b.publishedAt||'').localeCompare(String(a.publishedAt||'')));
  const series=[...groupedSeries,...archiveSeries]
    .sort((a,b)=>String(b.publishedAt||'').localeCompare(String(a.publishedAt||'')));
  const live=db.channels.slice().sort((a,b)=>(Number(b.priority||0)-Number(a.priority||0))||String(a.name).localeCompare(String(b.name)));
  return {
    ok:true,
    provider:{
      id:'velora_sandbox',
      name:'Velora Sandbox Provider',
      type:'sandbox',
      mode:'local-test',
      description:'Public/open test provider contract for Velora client development.'
    },
    generatedAt:new Date().toISOString(),
    counts:{live:live.length,movies:movies.length,series:series.length},
    live,movies,series,
    recentlyAdded:{
      movies:movies.slice(0,24),
      series:series.slice(0,24)
    }
  };
}


let MEDIA_GRAPH_CACHE={at:0,payload:null};
try{
  const persisted=JSON.parse(fs.readFileSync(MEDIA_GRAPH_FILE,'utf8'));
  if(persisted?.provider?.id==='velora_unified')MEDIA_GRAPH_CACHE={at:Date.now(),payload:persisted};
}catch{}
function graphSource(item,fallbackName='Velora Source'){
  return {
    id:item.sourceId||item.providerId||slug(item.sourceName||fallbackName)||'source',
    name:item.sourceName||item.publisher||fallbackName,
    kind:item.youtubeId?'publisher-video':item.archiveId?'archive':item.type||'media',
    priority:Number(item.priority||50),
    playable:!!(item.youtubeId||item.archiveId||item.url||item.episodes?.length)
  };
}
function graphMerge(items,type){
  const map=new Map();
  for(const raw of items||[]){
    if(!raw)return;
    const item={...raw,type:raw.type||type};
    const key=catalogKey(item);
    const src=graphSource(item);
    const existing=map.get(key);
    if(!existing){
      map.set(key,{...item,sourcesGraph:[src]});
      continue;
    }
    existing.sourcesGraph=[...(existing.sourcesGraph||[]),src]
      .filter((x,i,a)=>a.findIndex(y=>y.id===x.id&&y.kind===x.kind)===i)
      .sort((a,b)=>b.priority-a.priority);
    if(Number(item.priority||0)>Number(existing.priority||0)){
      const keepSources=existing.sourcesGraph;
      Object.assign(existing,item,{sourcesGraph:keepSources});
    }
  }
  return [...map.values()];
}
async function buildUnifiedMediaGraph(force=false){
  if(!force&&MEDIA_GRAPH_CACHE.payload&&Date.now()-MEDIA_GRAPH_CACHE.at<10*60*1000)return MEDIA_GRAPH_CACHE.payload;
  try{
    const sandbox=await sandboxProviderPayload();
    const connectedMovies=db.catalog.filter(x=>x.type==='movie');
    const connectedSeries=db.catalog.filter(x=>x.type==='series');
    const movies=graphMerge([...sandbox.movies,...connectedMovies],'movie')
      .sort((a,b)=>String(b.publishedAt||b.year||'').localeCompare(String(a.publishedAt||a.year||'')));
    const series=graphMerge([...sandbox.series,...connectedSeries],'series')
      .sort((a,b)=>String(b.publishedAt||b.year||'').localeCompare(String(a.publishedAt||a.year||'')));
    const live=db.channels.slice().sort((a,b)=>(Number(b.priority||0)-Number(a.priority||0))||String(a.name).localeCompare(String(b.name)));
    const pubMovies=await publisherVod('movie');
    const pubSeries=await publisherVod('series');
    const payload={
      ok:true,
      stale:false,
      provider:{
        id:'velora_unified',
        name:'Velora Unified Provider',
        type:'media-graph',
        mode:'source-agnostic',
        description:'One normalized catalogue assembled from every active Velora adapter.'
      },
      adapters:[
        {id:'public-live',name:'Public Live TV',kind:'live',status:'active',items:live.length},
        {id:'publisher-vod',name:'Publisher Full Movies & Episodes',kind:'vod',status:'active',items:pubMovies.length+pubSeries.length},
        {id:'archive-vod',name:'Open Film & Classic TV Archive',kind:'vod',status:'active',items:sandbox.movies.filter(x=>x.archiveId).length+sandbox.series.filter(x=>x.archiveId).length},
        {id:'connected-providers',name:'Connected Provider Feeds',kind:'provider',status:db.catalog.length?'active':'ready',items:db.catalog.length}
      ],
      generatedAt:new Date().toISOString(),
      counts:{live:live.length,movies:movies.length,series:series.length,sources:movies.reduce((n,x)=>n+(x.sourcesGraph?.length||1),0)+series.reduce((n,x)=>n+(x.sourcesGraph?.length||1),0)},
      live,movies,series,
      recentlyAdded:{movies:movies.slice(0,30),series:series.slice(0,30)}
    };
    MEDIA_GRAPH_CACHE={at:Date.now(),payload};
    try{
      const tmp=MEDIA_GRAPH_FILE+'.tmp';
      fs.writeFileSync(tmp,JSON.stringify(payload));
      fs.renameSync(tmp,MEDIA_GRAPH_FILE);
    }catch(e){console.error('Media graph persistence failed',e.message)}
    return payload;
  }catch(e){
    if(MEDIA_GRAPH_CACHE.payload){
      return {...MEDIA_GRAPH_CACHE.payload,ok:true,stale:true,staleReason:String(e.message||e)};
    }
    throw e;
  }
}

async function publisherVod(kind){
  const sources=VOD_PUBLISHER_CHANNELS.filter(x=>x.kind===kind);
  const parts=await Promise.all(sources.map(async src=>{
    try{return await fetchPublisherFeed(src)}catch(e){console.error('Publisher feed failed:',src.name,e.message);return[]}
  }));
  return parts.flat().sort((a,b)=>String(b.publishedAt||'').localeCompare(String(a.publishedAt||'')));
}

const PUBLIC_DIRECT_OVERRIDES=[
  {
    id:'jm_tvj_direct',
    epgId:'TVJ.jm',
    name:'TVJ',
    group:'Jamaica',
    sourceName:'Television Jamaica',
    upstreamUrls:[
      'https://rjr-tvj-geo.akamaized.net/hls/live/2041530/TVJ_GEO/1/streamPlaylist.m3u8',
      'https://vod2live.univtec.com/manifest/a99a1804-dc83-411f-8c1c-b62f08cdfa59.m3u8',
      'https://fl5.moveonjoy.com/TVJ_CARIBBEAN/index.m3u8'
    ],
    territory:'WORLD',
    priority:99
  },
  {
    id:'jm_cvm_direct',
    epgId:'CVMTV.jm',
    name:'CVM Television',
    group:'Jamaica',
    sourceName:'CVM Television Jamaica',
    upstreamUrls:[
      'https://fl5.moveonjoy.com/CVM_TV_CARIBBEAN/index.m3u8',
      'https://fl1.moveonjoy.com/CVM_TV_CARIBBEAN/index.m3u8'
    ],
    territory:'WORLD',
    priority:98
  }
]

function upsertDirectOverrides(){
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
    const relayUrls=(o.upstreamUrls||[o.upstreamUrl]).filter(Boolean).map((_,i)=>'/api/public/fixed/'+encodeURIComponent(o.id)+'/'+i);
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
      url:relayUrls[0]||'',
      clientUrls:[...(o.upstreamUrls||[o.upstreamUrl]).filter(Boolean)],
      upstreamUrl:'',
      sourceId:providerId,
      sourceName:o.sourceName,
      priority:o.priority,
      territory:o.territory,
      sources:relayUrls.map((url,i)=>({
        providerId,
        providerName:provider.name,
        kind:'relay',
        url,
        streamId:o.id+':'+i,
        priority:o.priority-i,
        territory:o.territory,
        health:'unknown',
        lastChecked:null
      }))
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
  upsertDirectOverrides();
  console.log('Direct Jamaica overrides loaded:',PUBLIC_DIRECT_OVERRIDES.map(x=>x.name).join(', '));
  console.log('Public bootstrap complete:',JSON.stringify(computeStats()));
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




const PUBLIC_DISCOVERY_INDEXES=[
  {name:'IPTV-org',url:'https://iptv-org.github.io/iptv/index.m3u'},
  {name:'Free-TV/IPTV',url:'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8'}
];

let PUBLIC_INDEX_CACHE={at:0,text:''};
async function getFreshPublicIndex(){
  if(PUBLIC_INDEX_CACHE.text&&Date.now()-PUBLIC_INDEX_CACHE.at<5*60*1000)return PUBLIC_INDEX_CACHE.text;
  const parts=[];
  for(const src of PUBLIC_DISCOVERY_INDEXES){
    try{
      const body=await fetchText(src.url,MAX_PLAYLIST_BYTES);
      parts.push('#SOURCE:'+src.name+'\n'+body);
    }catch(e){
      console.error('Discovery index failed:',src.name,e.message);
    }
  }
  const textBody=parts.join('\n');
  PUBLIC_INDEX_CACHE={at:Date.now(),text:textBody};
  return textBody;
}
function normalizeChannelLookupName(name=''){
  return String(name).toLowerCase()
    .normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
    .replace(/\[[^\]]*\]|\([^)]*\)/g,' ')
    .replace(/\b(2160p|1080p|720p|576p|540p|480p|360p|4k|uhd|fhd|hd|sd|tv|television)\b/g,' ')
    .replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
}
function findFreshIndexSources(textBody,ch){
  const exactId=String(ch.epgId||'').toLowerCase();
  const wanted=normalizeChannelLookupName(ch.name||'');
  const lines=String(textBody||'').replace(/\r/g,'').split('\n');
  const matches=[];let meta=null;
  for(const raw of lines){
    const line=raw.trim();
    if(line.startsWith('#EXTINF:')){
      const attr={};for(const m of line.matchAll(/([\w-]+)="([^"]*)"/g))attr[m[1]]=m[2];
      const name=(line.split(',').slice(1).join(',')||attr['tvg-name']||'').trim();
      meta={id:String(attr['tvg-id']||'').toLowerCase(),name};
    }else if(line&&!line.startsWith('#')&&meta){
      const sameId=exactId&&meta.id===exactId;
      const sameName=wanted&&normalizeChannelLookupName(meta.name)===wanted;
      if((sameId||sameName)&&/^https?:\/\//i.test(line)&&!matches.includes(line))matches.push(line);
      meta=null;
    }
  }
  return matches;
}
async function discoverDynamicChannelSources(ch){
  const urls=[];
  const add=u=>{if(/^https?:\/\//i.test(String(u||''))&&!urls.includes(u))urls.push(u)};
  for(const u of channelPublicUpstreams(ch))add(u);
  try{
    const index=await getFreshPublicIndex();
    for(const u of findFreshIndexSources(index,ch))add(u);
  }catch(e){console.error('Fresh public index lookup failed:',ch.name,e.message)}
  return urls.slice(0,16);
}

const STREAM_RESOLVE_CACHE=new Map();
async function probeStream(url,timeoutMs=5000){
  const cached=STREAM_RESOLVE_CACHE.get(url);
  if(cached&&Date.now()-cached.at<90000)return cached.ok;
  let ok=false;
  const ac=new AbortController();
  const timer=setTimeout(()=>ac.abort(),timeoutMs);
  try{
    await assertSafeUrl(url);
    const r=await fetch(url,{
      method:'GET',
      headers:{range:'bytes=0-8191','user-agent':'Mozilla/5.0 VeloraTV/8'},
      signal:ac.signal,
      redirect:'follow'
    });
    if(r.ok){
      const ct=(r.headers.get('content-type')||'').toLowerCase();
      if(ct.includes('mpegurl')||/\.m3u8(?:$|\?)/i.test(r.url||url)){
        const body=await r.text();
        ok=body.includes('#EXTM3U');
      }else{
        const reader=r.body?.getReader();
        if(reader){
          const first=await reader.read();
          ok=!first.done&&!!first.value?.byteLength;
          try{await reader.cancel()}catch{}
        }else ok=true;
      }
    }
  }catch{}
  finally{clearTimeout(timer)}
  STREAM_RESOLVE_CACHE.set(url,{ok,at:Date.now()});
  return ok;
}
function channelPublicUpstreams(ch){
  const fixed=PUBLIC_DIRECT_OVERRIDES.find(x=>x.id===ch.id);
  if(fixed)return [...new Set((fixed.upstreamUrls||[fixed.upstreamUrl]).filter(Boolean))];
  const urls=[];
  const add=u=>{if(/^https?:\/\//i.test(String(u||''))&&!urls.includes(u))urls.push(u)};
  add(ch.upstreamUrl);
  for(const src of ch.sources||[])add(src.upstreamUrl||(/^https?:\/\//i.test(src.url||'')?src.url:''));
  return urls;
}
async function resolvePublicChannel(ch){
  const urls=await discoverDynamicChannelSources(ch);
  if(!urls.length)return [];
  const results=await pooled(urls,Math.min(6,urls.length),async u=>({url:u,ok:await probeStream(u,4500)}));
  return results.filter(x=>x.ok).map(x=>relayPath(x.url));
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
      out.push({id,num:String(out.length+1),name:meta.name,epgId:meta.epgId,group:meta.group,logo:meta.logo,now:'Live',url:publicRelay?('/api/public/channel/'+id):line,upstreamUrl:publicRelay?line:'',sourceId:provider.id,sourceName:provider.name,priority:Number(provider.priority||50),territory:provider.territory||'WORLD',sources:[{providerId:provider.id,providerName:provider.name,kind:'m3u',url:publicRelay?relayPath(line):line,upstreamUrl:publicRelay?line:'',priority:Number(provider.priority||50),territory:provider.territory||'WORLD',health:'unknown',lastChecked:null}]});
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
  if(req.method==='GET'&&p==='/api/provider/graph'){
    try{return json(res,200,await buildUnifiedMediaGraph(u.searchParams.get('refresh')==='1'))}catch(e){return json(res,502,{error:String(e.message||e)})}
  }
  if(req.method==='GET'&&p==='/api/sandbox/provider'){
    try{return json(res,200,await buildUnifiedMediaGraph(false))}catch(e){return json(res,502,{error:String(e.message||e)})}
  }
  if(req.method==='GET'&&p==='/api/vod/publishers'){
    const kind=u.searchParams.get('kind')==='series'?'series':'movie';
    const items=await publisherVod(kind);
    return json(res,200,{ok:true,kind,items,updatedAt:new Date().toISOString()});
  }
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

  const resolveMatch=p.match(/^\/api\/channel\/([^/]+)\/resolve$/);
  if(req.method==='GET'&&resolveMatch){
    const ch=db.channels.find(x=>x.id===decodeURIComponent(resolveMatch[1]));
    if(!ch)return json(res,404,{ok:false,error:'Channel not found'});
    const isPublic=String(ch.sourceId||'').startsWith('public_')||(ch.sources||[]).some(x=>String(x.providerId||'').startsWith('public_'));
    if(!isPublic){
      return json(res,200,{ok:true,urls:[ch.url].filter(Boolean),verified:false});
    }
    const urls=await resolvePublicChannel(ch);
    if(!urls.length)return json(res,404,{ok:false,error:'No responding source'});
    return json(res,200,{ok:true,urls,verified:true});
  }

  const fixedPublic=p.match(/^\/api\/public\/fixed\/([^/]+)\/(\d+)$/);
  if(req.method==='GET'&&fixedPublic){
    const id=decodeURIComponent(fixedPublic[1]);
    const idx=Number(fixedPublic[2]||0);
    const cfg=PUBLIC_DIRECT_OVERRIDES.find(x=>x.id===id);
    const target=cfg?.upstreamUrls?.[idx]||cfg?.upstreamUrl||'';
    if(!target)return json(res,404,{error:'Fixed public source not found'});
    return relayPublicUrl(req,res,target);
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
