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
 const output={};cache.set(name,output);
 const code=ts.transpileModule(fs.readFileSync(path.join(root,name+'.ts'),'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('exports','require',code)(output,dep=>{
  if(!dep.startsWith('./'))throw Error(dep);
  return load(path.normalize(path.join(path.dirname(name),dep)));
 });
 return output;
}
const scene=load('scene'),runtime=load('page-runtime'),reflex=load('reflex'),behavior=load('behavior');
const blocks=[
 {id:'title',kind:'heading',text:'Look here',detail:'',align:'center',size:'lg',effect:'none',action:'none'},
 {id:'shape',kind:'glyph',text:'◯',detail:'',align:'center',size:'xl',effect:'none',action:'none'},
 {id:'choice',kind:'button',text:'What happens?',detail:'You touched the page.',align:'center',size:'md',effect:'pulse',action:'reveal'}
];
const rule=(extras={})=>({id:'notice',targetId:'shape',trigger:'near',threshold:2,effect:'highlight',text:'',...extras});
const make=(reflexes)=>({version:1,composition:'mosaic',accent:'ice',blocks,reflexes});
test('PD12C validates bounded reflex rules and genuine element references',()=>{
 const valid=scene.validateScene(make([rule()]));
 assert.equal(valid.reflexes[0].targetId,'shape');
 assert.equal(scene.validateScene(make([rule({targetId:'missing'})])),null);
 assert.equal(scene.validateScene(make([rule({trigger:'network'})])),null);
 assert.equal(scene.validateScene(make([rule({effect:'navigate'})])),null);
 assert.equal(scene.validateScene(make([rule({effect:'replace',text:''})])),null);
 assert.equal(scene.validateScene(make([rule({threshold:50})])),null);
 assert.equal(scene.validateScene(make([rule(),rule()])),null);
});
test('PD12C on-page near reactions trigger only after threshold and once',()=>{
 const rules=[rule()];
 let counts={},fired=new Set();
 let one=reflex.advanceReflexes(rules,{trigger:'near',targetId:'shape'},counts,fired);
 counts=one.counts;assert.equal(one.activated.length,0);
 let two=reflex.advanceReflexes(rules,{trigger:'near',targetId:'shape'},counts,fired);
 assert.equal(two.activated.length,1);
 fired.add(two.activated[0].id);
 assert.equal(reflex.advanceReflexes(rules,{trigger:'near',targetId:'shape'},two.counts,fired).activated.length,0);
 assert.equal(reflex.advanceReflexes(rules,{trigger:'near',targetId:'title'},one.counts,new Set()).activated.length,0);
});
test('PD12C idle reactions are time-gated and cannot terminate a round',()=>{
 const rules=[rule({trigger:'idle',threshold:4,effect:'replace',text:'Still nearby.'})];
 assert.equal(reflex.advanceReflexes(rules,{trigger:'idle',idleSeconds:3.5},{},new Set()).activated.length,0);
 assert.equal(reflex.advanceReflexes(rules,{trigger:'idle',idleSeconds:4.2},{},new Set()).activated.length,1);
 assert.equal('action' in rules[0],false);
});
test('PD12C patches preserve reflexes unless atomically replaced',()=>{
 const start=scene.validateScene(make([rule()]));
 const update=runtime.applyPagePatch(start,{version:1,steps:[
  {op:'update',id:'title',changes:{text:'Now I am aware.'}}]});
 assert.equal(update.scene.reflexes[0].id,'notice');
 const replace=runtime.applyPagePatch(update.scene,{version:1,steps:[
  {op:'update',id:'choice',changes:{text:'Respond.'}}],
  reflexes:[rule({id:'pause',targetId:'choice',trigger:'idle',threshold:3,effect:'reveal'})]});
 assert.equal(replace.scene.reflexes[0].id,'pause');
 assert.equal(runtime.applyPagePatch(start,{version:1,steps:[
  {op:'delete',id:'shape'}]}),null); // remaining rule would reference a removed block
});
test('PD12C reflex telemetry retains IDs and counts, never pointer positions',()=>{
 const collector=behavior.makeBehaviorCollector(900);
 collector.reflexEvent(3,'notice');collector.reflexEvent(3,'notice');
 const summary=collector.snapshot();
 assert.deepEqual(summary.reflexEvents,[{exposure:3,id:'notice',count:2}]);
 assert.deepEqual(behavior.validateBehavior(summary).reflexEvents,summary.reflexEvents);
 assert.equal(behavior.validateBehavior({...summary,reflexEvents:[{exposure:3,id:'notice',count:-1}]}),null);
});
