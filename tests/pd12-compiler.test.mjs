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
 const result={};cache.set(name,result);
 const js=ts.transpileModule(fs.readFileSync(path.join(root,name+'.ts'),'utf8'),{
   compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('exports','require',js)(result,dep=>{
   if(!dep.startsWith('./'))throw Error('Unexpected dependency '+dep);
   return load(path.normalize(path.join(path.dirname(name),dep)));
 });
 return result;
}
const compiler=load('pd12d-compiler');
const plan={version:1,approach:'closure',exitMechanism:'concede',
 expectedExitSignal:'concede_approach',thesis:'End the visit voluntarily.',
 assessment:'No evidence yet.',changeReason:'Initial approach.'};
const block=(id,kind,text,extra={})=>({id,kind,text,...extra});
const model={plan,headline:'THE ROOM IS DONE',message:'You can leave.',aside:'No more to see.',
 tone:'direct',layout:'center',surface:'dark',actionLabel:'I GIVE UP',
 strategy:'closure',nextDelaySeconds:30,hypothesis:'Maybe the participant will leave.',
 expectedReaction:'The participant may click.',
 experiment:{targetId:'exit',event:'click',minimum:1},
 scene:{version:1,composition:'column',accent:'ice',blocks:[
  block('title','heading','Nothing left'),block('graphic','glyph','◯'),
  block('exit','link','Go elsewhere',{action:'navigate'})],
 reflexes:[{id:'watch',targetId:'exit',trigger:'hover',threshold:1,effect:'highlight',text:''}]}};
const opts={pivotRequired:false,avoidApproach:null};
test('PD12D.2 accepts a fully valid creative strategy',()=>{
 const result=compiler.compilePd12dOutput(model,undefined,opts);
 assert.equal(result.failure,null);
 assert.equal(result.mutation.scene.blocks.length,3);
 assert.equal(result.mutation.plan.approach,'closure');
});
test('PD12D.2 safely supplies omitted scene boilerplate without changing authored intent',()=>{
 const sparse={plan,scene:{version:1,composition:'mosaic',accent:'ice',blocks:[
  block('title','heading','The page is complete'),block('exit','link','Continue elsewhere',{action:'navigate'})]}};
 const result=compiler.compilePd12dOutput(sparse,undefined,opts);
 assert.equal(result.failure,null);
 assert.ok(result.repairs.includes('block_defaults'));
 assert.ok(result.repairs.includes('visual_affordance_added'));
 assert.ok(result.repairs.includes('safe_reflex_default'));
 assert.equal(result.mutation.scene.blocks.find(b=>b.id==='exit').action,'navigate');
 assert.equal(result.mutation.headline,'The page is complete');
});
test('PD12D.2 accepts a partial page update and keeps original IDs',()=>{
 const before=compiler.compilePd12dOutput(model,undefined,opts).mutation.scene;
 const patch={plan:{...plan,approach:'subtraction'},scenePatch:{version:1,steps:[
  {op:'update',id:'title',changes:{text:'There is nothing else.'}}]}};
 const result=compiler.compilePd12dOutput(patch,before,opts);
 assert.equal(result.failure,null);
 assert.equal(result.mutation.scene.blocks[0].text,'There is nothing else.');
 assert.equal(result.mutation.scene.blocks[1].id,'graphic');
 assert.ok(result.mutation.scenePatch);
});
test('PD12D.2 rejects missing strategy and required nonpivot',()=>{
 assert.equal(compiler.compilePd12dOutput({...model,plan:undefined},undefined,opts).failure,'missing_or_invalid_plan');
 assert.equal(compiler.compilePd12dOutput(model,undefined,{pivotRequired:true,avoidApproach:'closure'}).failure,'required_pivot_missing');
});
test('PD12D.2 does not allow invented destinations, executable text or unsupported actions',()=>{
 const malicious={...model,scene:{...model.scene,blocks:[
  block('title','heading','Bad'),block('graphic','glyph','◯'),
  block('exit','link','https://attacker.example',{action:'navigate'})]}};
 assert.equal(compiler.compilePd12dOutput(malicious,undefined,opts).failure,'missing_or_invalid_scene');
 const script={...model,scene:{...model.scene,blocks:[
  block('title','heading','<script>alert(1)</script>'),
  block('graphic','glyph','◯'),block('exit','link','Leave',{action:'navigate'})]}};
 assert.equal(compiler.compilePd12dOutput(script,undefined,opts).failure,'missing_or_invalid_scene');
 const badAction={...model,scene:{...model.scene,blocks:[
  block('title','heading','Go',{action:'navigate'}),block('graphic','glyph','◯'),
  block('exit','link','Leave',{action:'navigate'})]}};
 assert.equal(compiler.compilePd12dOutput(badAction,undefined,opts).failure,'missing_or_invalid_scene');
});
