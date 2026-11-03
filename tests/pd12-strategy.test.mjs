import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../src/lib');
const cache=new Map();
function load(name){
 if(cache.has(name))return cache.get(name);
 const exp={};cache.set(name,exp);
 const code=ts.transpileModule(fs.readFileSync(path.join(root,name+'.ts'),'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('exports','require',code)(exp,(dep)=>{
  if(!dep.startsWith('./'))throw Error('Unexpected dependency '+dep);
  return load(path.normalize(path.join(path.dirname(name),dep)));
 });
 return exp;
}
const planner=load('strategic-planner'),behavior=load('behavior'),mutation=load('mutation');
const plan=(approach='curiosity',extra={})=>({version:1,approach,
  exitMechanism:'concede',expectedExitSignal:'concede_approach',
  thesis:'Give visitors a reason to end the round.',assessment:'No departure signal yet.',
  changeReason:'Testing a distinct approach without assuming emotional state.',...extra});
function summary(clicks,near=0,linkHovers=0){
 return {...behavior.makeBehaviorCollector(1100).snapshot(),
   nearConcedeApproaches:near,
   sceneInteractions:[
    {exposure:1,id:'puzzle',clicks,hovers:clicks},
    {exposure:1,id:'exit',clicks:0,hovers:linkHovers}]};
}
const links=[{exposure:1,id:'exit'}];
test('PD12D validates strategic intent instead of generic engagement objectives',()=>{
 assert.equal(planner.validateStrategyPlan(plan()).approach,'curiosity');
 assert.equal(planner.validateStrategyPlan(plan('random-weirdness')),null);
 assert.equal(planner.validateStrategyPlan(plan('closure',{expectedExitSignal:'more_clicks'})),null);
 assert.equal(planner.validateStrategyPlan(plan('closure',{exitMechanism:'unrestricted_navigation'})),null);
 assert.equal(planner.validateStrategyPlan(plan('closure',{thesis:'x'.repeat(221)})),null);
 assert.equal(mutation.validateMutation({...mutation.BASE_MUTATION,plan:plan()}).plan.approach,'curiosity');
 assert.equal(mutation.validateMutation({...mutation.BASE_MUTATION,plan:plan('nonexistent')}),null);
});
test('PD12D treats engagement as activity, not progress toward exit',()=>{
 let state=null;
 for(let i=0;i<2;i++){
   const directive=planner.deriveStrategicDirective(state,summary(i+3),links);
   assert.equal(directive.evidence.linkHovers,0);
   assert.equal(directive.evidence.departureSignalDelta,0);
   state=planner.commitStrategy(state,plan(),directive);
 }
 const third=planner.deriveStrategicDirective(state,summary(10),links);
 assert.equal(third.pivotRequired,true);
 assert.equal(third.avoidApproach,'curiosity');
 assert.match(third.reason,/Abandon/);
 const pivot=planner.commitStrategy(state,plan('subtraction',{changeReason:'Remove entertainment; direct attention toward a real exit.'}),third);
 assert.equal(pivot.stalledCycles,0);
 assert.equal(pivot.pivots,1);
 assert.equal(planner.validateStrategyState(pivot)?.approach,'subtraction');
});
test('PD12D notes credible exit-proximity signals without claiming a victory',()=>{
 const first=planner.deriveStrategicDirective(null,summary(4),links);
 const state=planner.commitStrategy(null,plan('alternative'),first);
 const next=planner.deriveStrategicDirective(state,summary(10,1,2),links);
 assert.equal(next.evidence.nearConcedeApproaches,1);
 assert.equal(next.evidence.linkHovers,2);
 assert.equal(next.evidence.departureSignalDelta,3);
 assert.equal(next.pivotRequired,false);
 const advanced=planner.commitStrategy(state,plan('alternative'),next);
 assert.equal(advanced.stalledCycles,0);
 assert.equal(advanced.exitSignalCount,3);
 assert.equal(advanced.history.length,2);
});
test('PD12D bounds and validates durable strategic state',()=>{
 let state=null;
 for(let i=0;i<14;i++){
  const approach=i%2?'direct':'subtraction';
  const directive=planner.deriveStrategicDirective(state,summary(i),links);
  state=planner.commitStrategy(state,plan(approach),directive);
 }
 assert.equal(state.history.length,8);
 assert.equal(state.cycle,14);
 assert.ok(state.pivots>=10);
 assert.equal(planner.validateStrategyState(state)?.cycle,14);
 assert.equal(planner.validateStrategyState({...state,stalledCycles:-1}),null);
});
