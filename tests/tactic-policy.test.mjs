import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const text=fs.readFileSync(new URL('../src/lib/tactic-policy.ts',import.meta.url),'utf8');
const js=ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
// Avoid importing application aliases: the static tactic library is the only dependency.
const {createHash}=await import('node:crypto');
const requireCrypto={createHash};
const exports={};
new Function('exports','require',js)(exports,(name)=>{
  if(name==='node:crypto')return requireCrypto;
  if(name==='./tactics')return {TACTIC_LIBRARY:[{family:'closure_frame'},{family:'curiosity_reversal'},{family:'absurdist_deflation'}]};
  throw Error(name);
});
test('uniform until both cohort and arm sample floors',()=>{
  assert.deepEqual(exports.calculateWeights({baselineCompleted:29,arms:[]}).weights,[1/3,1/3,1/3]);
  const arms=['closure_frame','curiosity_reversal','absurdist_deflation'].map((family,i)=>({family,completed:30,meanElapsedMs:2000+i*1000}));
  assert.equal(exports.calculateWeights({baselineCompleted:30,arms}).eligible,true);
  assert.deepEqual(exports.calculateWeights({baselineCompleted:30,arms}).weights,[0.6,0.2,0.2]);
});
test('same session yields same arm under fixed weights',()=>{
  const weights=[1/3,1/3,1/3];
  assert.equal(exports.selectTactic('abc',weights).family,exports.selectTactic('abc',weights).family);
});
