// VELORA V19: search channels or actual programme-guide listings.
// A channel is never represented as carrying a game without matching EPG data.
(() => {
 'use strict';
 const norm=s=>String(s||'').trim().toLowerCase();
 const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function guideEntries(c) {
   if(!c)return [];
   const epg=state.epg||{},keys=[c.epgId,c.tvgId,c.id,c.name,c.short].filter(Boolean);
   const seen=new Set(),out=[];
   for(const key of keys){
     const entries=epg[key]||epg[norm(key)];
     if(!Array.isArray(entries))continue;
     for(const p of entries){
       if(!p?.title)continue;
       const id=String(p.title)+'|'+String(p.startAt||p.time||'');
       if(seen.has(id))continue;
       seen.add(id);out.push(p);
     }
   }
   // Do not claim a generic "Live" label is a programme title.
   const now=String(c.programTitle||c.now||'').trim();
   if(now&&!/^(live|live tv|live programming|live broadcast|unknown)$/i.test(now))
     out.push({title:now,description:'',now:true});
   return out;
 }
 function lookup(c,q) {
   const query=norm(q);
   if(query.length<2)return null;
   const tokens=query.split(/\s+/).filter(Boolean),now=Date.now();
   const results=guideEntries(c).map(p=>{
     const title=String(p.title||'');
     const hay=norm(title+' '+String(p.description||''));
     if(!tokens.every(token=>hay.includes(token)))return null;
     const from=p.startAt?Date.parse(p.startAt):0,to=p.endAt?Date.parse(p.endAt):0;
     let rank=1,label='GUIDE LISTING • AIRTIME UNCONFIRMED';
     if(p.now || (from&&to&&from<=now&&to>now)){rank=3;label='ON NOW'}
     else if(from>now&&from<now+24*3600000){rank=2;label='UPCOMING'}
     else if((to&&to<now)||(from&&from>=now+24*3600000))return null;
     return {title,rank,label,startAt:p.startAt||'',description:String(p.description||'')};
   }).filter(Boolean).sort((a,b)=>b.rank-a.rank);
   return results[0]||null;
 }
 window.veloraProgrammeLookup=lookup;
 const original=v7LiveMatches;
 v7LiveMatches=function(q='') {
   const direct=original(q),query=norm(q);
   if(query.length<2)return direct;
   const verified=new Set(window.veloraVerifiedChannels?.ids?.()||[]);
   const group=state.currentFilter||'All';
   const matches=filteredChannels()
     .filter(c=>verified.has(c.id)&&(group==='All'||c.group===group)&&lookup(c,query))
     .map(c=>({c,p:lookup(c,query)}))
     .sort((a,b)=>b.p.rank-a.p.rank)
     .map(row=>row.c);
   const result=[],seen=new Set();
   for(const c of [...matches,...direct]) {
     if(seen.has(c.id))continue;
     result.push(c);seen.add(c.id);
   }
   return result;
 };
 drawChannelList=function(q='') {
   const listEl=document.getElementById('channelList');
   if(!listEl)return;
   const all=v7LiveMatches(q),items=all.slice(0,250);
   const html=items.map(c=>{
     const p=lookup(c,q);
     const desc=p?
       '<small class="veloraProgrammeResult">'+e(p.label)+' • '+e(p.title)+'</small>':
       '<small>'+e(c.group||'Live TV')+'</small>';
     return '<button class="channelRow '+(state.currentChannel?.id===c.id?'active':'')+
       '" data-channel="'+e(c.id)+'" type="button">'+
       '<span class="channelLogo textLogo">'+e(c.short||'TV')+'</span>'+
       '<span><b>'+e(c.name)+'</b>'+desc+'</span>'+
       '<span class="channelNum">'+e(c.num||'')+'</span></button>';
   }).join('');
   listEl.innerHTML=html+(all.length>items.length?
     '<p class="veloraProgrammeEmpty">Showing '+items.length+' of '+all.length+
     ' matches. Narrow your search to see more.</p>':'');
   if(!items.length)listEl.innerHTML='<div class="veloraProgrammeEmpty">'+
     (norm(q).length>=2?
       'No matching channels or confirmed programme listings. Match searches need broadcaster EPG data.':
       'No verified channels found yet.')+'</div>';
 };
})();
