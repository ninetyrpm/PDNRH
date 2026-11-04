import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const cache=new Map();
function load(name){
 if(cache.has(name))return cache.get(name);
 const module={};cache.set(name,module);
 const source=fs.readFileSync(new URL('../src/lib/'+name+'.ts',import.meta.url),'utf8');
 const js=ts.transpileModule(source,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
 }}).outputText;
 new Function('exports','require',js)(module,dependency=>{
  if(!dependency.startsWith('./'))throw Error('Invalid dependency');
  return load(dependency.slice(2));
 });
 return module;
}
const planner=load('lab-strategy');
const world={version:1,html:'<div id="stage">Hello</div>',css:'#stage{color:teal}',js:'let counter=0;'};
const plan=(approach='curiosity')=>({version:1,approach,
 hypothesis:'Reduced engagement may make departure more attractive.',
 intendedDepartureSignal:'A click on an exit-labelled control.',
 observation:'Many clicks but no exit-labelled activation.',
 changeReason:'Change the interaction, not the fictional characters.'});
const entry=(approach='curiosity')=>({plan:plan(approach),exitProxyCount:0,
 engagementCount:8,changedSourceCharacters:250});
const obs={clicks:{basin:10},readyCount:1,elapsedSeconds:46};
test('PD13D separates engagement from inert exit-labelled proxies',()=>{
 const directive=planner.summarizeLabDirective([],obs);
 assert.equal(directive.engagementClicks,10);
 assert.equal(directive.exitProxies,0);
 assert.equal(directive.pivotRequired,false);
 assert.equal(planner.summarizeLabDirective([],{
  clicks:{basin:8,exit:1},readyCount:1,elapsedSeconds:30
 }).exitProxies,1);
});
test('PD13D requires a different approach after repeated barren cycles',()=>{
 const directive=planner.summarizeLabDirective([entry(),entry('closure')],obs);
 assert.equal(directive.pivotRequired,true);
 assert.equal(directive.avoidApproach,'closure');
 const raw={plan:plan('closure'),
  revision:{version:1,rationale:'Copy shift',html:'<div>Goodbye</div>'}};
 assert.equal(planner.compileStrategicRevision(world,raw,directive),null);
});
test('PD13D rejects label-only pivots but accepts source-changing interventions',()=>{
 const directive=planner.summarizeLabDirective([entry(),entry('closure')],obs);
 const cosmetic={plan:plan('subtraction'),
  revision:{version:1,rationale:'Different words',css:'#stage{color:red}'}};
 assert.equal(planner.compileStrategicRevision(world,cosmetic,directive),null);
 const material={plan:plan('subtraction'),
  revision:{version:1,rationale:'Reorganize the interactive scene',
   js:'const stage=document.getElementById("stage");'+
   'stage.addEventListener("click",()=>{stage.textContent="The page is complete";});'+
   'window.PDNRH_EXPORT_STATE=()=>({phase:"complete"});'}};
 const result=planner.compileStrategicRevision(world,material,directive);
 assert.ok(result);
 assert.ok(result.changedSourceCharacters>=80);
 assert.equal(result.plan.approach,'subtraction');
});
test('PD13D invalid plans and unbounded history are rejected',()=>{
 assert.equal(planner.validateLabPlan({...plan(),approach:'unknown'}),null);
 assert.equal(planner.validateHistory(Array.from({length:9},()=>entry())),null);
 assert.equal(planner.validateHistory([{...entry(),exitProxyCount:-1}]),null);
});
test('PD13D route is admin-only and separate from production game decisions',()=>{
 const endpoint=fs.readFileSync(new URL('../src/app/api/sandbox-lab/strategize/route.ts',import.meta.url),'utf8');
 const client=fs.readFileSync(new URL('../src/app/sandbox-lab/lab-client.tsx',import.meta.url),'utf8');
 const game=fs.readFileSync(new URL('../src/app/page.tsx',import.meta.url),'utf8');
 assert.match(endpoint,/observatoryAuthorized\(\)/);
 assert.match(endpoint,/compileStrategicRevision/);
 assert.match(client,/STRATEGIC REVISION/);
 assert.match(client,/Strategic decisions/);
 assert.doesNotMatch(game,/strategize|SandboxWorld/);
});
