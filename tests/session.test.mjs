import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../src/lib/session.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const module = { exports: {} };
new Function('module', 'exports', compiled)(module, module.exports);
const { createSession, formatElapsed, nextMilestone } = module.exports;

test('formats active elapsed time', () => {
  assert.equal(formatElapsed(0), '00:00:00');
  assert.equal(formatElapsed(3661000), '01:01:01');
});
test('milestones use elapsed seconds and previous threshold', () => {
  assert.deepEqual(nextMilestone(61, [60,180]), {previous:60,target:180});
  assert.equal(nextMilestone(180, [60,180]), null);
});
test('hidden time is excluded and concession freezes clock', () => {
  let t = 0;
  const s = createSession(() => t);
  t = 1000;
  assert.equal(s.snapshot().elapsedMs, 1000);
  s.setVisible(false);
  t = 5000;
  assert.equal(s.snapshot().elapsedMs, 1000);
  s.setVisible(true);
  t = 7500;
  s.record('click');
  assert.equal(s.snapshot().elapsedMs, 3500);
  assert.equal(s.snapshot().clicks, 1);
  s.concede();
  t = 9000;
  assert.equal(s.snapshot().elapsedMs, 3500);
  assert.equal(s.snapshot().completed, true);
});
