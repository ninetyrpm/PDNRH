import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const auth=fs.readFileSync(new URL('../src/lib/observatory-auth.ts',import.meta.url),'utf8');
const route=fs.readFileSync(new URL('../src/app/observatory/auth/route.ts',import.meta.url),'utf8');
const lab=fs.readFileSync(new URL('../src/app/sandbox-lab/page.tsx',import.meta.url),'utf8');
const generate=fs.readFileSync(new URL('../src/app/api/sandbox-lab/generate/route.ts',import.meta.url),'utf8');
test('PD13A.1 uses one shared admin session across Observatory and Sandbox Lab',()=>{
 assert.match(auth,/observatoryCookie='pdnrh-admin-session'/);
 assert.match(route,/response.cookies.set\(observatoryCookie,createObservatorySession\(\)/);
 assert.match(route,/path:'\/',maxAge:60\*60\*4/);
 assert.match(lab,/observatoryAuthorized\(\)/);
 assert.match(generate,/observatoryAuthorized\(\)/);
});
test('PD13A.1 revokes global and legacy cookies on logout and migration',()=>{
 assert.match(route,/response.cookies.set\('pdnrh-observatory','',/);
 assert.match(route,/path:'\/observatory',maxAge:0/);
 assert.match(route,/response.cookies.set\(observatoryCookie,'',/);
 assert.match(route,/path:'\/',maxAge:0/);
 assert.equal(route.includes("path:'/sandbox-lab'"),false);
});
