'use strict';
// This sandbox-only gate pins the root mobile sources/config/dependency lock to
// the reviewed unified Android build ec1477d (APK and emulator gates passed;
// initial physical opening and identity observed; functional acceptance pending).
// A deliberate Android update requires
// a reviewed new baseline, not silently changing these expected blob IDs.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {createHash}=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const expected={
  "App.js": "681559f72409303f28e5b1e6dc2cd14f7032f575",
  "PartnerRegistryScreen.js": "30ced7d02450f08c26512fa06d630e0db6a070c0",
  "RemittanceQuoteScreen.js": "47b40d49567990e702886f5fe771c2e302261fb2",
  "app.json": "ca7d5498f8e7831f4553074f6a8683d57881fb9c",
  "auth-storage.js": "56c08654c79860615322084e3f6e64af11684263",
  "eas.json": "d338997611e261bc328d9055db9eb387d60721dd",
  "package-lock.json": "faf5fd56aa945ab7912f1e13efd7e1484395c9b3",
  "package.json": "90f12eb15b1e9d7146ae832c48eaa9c2b96f1b6d",
  "remittance-quote.js": "d7643131307fae5b643073317a9178ec4ab4932e"
};
// Reviewed hosted artifacts only. Pin the manual HTTPS proof separately by exact blob; arbitrary files remain forbidden.
const hostedArtifacts={
  "financial-hosted/verify-https.cjs": "f57f9cd51719a1d625ff2a69db8c65b663cab455",
  "financial-hosted/mwd_hosted_private_boundary.sql": "c30c18e48f383cac8fb5a048562752fd944a017d",
  "financial-hosted/mwd_hosted_status_reader.sql": "a6214a55bf4406b5fe4ef231cd72916f9ce30871",
  "financial-hosted/mwd_hosted_synthetic_multicurrency.sql": "776e826ccd69cac89c7d4049efe9903c518de40a",
  "financial-hosted/verify_synthetic_multicurrency.sql": "2a5dc1132175447b4fa1f3407382bcad2d21cf44",
  "financial-hosted/mwd_hosted_ledger_status_bridge.sql": "e5a55012042819747bb649868490dd3246c77a04",
  "financial-hosted/verify_ledger_status_bridge.sql": "0e33d90d56e0674040808b2895c2bd5f3f16677b",
  "financial-hosted/mwd_hosted_authenticated_status.sql": "bf172d3769e8075b35ca742a4f9e2220e14e6a42",
  "financial-hosted/verify_authenticated_status.sql": "2717372105a5eafd9afb7948358271168e5ed32e",
  "financial-sandbox/sql/mwd_lab_session_identity.sql": "53fb1e1648686fdae2a2c7f23c27bc7f8adcc7b3",
  "financial-sandbox/sql/mwd_lab_wallet_snapshot.sql": "9fe113158f0b22dc049892311a7a4e838928a3d9"
};
function blobSha(bytes){
 return createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
}
function assertMobileBoundary(tracked,read){
 const rootFiles=tracked.filter(p=>!p.includes('/')).sort();
 assert.deepEqual(rootFiles,Object.keys(expected).sort(),'Root mobile inventory changed; review Android baseline');
 const allowedDirectories=new Set(['.github','database','docs','scripts','tests','financial-sandbox']);
 for(const p of tracked.filter(p=>p.includes('/'))){
  if(p.startsWith('financial-hosted/')||p.startsWith('financial-sandbox/sql/')){
   assert.ok(Object.hasOwn(hostedArtifacts,p),'Unreviewed hosted file: '+p);
   assert.equal(blobSha(read(p)),hostedArtifacts[p],'Hosted artifact changed: '+p);
  }else assert.ok(allowedDirectories.has(p.split('/')[0]),'Unreviewed root directory: '+p);
 }
 for(const p of Object.keys(hostedArtifacts))assert.ok(tracked.includes(p),'Reviewed hosted artifact missing: '+p);
 for(const p of rootFiles){
  const data=read(p);
  assert.equal(blobSha(data),expected[p],'Mobile source/config changed: '+p);
 }
}
test('sandbox branch preserves the automated Android candidate root files byte-for-byte',()=>{
 const tracked=execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
 assertMobileBoundary(tracked,p=>{
  const name=path.join(root,p);
  assert.ok(fs.lstatSync(name).isFile(),'Not a regular source file: '+p);
  return fs.readFileSync(name);
 });
});
test('boundary rejects changed source and unreviewed new root paths',()=>{
 const paths=[...Object.keys(expected),...Object.keys(hostedArtifacts)],read=p=>fs.readFileSync(path.join(root,p));
 assert.throws(()=>assertMobileBoundary([...paths,'metro.config.js'],read),/inventory changed/);
 assert.throws(()=>assertMobileBoundary([...paths,'unreviewed/index.js'],read),/Unreviewed root directory/);
 assert.throws(()=>assertMobileBoundary(paths,p=>p==='App.js'?Buffer.concat([read(p),Buffer.from(' ') ]):read(p)),/Mobile source\/config changed: App.js/);
 assert.throws(()=>assertMobileBoundary(paths.filter(p=>p!=='package-lock.json'),read),/inventory changed/);
 assert.throws(()=>assertMobileBoundary([...paths,'financial-hosted/index.js'],read),/Unreviewed hosted file/);
 assert.throws(()=>assertMobileBoundary([...paths,'financial-hosted/unreviewed.sql'],read),/Unreviewed hosted file/);
 assert.throws(()=>assertMobileBoundary([...paths,'financial-sandbox/sql/unreviewed.sql'],read),/Unreviewed hosted file/);
 for(const file of Object.keys(hostedArtifacts)){
  assert.throws(()=>assertMobileBoundary(paths.filter(p=>p!==file),read),/Reviewed hosted artifact missing/);
  assert.throws(()=>assertMobileBoundary(paths,p=>p===file?Buffer.concat([read(p),Buffer.from(' ')]):read(p)),/Hosted artifact changed/);
 }
});
