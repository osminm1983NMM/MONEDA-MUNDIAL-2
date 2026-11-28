'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {stage,scheme}=require('../../scripts/stage-unified-lab.cjs');
const source=path.resolve(__dirname,'../..');
const revision='a'.repeat(40);
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mwd-unified-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 for(const p of ['App.js','app.json','financial-sandbox/mobile/hosted-lab-entry.jsx','financial-sandbox/mobile/unified-lab-entry.jsx']){
  const dest=path.join(root,p);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(source,p),dest);
 }
 return root;
}
test('staging keeps LAB package, Auth redirects and mode selection separate',t=>{
 const root=fixture(t),read=p=>fs.readFileSync(path.join(root,p),'utf8');
 const hosted=read('financial-sandbox/mobile/hosted-lab-entry.jsx');
 const entry=read('financial-sandbox/mobile/unified-lab-entry.jsx');
 stage(root,revision);
 const {expo}=JSON.parse(read('app.json'));
 a.equal(expo.android.package,scheme);a.equal(expo.scheme,scheme);
 a.equal(expo.android.allowBackup,false);
 a.deepEqual(expo.android.blockedPermissions,['android.permission.SYSTEM_ALERT_WINDOW','android.permission.READ_EXTERNAL_STORAGE','android.permission.WRITE_EXTERNAL_STORAGE']);
 a.ok(expo.plugins.includes('expo-secure-store'));a.equal(expo.extra,undefined);a.equal(expo.owner,undefined);
 a.ok(read('DemoApp.jsx').includes("const BUILD_COMMIT = '"+revision+"';"));
 a.doesNotMatch(read('DemoApp.jsx'),/const BUILD_COMMIT = 'sin verificar'/);
 a.equal(read('App.js'),entry);a.equal(read('HostedFinancialLab.jsx'),hosted);
 a.match(read('DemoApp.jsx'),/com\.monedamundial\.unifiedlab:\/\/auth\/reset-password/);
 a.doesNotMatch(read('DemoApp.jsx'),/resetPasswordForEmail\(|com\.monedamundial\.app/);
 a.match(entry,/const latch=createModeLatch\(\)/);a.match(entry,/useState\(\(\)=>latch.current\(\)\)/);
 a.match(entry,/choose\('demo'\)/);a.match(entry,/choose\('financial'\)/);a.doesNotMatch(entry,/setMode\(null\)/);
 a.throws(()=>stage(root,revision),/UNEXPECTED_BASE_CONFIG/);
});
test('staging rejects wrong target and missing recovery guard before writing',t=>{
 const root=fixture(t),p=path.join(root,'App.js');
 fs.writeFileSync(p,fs.readFileSync(p,'utf8').replace('async function requestPasswordReset()', 'async function changedReset()'));
 a.throws(()=>stage(root,revision),/UNEXPECTED_DEMO_AUTH/);
 a.equal(fs.existsSync(path.join(root,'DemoApp.jsx')),false);
});

test('staging rejects invalid identity before writing',t=>{
 const root=fixture(t),p=path.join(root,'App.js');
 for(const invalid of [undefined,'sin verificar','a'.repeat(39),'A'.repeat(40),'a'.repeat(40)+'\n'])a.throws(()=>stage(root,invalid),/INVALID_BUILD_REVISION/);
 fs.writeFileSync(p,fs.readFileSync(p,'utf8').replace("const BUILD_COMMIT = 'sin verificar';","const BUILD_COMMIT = 'unexpected';"));
 a.throws(()=>stage(root,revision),/UNEXPECTED_BUILD_IDENTITY/);
 a.equal(fs.existsSync(path.join(root,'DemoApp.jsx')),false);
});

test('runtime mode latch survives a root remount and rejects switching',()=>{
 const {createModeLatch}=require('../../financial-sandbox/mobile/unified-mode-latch.cjs');
 for(const first of ['demo','financial']){
  const latch=createModeLatch(),other=first==='demo'?'financial':'demo';
  a.equal(latch.current(),null);a.throws(()=>latch.choose('production'),/INVALID_LAB_MODE/);
  a.equal(latch.current(),null);a.equal(latch.choose(first),first);
  a.equal(latch.current(),first);a.equal(latch.choose(other),first);
  a.throws(()=>latch.choose(null),/INVALID_LAB_MODE/);a.equal(latch.current(),first);
  a.equal(createModeLatch().current(),null);
 }
});
