import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const component=fs.readFileSync(new URL('../src/app/sandbox-world.tsx',import.meta.url),'utf8');
test('PD13B frame is explicitly stoppable and bounded by a lifecycle watchdog',()=>{
 assert.match(component,/MAX_FRAME_LIFETIME_MS=120000/);
 assert.match(component,/STARTUP_DEADLINE_MS=8000/);
 assert.match(component,/setActive\(false\)/);
 assert.match(component,/RESTART FRAME/);
 assert.match(component,/STOP FRAME/);
 assert.match(component,/unresponsive/);
 assert.match(component,/expired/);
});
test('PD13B every frame instance has a fresh nonce and enforced opaque origin',()=>{
 assert.match(component,/crypto.getRandomValues/);
 assert.match(component,/key=\{nonce\}/);
 assert.match(component,/event.origin!=='null'/);
 assert.match(component,/event.source!==frame.current\?\.contentWindow/);
 assert.match(component,/sandbox="allow-scripts"/);
 assert.doesNotMatch(component,/allow-same-origin|allow-top-navigation|allow-popups/);
});
test('PD13B focus reporting does not modify protected round-loss authority',()=>{
 assert.match(component,/Frame focus:/);
 assert.match(component,/onFocus=\{\(\)=>setFrameFocused\(true\)\}/);
 const session=fs.readFileSync(new URL('../src/app/legacy/page.tsx',import.meta.url),'utf8');
 assert.match(session,/const onBlur=\(\)=>lose\('blur'\)/);
 assert.doesNotMatch(session,/SandboxWorld/);
 const pd13=fs.readFileSync(new URL('../src/app/pd13-game.tsx',import.meta.url),'utf8');
 assert.match(pd13,/document.hasFocus\(\)/);
 assert.match(pd13,/document.hidden/);
});
