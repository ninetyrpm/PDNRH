import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const source = fs.readFileSync(new URL('../src/lib/experiment.ts',import.meta.url),'utf8')
  .replace("import 'server-only';",'')
  .replace("import { db } from '@/lib/db';",'');
const js = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const module = {exports:{}};
new Function('module','exports','require',js)(module,module.exports,require);
const {chooseAssignment,hashCredential} = module.exports;
test('assignments are deterministic at boundaries',()=>{
  assert.equal(chooseAssignment(0),'baseline_control');
  assert.equal(chooseAssignment(9),'baseline_control');
  assert.equal(chooseAssignment(10),'static_control');
  assert.equal(chooseAssignment(19),'static_control');
  assert.equal(chooseAssignment(20),'adaptive');
  assert.equal(chooseAssignment(99),'adaptive');
  assert.throws(()=>chooseAssignment(100));
});
test('credential hash is stable and irreversible by simple comparison',()=>{
  assert.equal(hashCredential('x'),hashCredential('x'));
  assert.notEqual(hashCredential('x'),hashCredential('y'));
  assert.equal(hashCredential('x').length,64);
});
