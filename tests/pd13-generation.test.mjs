import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const cache=new Map();
function load(name){
 if(cache.has(name))return cache.get(name);
 const file=new URL('../src/lib/'+name+'.ts',import.meta.url);
 const source=fs.readFileSync(file,'utf8');
 const output=ts.transpileModule(source,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
 }}).outputText;
 const exports={};cache.set(name,exports);
 new Function('exports','require',output)(exports,dep=>{
  if(!dep.startsWith('./'))throw Error('Unexpected import: '+dep);
  return load(dep.slice(2));
 });
 return exports;
}
const {interpretGeneratedWorld}=load('sandbox-generation');
const world={version:1,html:'<main>Hello</main>',css:'main{color:cyan}',js:'document.title="Hi";'};
const completion=(content,finish_reason='stop',usage={completion_tokens:240,prompt_tokens:300})=>({
 choices:[{finish_reason,message:{content}}],usage
});
test('PD13A.2 parses completed JSON and returns non-sensitive provider diagnostics',()=>{
 const result=interpretGeneratedWorld(completion(JSON.stringify(world)));
 assert.equal(result.ok,true);
 assert.deepEqual(result.world,world);
 assert.equal(result.diagnostics.finishReason,'stop');
 assert.equal(result.diagnostics.completionTokens,240);
});
test('PD13A.2 detects token-truncated output BEFORE parsing JSON',()=>{
 const result=interpretGeneratedWorld(completion('{"version":1,"html":"unfinished','length'));
 assert.equal(result.ok,false);
 assert.equal(result.code,'truncated');
 assert.match(result.message,/token budget/);
});
test('PD13A.2 distinguishes malformed, empty, refused and invalid worlds',()=>{
 assert.equal(interpretGeneratedWorld(completion('{"broken":}')).code,'malformed_json');
 assert.equal(interpretGeneratedWorld(completion('')).code,'empty');
 assert.equal(interpretGeneratedWorld(completion(JSON.stringify({...world,js:42}))).code,'invalid_world');
 assert.equal(interpretGeneratedWorld({choices:[{finish_reason:'content_filter',message:{content:''}}]}).code,'refused');
});
test('PD13A.2 production generation route requires authorized access and greater budget',()=>{
 const source=fs.readFileSync(new URL('../src/app/api/sandbox-lab/generate/route.ts',import.meta.url),'utf8');
 assert.match(source,/observatoryAuthorized\(\)/);
 assert.match(source,/max_completion_tokens:6500/);
 assert.match(source,/interpretGeneratedWorld\(data\)/);
 assert.match(source,/generation_result/);
 assert.doesNotMatch(source,/console\.(?:info|error)\([^\n]*raw/);
});
