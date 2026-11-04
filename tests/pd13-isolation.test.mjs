import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const source=fs.readFileSync(new URL('../src/lib/sandbox-world.ts',import.meta.url),'utf8');
const moduleCode=ts.transpileModule(source,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
}}).outputText;
const library={};
new Function('exports',moduleCode)(library);
const {validateWorld,worldDocument,WORLD_LIMITS}=library;
const fixture={version:1,html:'<main data-world-id="target">Hello</main>',
 css:'.target{color:cyan}',js:'document.body.dataset.ready="true";'};

test('PD13A accepts bounded model-authored markup, style and procedural code',()=>{
 assert.deepEqual(validateWorld(fixture),fixture);
 const document=worldDocument(fixture,'a'.repeat(48));
 assert.match(document,/sandbox world|<!doctype html>/i);
 assert.match(document,/default-src 'none'/);
 assert.match(document,/connect-src 'none'/);
 assert.match(document,/form-action 'none'/);
 assert.match(document,/worker-src 'none'/);
 assert.match(document,/frame-src 'none'/);
 assert.match(document,/data-world-id/);
 assert.match(document,/document.body.dataset.ready/);
});
test('PD13A enforces length and type bounds',()=>{
 assert.equal(validateWorld({...fixture,html:'a'.repeat(WORLD_LIMITS.html+1)}),null);
 assert.equal(validateWorld({...fixture,css:123}),null);
 assert.equal(validateWorld({...fixture,js:'x'.repeat(WORLD_LIMITS.js+1)}),null);
 assert.equal(validateWorld({...fixture,version:2}),null);
 assert.equal(validateWorld({...fixture,html:'a'+String.fromCharCode(0)}),null);
 assert.throws(()=>worldDocument(fixture,'weak'));
});
test('PD13A renderer is sandboxed, opaque-origin, never same-origin',()=>{
 const component=fs.readFileSync(new URL('../src/app/sandbox-world.tsx',import.meta.url),'utf8');
 assert.match(component,/sandbox="allow-scripts"/);
 assert.doesNotMatch(component,/allow-same-origin|allow-top-navigation|allow-popups/);
 assert.match(component,/event.source!==frame.current\?\.contentWindow/);
 assert.match(component,/event.origin!=='null'/);
 assert.match(component,/message.nonce!==nonce/);
});
test('PD13A world is not connected to game shell or model generation',()=>{
 const home=fs.readFileSync(new URL('../src/app/page.tsx',import.meta.url),'utf8');
 const mutate=fs.readFileSync(new URL('../src/app/api/mutate/route.ts',import.meta.url),'utf8');
 assert.doesNotMatch(home,/SandboxWorld|sandbox-world/);
 assert.doesNotMatch(mutate,/worldDocument|AuthoredWorld/);
});
