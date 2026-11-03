import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../src/lib');
const cache=new Map();
function load(name){
  if(cache.has(name)) return cache.get(name);
  const filename=path.join(root,name+'.ts');
  const compiled=ts.transpileModule(fs.readFileSync(filename,'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
  }).outputText;
  const output={};cache.set(name,output);
  new Function('exports','require',compiled)(output,(dep)=>{
    if(!dep.startsWith('./'))throw new Error('Unexpected import: '+dep);
    return load(path.normalize(path.join(path.dirname(name),dep)));
  });
  return output;
}
const scene=load('scene');
const mutation=load('mutation');
const behavior=load('behavior');
const context=load('adversary-context');

const block=(overrides={})=>({
  id:'curiosity',kind:'button',text:'Inspect this',detail:'You found the clue.',
  action:'reveal',size:'md',align:'center',effect:'pulse',...overrides
});
const makeScene=(blocks=[block()])=>({
  version:1,composition:'scatter',accent:'lime',blocks
});
test('valid scene can be validated and serialized without code',()=>{
  const result=scene.validateScene(makeScene());
  assert.equal(result.blocks.length,1);
  assert.deepEqual(Object.keys(result.blocks[0]).sort(),
    ['id','kind','text','detail','align','size','effect','action'].sort());
});
test('only buttons can cause even bounded interactions',()=>{
  assert.equal(scene.validateScene(makeScene([block({kind:'heading',action:'concede'})])),null);
  assert.equal(scene.validateScene(makeScene([block({action:'reveal',detail:''})])),null);
});
test('reject duplicate IDs, scripts, URLs, and excessive content',()=>{
  assert.equal(scene.validateScene(makeScene([block(),block()])),null);
  assert.equal(scene.validateScene(makeScene([block({text:'<script>alert(1)</script>'})])),null);
  assert.equal(scene.validateScene(makeScene([block({text:'https://outside.example'})])),null);
  assert.equal(scene.validateScene(makeScene(Array.from({length:13},(_,i)=>block({id:'block'+i})))),null);
});
test('legacy mutation survives while structured metadata is bounded',()=>{
  const plain=mutation.validateMutation(mutation.BASE_MUTATION);
  assert.equal(plain.strategy,'baseline');
  const rich=mutation.validateMutation({...mutation.BASE_MUTATION,
    scene:makeScene(),hypothesis:'Visitor approached a button twice.',
    expectedReaction:'Another near-button approach.'});
  assert.equal(rich.scene.blocks[0].id,'curiosity');
  assert.equal(rich.hypothesis,'Visitor approached a button twice.');
  assert.equal(mutation.validateMutation({...mutation.BASE_MUTATION,hypothesis:'x'.repeat(221)}),null);
});
test('aggregate behavior never serializes pointer coordinates',()=>{
  const collector=behavior.makeBehaviorCollector(1280);
  collector.pointer(20,40);
  collector.pointer(50,40,{left:60,right:100,top:20,bottom:60});
  collector.scroll(100);collector.scroll(150);collector.scroll(90);
  const summary=collector.snapshot();
  assert.equal(summary.version,1);
  assert.equal(summary.nearConcedeApproaches,1);
  assert.equal(summary.scrollReversals,1);
  assert.equal(Object.prototype.hasOwnProperty.call(summary,'x'),false);
  assert.equal(behavior.validateBehavior({...summary,pointerTravelPx:-1}),null);
});
test('session memory references recorded hypothesis and compares heartbeat deltas',()=>{
  const history=context.recentStrategyMemory([{ordinal:2,mutation:{...mutation.BASE_MUTATION,
    strategy:'curiosity',hypothesis:'Possible interest',expectedReaction:'Another click'}}]);
  assert.equal(history[0].hypothesis,'Possible interest');
  const recent={...behavior.makeBehaviorCollector(1000).snapshot(),pointerTravelPx:50,scrollDown:2};
  const current={...recent,pointerTravelPx:80,scrollDown:4};
  const change=context.behavioralContext(current,[{payload:{elapsedMs:15000,behavior:recent}}]);
  assert.equal(change.sinceLastHeartbeat.pointerTravelPx,30);
  assert.equal(change.sinceLastHeartbeat.scrollDown,2);
});
