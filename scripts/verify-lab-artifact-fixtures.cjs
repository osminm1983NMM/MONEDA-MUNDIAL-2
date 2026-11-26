'use strict';
// Offline fixtures; do not use real APK or device credentials.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {verify}=require('./verify-lab-artifact.cjs');
const commit='a'.repeat(40),hash='b'.repeat(64),other='c'.repeat(64);
function fixture(){
 const data={
  'MonedaMundial-LAB.apk':'fixture',
  'SHA256.txt':hash+'  MonedaMundial-LAB.apk\n',
  'COMMIT.txt':commit+'\n',
  'package-lock.json':JSON.stringify({lockfileVersion:3,packages:{'':{name:'moneda-mundial-2'}}}),
  'TOOLCHAIN.txt':'v22.1.0\n10.1.0\nopenjdk version "17.0.1"\n',
  'DEPENDENCIES-SHA256.txt':hash+'  package-lock.json\n'+hash+'  TOOLCHAIN.txt\n',
 };
 const hashes={},symlinks=new Set();
 const io={stat:k=>({isFile:()=>k in data,isSymbolicLink:()=>symlinks.has(k),size:data[k]?.length||0}),readText:k=>data[k],hash:k=>hashes[k]||hash};
 return {data,hashes,symlinks,io};
}
test('complete matching artifact accepted',()=>assert.equal(verify(commit,fixture().io).commit,commit));
test('wrong expected commit rejected',()=>assert.throws(()=>verify('d'.repeat(40),fixture().io),/Commit mismatch/));
test('APK modified rejected',()=>{const f=fixture();f.hashes['MonedaMundial-LAB.apk']=other;assert.throws(()=>verify(commit,f.io),/SHA-256 mismatch/);});
test('dependency lock modified rejected',()=>{const f=fixture();f.hashes['package-lock.json']=other;assert.throws(()=>verify(commit,f.io),/SHA-256 mismatch/);});
test('unexpected or duplicate manifest entry rejected',()=>{const f=fixture();f.data['DEPENDENCIES-SHA256.txt']=hash+'  package-lock.json\n'+hash+'  package-lock.json\n';assert.throws(()=>verify(commit,f.io),/Invalid manifest member/);});
test('traversal entry rejected',()=>{const f=fixture();f.data['SHA256.txt']=hash+'  ../MonedaMundial-LAB.apk\n';assert.throws(()=>verify(commit,f.io),/Invalid manifest member/);});
test('missing or symlinked required member rejected',()=>{const f=fixture();f.symlinks.add('COMMIT.txt');assert.throws(()=>verify(commit,f.io),/Invalid artifact member/);delete f.data['COMMIT.txt'];assert.throws(()=>verify(commit,f.io),/Invalid artifact member/);});
test('wrong project or toolchain rejected',()=>{const f=fixture();f.data['package-lock.json']=JSON.stringify({lockfileVersion:3,packages:{'':{name:'other'}}});assert.throws(()=>verify(commit,f.io),/dependency lock/);const g=fixture();g.data['TOOLCHAIN.txt']='v22.1.0\n10.1.0\nopenjdk version "21.0.1"\n';assert.throws(()=>verify(commit,g.io),/toolchain/);});
