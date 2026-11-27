'use strict';
// This sandbox-only gate pins the root mobile sources/config/dependency lock to
// the reviewed Android build 40fdbaa (APK build success; emulator gate separate).
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
  "App.js": "dee1c353a588702af312001645ab779048b204f7",
  "PartnerRegistryScreen.js": "30ced7d02450f08c26512fa06d630e0db6a070c0",
  "RemittanceQuoteScreen.js": "3a80aea01b5c2987913bca4d7d93748e37d7d0bc",
  "app.json": "ca7d5498f8e7831f4553074f6a8683d57881fb9c",
  "auth-storage.js": "d6b47a9bf44e30423cf874958939ddf5bf4a4706",
  "eas.json": "d338997611e261bc328d9055db9eb387d60721dd",
  "package-lock.json": "67afcc4fbd90946ca985bc7d7dabd6b15da38d77",
  "package.json": "375a3aaca4d646315cfb0dbe35a49a564f62bdba",
  "remittance-quote.js": "3e0f30c73089d8a31cf52eab1a3f19cbb1fb89e7"
};
function blobSha(bytes){
 return createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
}
function assertMobileBoundary(tracked,read){
 const rootFiles=tracked.filter(p=>!p.includes('/')).sort();
 assert.deepEqual(rootFiles,Object.keys(expected).sort(),'Root mobile inventory changed; review Android baseline');
 const allowedDirectories=new Set(['.github','database','docs','scripts','tests','financial-sandbox']);
 for(const p of tracked.filter(p=>p.includes('/')))assert.ok(allowedDirectories.has(p.split('/')[0]),'Unreviewed root directory: '+p);
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
 const paths=Object.keys(expected),read=p=>fs.readFileSync(path.join(root,p));
 assert.throws(()=>assertMobileBoundary([...paths,'metro.config.js'],read),/inventory changed/);
 assert.throws(()=>assertMobileBoundary([...paths,'unreviewed/index.js'],read),/Unreviewed root directory/);
 assert.throws(()=>assertMobileBoundary(paths,p=>p==='App.js'?Buffer.concat([read(p),Buffer.from(' ') ]):read(p)),/Mobile source\/config changed: App.js/);
 assert.throws(()=>assertMobileBoundary(paths.filter(p=>p!=='package-lock.json'),read),/inventory changed/);
});
