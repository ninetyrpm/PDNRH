import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';

const folder=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../src/lib');
function load(name){
 const js=ts.transpileModule(fs.readFileSync(path.join(folder,name+'.ts'),'utf8'),{
   compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
 }).outputText;
 const value={};new Function('exports','require',js)(value,()=>{throw Error('Unexpected dependency')});
 return value;
}
const compact=load('pd12d-compact');
test('PD12D.1 uses a generation window adequate for structured plans',()=>{
 assert.ok(compact.PD12D_TIMEOUT_MS>=30000);
 assert.ok(compact.PD12D_MAX_TOKENS>=2000);
 assert.ok(compact.PD12D_MAX_TOKENS<4200);
 assert.match(compact.PD12D_SYSTEM,/scenePatch/);
 assert.match(compact.PD12D_SYSTEM,/plan/);
 assert.match(compact.PD12D_SYSTEM,/reflex/);
 assert.match(compact.PD12D_SYSTEM,/one JSON object/);
 assert.match(compact.PD12D_SYSTEM,/departure/);
});
test('PD12D.1 input includes bounded history and does not duplicate instructions',()=>{
 const input=compact.compactPd12dContext({
  elapsedSeconds:27,step:3,assignedTactic:{family:'closure_frame',version:1,instruction:'Gentle closure'},
  behavior:{version:1},previousStrategy:{approach:'closure'},directive:{pivotRequired:true},
  previousWorld:{composition:'mosaic'},
  lastMutations:Array.from({length:10},(_,i)=>({ordinal:i})),
  previousTest:{met:false}
 });
 assert.deepEqual(input.recentMutations.map(m=>m.ordinal),[7,8,9]);
 assert.equal(input.directive.pivotRequired,true);
 assert.equal(input.tactic.family,'closure_frame');
 assert.equal(JSON.stringify(input).includes('creativeInstruction'),false);
});
test('PD12D.1 provider code selects compact prompt only for the new engine',()=>{
 const route=fs.readFileSync(new URL('../src/app/api/mutate/route.ts',import.meta.url),'utf8');
 assert.match(route,/pd12d\?PD12D_TIMEOUT_MS:12000/);
 assert.match(route,/max_completion_tokens:pd12d\?PD12D_MAX_TOKENS:3300/);
 assert.match(route,/content:PD12D_SYSTEM/);
 assert.match(route,/compactPd12dContext/);
 assert.match(route,/provider_completed/);
});
