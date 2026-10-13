import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code=fs.readFileSync('ux-v20-instant-tv.js','utf8');
function harness(channels){
  const els=new Map(),listeners={},selection=[];
  const make=(id='')=>({id,innerHTML:'',textContent:'',hidden:false,dataset:{},value:'',
    setAttribute(){},scrollIntoView(){},classList:{contains:()=>true,toggle(){}},
    querySelector(sel){return els.get(sel.replace(/^#/,'').replace(/^(.*) /,''))||null}});
  const shell=make('veloraLiveSearchShell');
  shell.after=node=>{
    els.set(node.id,node);
    for(const id of ['veloraInstantCount','veloraInstantStatus','veloraInstantRows','veloraInstantMore']){
      els.set(id,make(id));
    }
  };
  els.set(shell.id,shell);
  els.set('view-live',make('view-live'));
  const document={
    getElementById:id=>els.get(id)||null,
    createElement:tag=>make(),
    addEventListener(name,fn){listeners[name]=fn},
    querySelectorAll(){return []},
    querySelector(){return {scrollIntoView(){}}}
  };
  let lastRendered=0,oldSnapshots=0;
  const context={document,window:null,state:{currentChannel:channels[0]},
    filteredChannels:()=>channels,
    v7SearchText:x=>String(x||'').toLowerCase(),
    renderLive(){lastRendered++},
    v7ApplySnapshot(){oldSnapshots++},
    setInterval(){},setTimeout(){}};
  context.window=context;
  context.veloraVerifiedChannels={ids:()=>[channels[0].id]};
  context.veloraSharedPool=new Map([[channels[1].id,{recent:true}]]);
  vm.createContext(context);vm.runInContext(code,context);
  context.renderLive();
  return {context,els,listeners,counts:()=>({rendered:lastRendered,snapshots:oldSnapshots})};
}
const channels=[
  {id:'tvj',name:'TVJ',group:'Jamaica'},
  {id:'sports',name:'Sports One',group:'Sports'},
  {id:'news',name:'News Live',group:'News'},
  ...Array.from({length:75},(_,i)=>({id:'other'+i,name:'Channel '+i,group:'Entertainment'}))
];
test('instant TV guide displays total catalogue at once but renders only a bounded first page',()=>{
 const h=harness(channels);
 assert.equal(h.els.get('veloraInstantCount').textContent,String(channels.length));
 const first=h.els.get('veloraInstantRows').innerHTML;
 assert.ok(first.includes('TVJ'));
 assert.ok(first.includes('Ready here'));
 assert.ok(first.includes('Recently played'));
 assert.ok(first.includes('Tap to try'));
 assert.ok(first.includes('Channel 56'));
 assert.ok(!first.includes('Channel 74'));
 assert.equal(h.els.get('veloraInstantMore').hidden,false);
 assert.equal(h.context.state.currentChannel.id,'tvj');
 h.listeners.click({target:{id:'veloraInstantMore',closest:()=>null}});
 assert.ok(h.els.get('veloraInstantRows').innerHTML.includes('Channel 74'));
});
test('instant TV guide supports network search and category filters without changing the playing channel',()=>{
 const h=harness(channels);
 h.listeners.input({target:{id:'veloraInstantSearch',value:'Sports'}});
 let html=h.els.get('veloraInstantRows').innerHTML;
 assert.match(html,/Sports One/);
 assert.ok(!html.includes('News Live'));
 h.listeners.input({target:{id:'veloraInstantSearch',value:''}});
 h.listeners.click({target:{id:'',closest:s=>s==='[data-instant-group]'?{dataset:{instantGroup:'News'}}:null}});
 html=h.els.get('veloraInstantRows').innerHTML;
 assert.match(html,/News Live/);
 assert.ok(!html.includes('Sports One'));
 assert.equal(h.context.state.currentChannel.id,'tvj');
});
test('HTML entities in provider names remain escaped and background snapshots never tune the player',()=>{
 const h=harness([{id:'tvj',name:'TVJ'}, {id:'bad',name:'<img onerror=alert(1) />'}]);
 assert.match(h.els.get('veloraInstantRows').innerHTML,/&lt;img/);
 assert.doesNotMatch(h.els.get('veloraInstantRows').innerHTML,/<img/);
 h.context.v7ApplySnapshot({channels:[{id:'other'}]});
 assert.equal(h.counts().snapshots,1);
 assert.equal(h.context.state.currentChannel.id,'tvj');
});
