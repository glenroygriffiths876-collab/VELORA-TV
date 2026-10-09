// VELORA: cached published XMLTV guide data for programme search.
// Programme metadata does not grant stream rights or guarantee a broadcast.
const SOURCES=[
 'https://iptv-org.github.io/epg/guides/us/tvtv.us.epg.xml',
 'https://iptv-org.github.io/epg/guides/uk/ontvtonight.com.epg.xml',
 'https://iptv-org.github.io/epg/guides/br/mi.tv.epg.xml'
];
let cache=new Map(),updatedAt=0,sourceCount=0,pending=null,lastAttempt=0;
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
 .toLowerCase().replace(/\b(?:hd|sd|720p|1080p|4k)\b/g,'').replace(/[^a-z0-9]+/g,'');
const decode=s=>String(s||'').replace(/<[^>]+>/g,'').replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g,
 x=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' '})[x]||' ').trim().slice(0,240);
const attr=(s,n)=>new RegExp('(?:^|\\s)'+n+'="([^"]*)"').exec(s||'')?.[1]||'';
function date(s){
 const m=String(s||'').match(/^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)?\s*([+-]\d{4})?/);
 if(!m)return null;const z=m[7]||'+0000';
 const iso=m[1]+'-'+m[2]+'-'+m[3]+'T'+m[4]+':'+m[5]+':'+(m[6]||'00')+z.slice(0,3)+':'+z.slice(3);
 const t=Date.parse(iso);return Number.isFinite(t)?t:null;
}
function parse(xml){
 const alias=new Map(),channels=/<channel\b([^>]*)>([\s\S]*?)<\/channel>/gi;
 let match,n=0;while((match=channels.exec(xml))&&n++<4000){
   const id=attr(match[1],'id');
   if(!id)continue;alias.set(norm(id),id);
   const d=/<display-name\b[^>]*>([\s\S]*?)<\/display-name>/gi;
   let name;while((name=d.exec(match[2])))alias.set(norm(decode(name[1])),id);
 }
 const events=new Map(),regex=/<programme\b([^>]*)>([\s\S]*?)<\/programme>/gi;
 const now=Date.now();n=0;
 while((match=regex.exec(xml))&&n++<100000){
   const id=attr(match[1],'channel'),start=date(attr(match[1],'start'));
   const stop=date(attr(match[1],'stop'));
   if(!id||start===null||start>now+30*3600000||(stop||start+3600000)<now-3600000)continue;
   const t=/<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(match[2]);if(!t)continue;
   const title=decode(t[1]);if(!title)continue;
   const d=/<desc\b[^>]*>([\s\S]*?)<\/desc>/i.exec(match[2]);
   const item={title,description:d?decode(d[1]):'',startAt:new Date(start).toISOString(),
     endAt:new Date(stop||start+3600000).toISOString()};
   if(!events.has(id))events.set(id,[]);
   if(events.get(id).length<40)events.get(id).push(item);
 }
 const merged=new Map();for(const [id,items] of events){
   merged.set(norm(id),items);
 }
 for(const [name,id] of alias)if(events.has(id)&&!merged.has(name))merged.set(name,events.get(id));
 return merged;
}
async function download(url){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
 try{
   const response=await fetch(url,{signal:controller.signal});
   if(!response.ok)throw Error('HTTP '+response.status);
   const length=Number(response.headers.get('content-length')||0);
   if(length>30*1024*1024)throw Error('Guide too large');
   const chunks=[];let bytes=0;
   const reader=response.body.getReader();
   for(;;){const part=await reader.read();if(part.done)break;
     bytes+=part.value.length;if(bytes>30*1024*1024){await reader.cancel();throw Error('Guide size cap')}
     chunks.push(part.value);
   }
   const data=new Uint8Array(bytes);let at=0;for(const chunk of chunks){data.set(chunk,at);at+=chunk.length}
   return parse(new TextDecoder().decode(data));
 }finally{clearTimeout(timeout)}
}
function refresh(){
 if(pending)return pending;
 lastAttempt=Date.now();
 pending=Promise.all(SOURCES.map(url=>download(url).catch(e=>{
   console.warn('Public EPG source unavailable:',url.split('/').slice(-2).join('/'),e.message);return null;
 }))).then(parts=>{
   const good=parts.filter(Boolean);if(!good.length)return;
   const merged=new Map();for(const part of good)for(const [key,items] of part){
     const old=merged.get(key)||[];merged.set(key,[...old,...items].slice(0,40));
   }
   cache=merged;updatedAt=Date.now();sourceCount=good.length;
   console.log('VELORA EPG guide loaded:',good.length,'sources,',cache.size,'channel aliases');
 }).finally(()=>pending=null);
 return pending;
}
export function getProgrammeGuide(channels){
 if(Date.now()-updatedAt>3*3600000&&Date.now()-lastAttempt>15*60000)void refresh();
 const programmes={},wanted=Array.isArray(channels)?channels.slice(0,1300):[];
 for(const c of wanted){
   const id=String(c.id||'').slice(0,150),name=String(c.name||'').slice(0,150),epgId=String(c.epgId||'').slice(0,150);
   if(!id)continue;
   const found=[epgId,name,id].map(norm).map(k=>cache.get(k)).find(a=>a?.length);
   if(found)programmes[id]=found;
 }
 return {ok:true,updatedAt:updatedAt?new Date(updatedAt).toISOString():null,
   pending:!!pending,sources:sourceCount,matched:Object.keys(programmes).length,programmes};
}
