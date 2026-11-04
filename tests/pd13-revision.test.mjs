import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('PD13C revision is differential and validated',()=>{
 const src=fs.readFileSync(new URL('../src/lib/sandbox-revision.ts',import.meta.url),'utf8');
 assert.match(src,/applyWorldRevision/);
 assert.match(src,/validateWorld\(/);
 assert.match(src,/Object\.keys\(changes\)\.length/);
 assert.match(src,/rationale/);
});
test('PD13C observations are bounded, never raw pointer or private content',()=>{
 const src=fs.readFileSync(new URL('../src/lib/sandbox-revision.ts',import.meta.url),'utf8');
 assert.match(src,/validateObservations/);
 assert.match(src,/entries.length>24/);
 assert.match(src,/signals\.slice\(-120\)/);
 assert.doesNotMatch(src,/pointerX|pointerY|keylog/);
});
test('PD13C supports explicitly bounded anonymous state handoff',()=>{
 const lib=fs.readFileSync(new URL('../src/lib/sandbox-world.ts',import.meta.url),'utf8');
 const view=fs.readFileSync(new URL('../src/app/sandbox-world.tsx',import.meta.url),'utf8');
 assert.match(lib,/validateWorldState/);
 assert.match(lib,/PDNRH_EXPORT_STATE/);
 assert.match(lib,/PDNRH_SEED_STATE/);
 assert.match(view,/kind:'snapshot_request'/);
 assert.match(view,/validateWorldState\(message.state\)/);
});
test('PD13C revision route is admin-only and does not mutate game sessions',()=>{
 const endpoint=fs.readFileSync(new URL('../src/app/api/sandbox-lab/revise/route.ts',import.meta.url),'utf8');
 const client=fs.readFileSync(new URL('../src/app/sandbox-lab/lab-client.tsx',import.meta.url),'utf8');
 assert.match(endpoint,/observatoryAuthorized\(\)/);
 assert.match(endpoint,/applyWorldRevision\(previous,parsed\)/);
 assert.match(client,/REVISE CURRENT WORLD/);
 assert.match(client,/setVersions/);
 assert.doesNotMatch(endpoint,/UPDATE sessions|INSERT INTO exposures/);
});
