import test from 'node:test';import assert from 'node:assert/strict';
import {safeDemoBuildInfo} from '../src/digital-money/demo-build-info.mjs';
const v={schemaVersion:1,appVersion:'2.0.0',mode:'demo_only',realPaymentsEnabled:false,gitSha:'a'.repeat(40),runId:'39319745682',runAttempt:1};
test('procedencia de APK de prueba pública sin datos personales',()=>{
 const d=safeDemoBuildInfo(v);assert.equal(d.githubProvenanceAvailable,true);
 assert.equal(d.realPaymentsEnabled,false);assert.equal(d.physicallyVerified,false);
 assert.equal(safeDemoBuildInfo({...v,realPaymentsEnabled:true}),null);
 assert.equal(safeDemoBuildInfo({...v,mode:'production'}),null);
 assert.equal(safeDemoBuildInfo({...v,gitSha:'invalid'}).githubProvenanceAvailable,false);
});
