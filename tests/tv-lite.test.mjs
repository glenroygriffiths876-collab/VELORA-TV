import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const js=fs.readFileSync(new URL('../tv-lite.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../tv-lite.html',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');

function boot({savedToken='shared-profile-token', failMe=false}={}) {
  const listeners={}, storage=new Map(), calls=[];
  if(savedToken)storage.set('velora_auth_token',savedToken);
  function node(id=''){
    const n={
      id,tagName:'BUTTON',type:'button',className:'',style:{},value:'',children:[],attributes:{},
      disabled:false,offsetWidth:400,offsetHeight:48,
      appendChild(child){this.children.push(child);return child},
      removeChild(child){this.children.splice(this.children.indexOf(child),1)},
      get firstChild(){return this.children[0]||null},
      setAttribute(k,v){this.attributes[k]=v},
      getAttribute(k){return this.attributes[k]},
      focus(){},
      scrollIntoView(){},
      addEventListener(type,handler){listeners[id+':'+type]=handler},
      querySelector(){return {disabled:false}},
      pause(){},load(){},play(){this.plays=(this.plays||0)+1},removeAttribute(k){if(k==='src')this.src=''}
    };
    return n;
  }
  const ids=['auth','loginFormLite','registration','loginIdentity','loginPass','regName',
   'regUser','regEmail','regPass','authStatus','viewer','viewerName','catalogueStatus',
   'channelList','channelCount','showMore','searchChannels','playerArea','nowPlaying','tvVideo',
   'playStatus','sourceInfo','officialLink','tvPlay','trySource','tvFull','signOut','showRegistration','backLogin'];
  const elements={};
  for(const id of ids)elements[id]=node(id);
  for(const id of ['loginIdentity','loginPass','regName','regUser','regEmail','regPass','searchChannels']) elements[id].tagName='INPUT';
  const document={
    readyState:'complete',
    getElementById:id=>elements[id]||null,
    createElement:tag=>{const e=node();e.tagName=tag.toUpperCase();return e},
    createTextNode:text=>({textContent:text}),
    addEventListener:(type,handler)=>{listeners['document:'+type]=handler},
    querySelectorAll:()=>[],
    activeElement:null
  };
  class XMLHttpRequest {
    open(method,url){this.method=method;this.url=url}
    setRequestHeader(){}
    send(body){
      calls.push({method:this.method,url:this.url,body});
      this.readyState=4;
      if(failMe && this.url.includes('/api/auth/me')) {
        this.status=401;this.responseText=JSON.stringify({error:'Session expired'});
      } else {
        this.status=200;
        this.responseText=JSON.stringify(this.url.includes('/api/live/lineup')
          ? {channels:[
              {id:'other',name:'Another Channel',group:'Other',url:'/api/public/relay?token=other'},
              {id:'jm_tvj_direct',name:'TVJ',group:'Jamaica',url:'/api/public/fixed/jm_tvj_direct/0',
               sources:[{url:'/api/public/fixed/jm_tvj_direct/1'}]}
            ]}
          : {user:{name:'Dad',username:'daduser'},token:'new-token'});
      }
      this.onreadystatechange();
    }
  }
  const localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
  const sandbox={document,navigator:{userAgent:'JVC TV'},localStorage,XMLHttpRequest,Date,Math,JSON,Error,
    setTimeout:()=>1,clearTimeout:()=>{},window:{},location:{}};
  sandbox.window=sandbox;
  vm.runInNewContext(js,sandbox,{filename:'tv-lite.js'});
  return {elements,storage,calls,listeners};
}

test('standalone TV page is deployable without modern app bundles',()=>{
  assert.match(index,/tv-lite\.html\?tv=1/);
  assert.match(html,/<script src="tv-lite\.js\?v=1"><\/script>/);
  assert.match(sw,/tv-lite\.html/);
  assert.match(sw,/tv-lite\.js\?v=1/);
  assert.doesNotMatch(html,/app\.js|auth-client\.js|real-v7-ingest\.js/);
  assert.doesNotMatch(js,/\b(?:const|let|async)\b|=>|\?\.|\?\?/);
});
test('saved profile restores on Lite, opens independent viewer and makes TVJ first',()=>{
  const h=boot();
  assert.equal(h.elements.viewer.style.display,'block');
  assert.equal(h.elements.viewerName.textContent,'Dad');
  assert.match(h.elements.catalogueStatus.textContent,/2 channels/);
  assert.equal(h.elements.nowPlaying.textContent,'TVJ');
  assert.equal(h.elements.channelList.children[0].getAttribute('data-id'),'jm_tvj_direct');
  assert.equal(h.elements.playerArea.className,'panel playerpanel visible');
  assert.equal(h.elements.tvVideo.src,'');
  assert.ok(h.calls.some(x=>x.url.endsWith('/api/auth/me')));
  assert.ok(h.calls.some(x=>x.url.endsWith('/api/live/lineup')));
});
test('play stays on chosen channel and uses backend relay source',()=>{
  const h=boot();
  h.elements.tvPlay.onclick();
  assert.equal(h.elements.tvVideo.src,'https://velora-tv-api-production.up.railway.app/api/public/fixed/jm_tvj_direct/0');
  h.elements.trySource.onclick();
  assert.equal(h.elements.tvVideo.src,'https://velora-tv-api-production.up.railway.app/api/public/fixed/jm_tvj_direct/1');
  h.elements.trySource.onclick();
  assert.match(h.elements.playStatus.textContent,/No source produced playable video/);
  assert.equal(h.elements.nowPlaying.textContent,'TVJ');
});
test('no saved session shows standalone sign-in, and TV can log in',()=>{
  const h=boot({savedToken:''});
  assert.equal(h.elements.auth.style.display,'block');
  h.elements.loginIdentity.value='daduser';h.elements.loginPass.value='securepassword';
  h.elements.loginFormLite.onsubmit({preventDefault(){}});
  assert.equal(h.storage.get('velora_auth_token'),'new-token');
  assert.equal(h.elements.viewer.style.display,'block');
  assert.ok(h.calls.some(x=>x.url.endsWith('/api/auth/login')));
});
test('expired sessions do not bypass authentication',()=>{
  const h=boot({failMe:true});
  assert.equal(h.storage.has('velora_auth_token'),false);
  assert.equal(h.elements.auth.style.display,'block');
  assert.notEqual(h.elements.viewer.style.display,'block');
});
