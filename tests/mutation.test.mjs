import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../src/lib/mutation.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const module={exports:{}};
new Function('module','exports',compiled)(module,module.exports);
const {BASE_MUTATION,validateMutation,fallbackMutation}=module.exports;
test('baseline and fallbacks meet strict schema',()=>{
  assert.deepEqual(validateMutation(BASE_MUTATION),BASE_MUTATION);
  for(let step=0;step<15;step++) assert.ok(validateMutation(fallbackMutation(step)));
});
test('reject arbitrary fields, oversized input, malformed enum and delay',()=>{
  assert.equal(validateMutation({...BASE_MUTATION,headline:'x'.repeat(111)}),null);
  assert.equal(validateMutation({...BASE_MUTATION,surface:'javascript'}),null);
  assert.equal(validateMutation({...BASE_MUTATION,nextDelaySeconds:0}),null);
  assert.equal(validateMutation({...BASE_MUTATION,message:'<script>alert(1)</script>'})?.message,'<script>alert(1)</script>');
});
