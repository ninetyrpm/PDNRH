import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../src/lib/telemetry.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const module={exports:{}};
new Function('module','exports',js)(module,module.exports);
const {validRemoteSession,telemetryPayload}=module.exports;
const remote={id:'ad417fa4-780e-40eb-824c-8724caf14cde',credential:'a'.repeat(43),assignment:'adaptive'};
test('validate server issued session',()=>{
 assert.ok(validRemoteSession(remote));
 assert.equal(validRemoteSession({...remote,credential:'bad'}),false);
 assert.equal(validRemoteSession({...remote,assignment:'cheat'}),false);
});
test('compact terminal and heartbeat payloads',()=>{
 const s={elapsedMs:2000,clicks:2,scrolls:1,idleMs:300};
 assert.deepEqual(telemetryPayload(s,1),{type:'heartbeat',sequence:1,...s});
 assert.deepEqual(telemetryPayload(s,2,'blur'),{type:'loss',sequence:2,...s,reason:'blur'});
});
