import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('PD13E is the default game engine with explicit PD12 rollback',()=>{
 const root=read('src/app/page.tsx');
 const legacy=read('src/app/legacy/page.tsx');
 const current=read('src/app/pd13-game.tsx');
 assert.match(root,/PDNRH_GAME_ENGINE==='pd12d'/);
 assert.match(root,/<PD13Game\/>/);
 assert.match(legacy,/\/api\/mutate/);
 assert.match(current,/engine:'pd13e-v1'/);
 assert.match(current,/\/api\/world\/mutate/);
});
test('PD13E generates and revises automatically in the playing loop',()=>{
 const current=read('src/app/pd13-game.tsx');
 assert.match(current,/setInterval\(\(\)=>void tick\(\),250\)/);
 assert.match(current,/ordinalRef\.current\+1/);
 assert.match(current,/observationsFromSignals/);
 assert.match(current,/nextAtRef\.current=session\.snapshot\(\)\.elapsedMs\+delay\*1000/);
 assert.match(current,/SandboxWorld key=\{ordinal\} live/);
});
test('PD13E preserves protected loss and concession controls outside the sandbox',()=>{
 const current=read('src/app/pd13-game.tsx');
 assert.match(current,/window\.addEventListener\('blur',onBlur\)/);
 assert.match(current,/!document\.hasFocus\(\)/);
 assert.match(current,/document\.hidden/);
 assert.match(current,/data-pdnrh-concede/);
 assert.match(current,/sessionRef\.current\.lose\('concede'\)/);
 assert.doesNotMatch(current,/allow-same-origin|allow-top-navigation|allow-popups/);
});
test('PD13E server rejects mismatched session engines and persists immutable exposures',()=>{
 const route=read('src/app/api/world/mutate/route.ts');
 assert.match(route,/credential_hash=\$\{hashCredential\(credential\)\}/);
 assert.match(route,/engine_version!=='pd13e-v1'/);
 assert.match(route,/pd13_world_exposures/);
 assert.match(route,/ON CONFLICT \(session_id,ordinal\) DO NOTHING/);
 assert.match(route,/s\.status='active'/);
 assert.match(route,/validateObservations/);
 assert.match(route,/generatePd13World/);
 const migration=read('db/migrations/0009_pd13_world_exposures.sql');
 assert.match(migration,/PRIMARY KEY\(session_id,ordinal\)/);
});
test('PD13E Observatory source audit is admin-gated and never executes stored code',()=>{
 const inspector=read('src/app/observatory/worlds/[id]/page.tsx');
 assert.match(inspector,/observatoryAuthorized\(\)/);
 assert.match(inspector,/pd13_world_exposures/);
 assert.doesNotMatch(inspector,/srcDoc|dangerouslySetInnerHTML|new Function|eval\(/);
});
