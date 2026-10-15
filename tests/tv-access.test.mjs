import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const bridge = fs.readFileSync(new URL('../tv-access.js', import.meta.url), 'utf8');
const tvMode = fs.readFileSync(new URL('../tv-mode.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../auth.css', import.meta.url), 'utf8');

function harness({ tv = true, modernClient = true, networkError = false, player = true } = {}) {
  const handlers = {};
  const storage = new Map();
  const cls = () => ({add() {},remove() {}});
  const nodes = {};
  let active;
  const make = (id, top, tagName = 'INPUT', rectWidth = 400) => ({
    id,tagName,disabled:false,value:'',style:{},classList:cls(),
    getBoundingClientRect(){return {left:100,top,width:rectWidth,height:55,right:100+rectWidth,bottom:top+55}},
    focus(){active=this},scrollIntoView(){this.wasScrolled=true},
    setAttribute(key,val){this[key]=val},
    getAttribute(key){return this[key]},
    querySelector(){return null}
  });
  const email=nodes.loginEmail=make('loginEmail',150);
  const pass=nodes.loginPassword=make('loginPassword',230);
  const sign=make('signIn',310,'BUTTON');
  const create=make('showRegister',920,'A'); // intentionally below screen
  nodes.showRegister=create;
  const name=nodes.registerName=make('registerName',140);
  nodes.registerUsername=make('registerUsername',220);
  nodes.registerEmail=make('registerEmail',300);
  nodes.registerPassword=make('registerPassword',380);
  const regSubmit=make('regSubmit',460,'BUTTON');
  nodes.loginForm={id:'loginForm',querySelector:()=>sign,classList:cls()};
  nodes.registerForm={id:'registerForm',querySelector:()=>regSubmit,classList:cls()};
  nodes.loginAuthStatus=make('loginAuthStatus',420,'DIV');
  nodes.registerAuthStatus=make('registerAuthStatus',510,'DIV');
  nodes.login=make('login',0,'DIV',900);
  nodes.login.querySelectorAll=()=>[email,pass,sign,create];
  let entered=null;
  const doc={
    readyState:'loading',body:{classList:cls()},documentElement:{classList:cls()},
    getElementById:(id)=>nodes[id]||null,
    get activeElement(){return active},
    addEventListener:(name,cb)=>{(handlers[name] ||= []).push(cb)},
    createEvent:()=>({initEvent(name){this.type=name}}),
    dispatchEvent:(ev)=>{for(const cb of handlers[ev.type]||[])cb(ev)}
  };
  const localStorage={
    getItem:(k)=>storage.get(k)||null,
    setItem:(k,v)=>storage.set(k,v),
    removeItem:(k)=>storage.delete(k)
  };
  class XMLHttpRequest {
    open(method,url){this.method=method;this.url=url}
    setRequestHeader(){}
    send(body){
      this.sent=body;
      if(networkError){this.status=0;this.readyState=4;this.responseText='';}
      else {
        this.status=200;this.readyState=4;
        this.responseText=JSON.stringify({token:'test-token',user:{id:'test-id',name:'Dad',role:'user'}});
      }
      this.onreadystatechange();
    }
  }
  const w={
    document:doc,localStorage,navigator:{userAgent:tv?'JVC Smart TV Browser':'Mozilla/5.0'},
    location:{search:tv?'?tv=1':''},getComputedStyle:()=>({display:'block',visibility:'visible'}),
    XMLHttpRequest,Date,Math,JSON,
    veloraEnterApp:player?(user)=>{entered=user}:undefined,
    addEventListener(){},setTimeout(){}
  };
  if(modernClient)w.VeloraAuth={};
  w.window=w;
  vm.runInNewContext(bridge,w,{filename:'tv-access.js'});
  const dispatch=(type,e)=>{const event={type,...e,defaultPrevented:false,
      preventDefault(){this.defaultPrevented=true},stopImmediatePropagation(){this.stopped=true}};
    for(const fn of handlers[type]||[]){fn(event);if(event.stopped)break}
    return event;
  };
  return {nodes,storage,dispatch,focus:(el)=>{active=el},get active(){return active},get entered(){return entered}};
}

test('TV bridge stays legacy syntax compatible and is loaded before modern bundles',()=>{
  assert.doesNotMatch(bridge,/\b(?:const|let|async)\b|=>|\?\.|\?\?/);
  assert.ok(html.indexOf('tv-access.js?v=2')<html.indexOf('app.js?v=3'));
  assert.match(html,/id="loginForm" onsubmit="return false"/);
  assert.match(html,/id="registerForm" class="hidden" onsubmit="return false"/);
  assert.match(sw,/tv-access.js\?v=2/);
  assert.match(sw,/velora-shell-v76/);
});
test('TV remote can navigate to Create Profile even below viewport',()=>{
  const h=harness();
  h.focus(h.nodes.loginEmail);
  for(let i=0;i<3;i++){
    const e=h.dispatch('keydown',{key:'ArrowDown'});
    assert.equal(e.defaultPrevented,true);
  }
  assert.equal(h.active,h.nodes.showRegister);
  assert.equal(h.nodes.showRegister.wasScrolled,true);
  assert.match(tvMode,/Buttons below the viewport must remain reachable/);
});
test('TV login uses fallback without refresh even when modern client is present',()=>{
  const h=harness();
  h.nodes.loginEmail.value='daduser';
  h.nodes.loginPassword.value='password123';
  const e=h.dispatch('submit',{target:h.nodes.loginForm});
  assert.equal(e.defaultPrevented,true);
  assert.equal(h.storage.get('velora_auth_token'),'test-token');
  assert.equal(h.entered.name,'Dad');
});
test('TV authentication errors are visible and do not submit the page',()=>{
  const h=harness({networkError:true});
  const e=h.dispatch('submit',{target:h.nodes.loginForm});
  assert.equal(e.defaultPrevented,true);
  assert.match(h.nodes.loginAuthStatus.textContent,/TV browser could not connect/);
  assert.equal(h.storage.get('velora_auth_token'),undefined);
});
test('Unsupported TV player shows a clear message instead of blank login',()=>{
  const h=harness({player:false});
  const e=h.dispatch('submit',{target:h.nodes.loginForm});
  assert.equal(e.defaultPrevented,true);
  assert.match(h.nodes.loginAuthStatus.textContent,/TV browser cannot start/);
});
test('Phone sign-in stays on existing modern authentication path',()=>{
  const h=harness({tv:false,modernClient:true});
  const e=h.dispatch('submit',{target:h.nodes.loginForm});
  assert.equal(e.defaultPrevented,false);
  assert.equal(h.storage.get('velora_auth_token'),undefined);
});

test('Create Profile is a native, bright and focusable link—not a dim disabled button',()=>{
  assert.match(html,/<a class="authCreateLink wide" id="showRegister" href="#create-profile" tabindex="0">/);
  assert.doesNotMatch(html,/<button[^>]*id="showRegister"/);
  assert.match(css,/\.authCreateLink\{[^}]*border:2px solid #c8c7ff/);
  assert.match(css,/\.authCreateLink:focus/);
  assert.match(css,/#create-profile:target ~ #login #registerForm\{display:flex!important\}/);
  assert.match(css,/#create-profile:target ~ #login #loginForm\{display:none!important\}/);
  assert.match(html,/<a class="authBackLink wide" id="showLogin" href="#sign-in"/);
});
test('Create Profile opens registration through the early TV compatibility handler',()=>{
  const h=harness();
  const e=h.dispatch('click',{target:h.nodes.showRegister});
  // Native link is allowed to follow #create-profile so CSS :target works without JS too.
  assert.equal(e.defaultPrevented,false);
});
