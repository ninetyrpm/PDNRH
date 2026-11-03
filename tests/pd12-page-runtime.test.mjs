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
 const source=fs.readFileSync(path.join(root,name+'.ts'),'utf8');
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};cache.set(name,exports);
 new Function('exports','require',js)(exports,dep=>{
   if(!dep.startsWith('./'))throw Error('Unexpected dependency: '+dep);
   return load(path.normalize(path.join(path.dirname(name),dep)));
 });
 return exports;
}
const runtime=load('page-runtime'),scene=load('scene'),mutation=load('mutation');
const block=(id,kind='panel',text=id)=>({
 id,kind,text,detail:'',align:'center',size:'md',effect:'none',action:'none'
});
const start=scene.validateScene({version:1,composition:'column',accent:'ice',
 blocks:[block('heading','heading'),block('panel'),block('marker','glyph','◯'),{
 ...block('choice','button','Open'),detail:'There is something here.',action:'reveal'}]});

test('PD12B: create, move, update and delete preserve a persistent world',()=>{
 const patch={version:1,composition:'mosaic',steps:[
  {op:'update',id:'heading',changes:{text:'A CHANGED WORLD',size:'xl'}},
  {op:'delete',id:'panel'},
  {op:'create',block:block('fresh','panel','The room remembers')},
  {op:'move',id:'fresh',beforeId:'heading'}
 ]};
 const result=runtime.applyPagePatch(start,patch);
 assert.ok(result);
 assert.equal(result.scene.composition,'mosaic');
 assert.deepEqual(result.scene.blocks.map(b=>b.id),['fresh','heading','marker','choice']);
 assert.equal(result.scene.blocks[1].text,'A CHANGED WORLD');
 assert.equal(start.blocks[0].text,'heading'); // source untouched
 assert.ok(mutation.validateMutation({...mutation.BASE_MUTATION,scene:result.scene,scenePatch:result.patch}));
});
test('PD12B: invalid reference, URL injection and destroyed structure are rejected atomically',()=>{
 assert.equal(runtime.applyPagePatch(start,{version:1,steps:[{op:'delete',id:'missing'}]}),null);
 assert.equal(runtime.applyPagePatch(start,{version:1,steps:[{op:'update',id:'heading',changes:{text:'https://evil.example'}}]}),null);
 assert.equal(runtime.applyPagePatch(start,{version:1,steps:[{op:'delete',id:'heading'},
 {op:'delete',id:'panel'},{op:'delete',id:'marker'},{op:'delete',id:'choice'}]}),null);
 assert.equal(runtime.applyPagePatch(start,{version:1,steps:[{op:'create',block:{...block('x'),href:'https://evil.example'}}]})?.scene.blocks.at(-1)?.href,undefined);
 assert.equal(runtime.applyPagePatch(undefined,{version:1,steps:[{op:'delete',id:'heading'}]}),null);
 assert.equal(runtime.validatePagePatch({version:1,steps:[{op:'update',id:'panel',changes:{onClick:'something'}}]}),null);
});
test('PD12B: safe patch preserves native allowlisted link actions',()=>{
 const outbound={...block('exit','link','View next chapter'),action:'navigate'};
 const result=runtime.applyPagePatch(start,{version:1,steps:[{op:'create',block:outbound}]});
 assert.ok(result);
 assert.equal(result.scene.blocks.at(-1).action,'navigate');
 const invalid=runtime.applyPagePatch(start,{version:1,steps:[{op:'update',id:'panel',changes:{action:'navigate'}}]});
 assert.equal(invalid,null);
});
