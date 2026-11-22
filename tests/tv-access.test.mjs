import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const bridge=fs.readFileSync(new URL('../tv-access.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const auth=fs.readFileSync(new URL('../auth-client.js',import.meta.url),'utf8');
const server=fs.readFileSync(new URL('../server.mjs',import.meta.url),'utf8');

test('TV remote bridge remains compatible with older browsers',()=>{
  assert.doesNotMatch(bridge,/\b(?:const|let|async)\b|=>|\?\.|\?\?/);
  assert.ok(html.indexOf('tv-access.js?v=3')<html.indexOf('app.js?v=4'));
  assert.ok(sw.includes('velora-shell-v79'));
});
test('free viewing does not show registration and admin login stays protected',()=>{
  assert.ok(html.includes('id="login" class="loginShell hidden"'));
  assert.ok(html.includes('id="loginForm" onsubmit="return false"'));
  assert.ok(!html.includes('id="registerForm"'));
  assert.ok(!html.includes('id="showRegister"'));
  assert.ok(!html.includes('Private preview:'));
  assert.ok(auth.includes('admin=1'));
  assert.ok(auth.includes("id:'public-viewer',name:'Viewer',role:'guest'"));
  assert.ok(server.includes("p==='/api/auth/register')return json(res,410"));
  assert.ok(server.includes("user.role!=='admin'"));
});
