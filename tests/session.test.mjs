import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../src/lib/session.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const module = { exports: {} };
new Function('module', 'exports', compiled)(module, module.exports);
const { createSession, formatElapsed, nextMilestone } = module.exports;
test('format and milestones', () => {
  assert.equal(formatElapsed(3661000), '01:01:01');
  assert.deepEqual(nextMilestone(61, [60, 180]), { previous: 60, target: 180 });
  assert.equal(nextMilestone(180, [60, 180]), null);
});
test('explicit start gates time and focus losses', () => {
  let t = 0;
  const s = createSession(() => t);
  t = 1000;
  assert.equal(s.snapshot().elapsedMs, 0);
  s.lose('blur'); // pre-start browser focus change is harmless
  assert.equal(s.snapshot().phase, 'ready');
  s.start();
  t = 3500;
  s.record('click');
  assert.equal(s.snapshot().elapsedMs, 2500);
  s.lose('blur');
  assert.equal(s.snapshot().lossReason, 'blur');
  t = 20000;
  s.start();
  s.lose('hidden');
  assert.equal(s.snapshot().elapsedMs, 2500);
  assert.equal(s.snapshot().lossReason, 'blur');
  assert.equal(s.snapshot().clicks, 1);
});
test('all departure mechanisms are terminal and idempotent', () => {
  for (const reason of ['hidden', 'pagehide', 'concede', 'reload']) {
    let t = 10;
    const s = createSession(() => t);
    s.start();
    t = 1010;
    s.lose(reason);
    t = 8000;
    assert.equal(s.snapshot().elapsedMs, 1000);
    assert.equal(s.snapshot().lossReason, reason);
    assert.equal(s.snapshot().completed, true);
    assert.equal(s.snapshot().concession, reason === 'concede');
  }
});
