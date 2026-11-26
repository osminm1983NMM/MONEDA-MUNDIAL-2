'use strict';
// Native filesystem + SHA-256 integration tests, using synthetic bytes only.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const {verify,nativeIO}=require('./verify-lab-artifact.cjs');
const commit='a'.repeat(40);
function fixture(t) {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mwd-lab-verifier-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const put=(file,value)=>fs.writeFileSync(path.join(dir,file),value);
 const digest=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,file))).digest('hex');
 put('MonedaMundial-LAB.apk',Buffer.from([0,255,17,34,0,42]));
 put('COMMIT.txt',commit+'\n');
 put('package-lock.json',JSON.stringify({lockfileVersion:3,packages:{'':{name:'moneda-mundial-2'}}}));
 put('TOOLCHAIN.txt','v22.1.0\n10.1.0\nopenjdk version "17.0.1"\n');
 put('SHA256.txt',digest('MonedaMundial-LAB.apk')+'  MonedaMundial-LAB.apk\n');
 put('DEPENDENCIES-SHA256.txt',['package-lock.json','TOOLCHAIN.txt'].map(f=>digest(f)+'  '+f).join('\n')+'\n');
 return {dir,put,digest,io:nativeIO(dir)};
}
test('native filesystem verifies binary checksum and provenance',t=>{
 const f=fixture(t),result=verify(commit,f.io);
 assert.equal(result.apkSha256,f.digest('MonedaMundial-LAB.apk'));
 assert.equal(result.apkBytes,6);assert.equal(result.commit,commit);
});
test('native hash detects one modified binary byte',t=>{
 const f=fixture(t);f.put('MonedaMundial-LAB.apk',Buffer.from([0,255,17,34,0,43]));
 assert.throws(()=>verify(commit,f.io),/SHA-256 mismatch/);
});
test('native hash detects modified dependency lock',t=>{
 const f=fixture(t);fs.appendFileSync(path.join(f.dir,'package-lock.json'),' ');
 assert.throws(()=>verify(commit,f.io),/SHA-256 mismatch/);
});
test('native filesystem rejects missing or symbolic-link manifest',t=>{
 const f=fixture(t);const file=path.join(f.dir,'COMMIT.txt');
 fs.renameSync(file,path.join(f.dir,'other.txt'));
 assert.throws(()=>verify(commit,f.io),/ENOENT/);
 fs.symlinkSync('other.txt',file);
 assert.throws(()=>verify(commit,f.io),/Invalid artifact member/);
});
