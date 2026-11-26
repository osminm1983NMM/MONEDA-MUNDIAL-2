'use strict';
// Offline verification of a downloaded, safely extracted LAB artifact.
// Usage: node scripts/verify-lab-artifact.cjs <directory> <expected-40-char-commit>
// Expected commit must be independently obtained from the workflow checkout.
// No network, no modification of files, no execution of APK or lockfile contents.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const required = ['MonedaMundial-LAB.apk','SHA256.txt','COMMIT.txt','package-lock.json','TOOLCHAIN.txt','DEPENDENCIES-SHA256.txt'];
function verify(expected, io) {
  if (!/^[a-f0-9]{40}$/.test(expected || '')) throw Error('Invalid expected commit');
  for (const file of required) {
    const stat = io.stat(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0) throw Error('Invalid artifact member: '+file);
  }
  const commit = io.readText('COMMIT.txt').trim();
  if (commit !== expected) throw Error('Commit mismatch');
  function manifest(file, wanted) {
    const rows = io.readText(file).trim().split(/\r?\n/);
    if (rows.length !== wanted.length) throw Error('Unexpected manifest length: '+file);
    const seen = new Set();
    for (const row of rows) {
      const match = /^([a-f0-9]{64}) [ *]([A-Za-z0-9.-]+)$/.exec(row);
      if (!match || !wanted.includes(match[2]) || seen.has(match[2])) throw Error('Invalid manifest member: '+file);
      if (io.hash(match[2]) !== match[1]) throw Error('SHA-256 mismatch: '+match[2]);
      seen.add(match[2]);
    }
  }
  manifest('SHA256.txt',['MonedaMundial-LAB.apk']);
  manifest('DEPENDENCIES-SHA256.txt',['package-lock.json','TOOLCHAIN.txt']);
  const lock = JSON.parse(io.readText('package-lock.json'));
  if (!Number.isInteger(lock.lockfileVersion) || lock.lockfileVersion < 2 || !lock.packages || lock.packages['']?.name !== 'moneda-mundial-2') throw Error('Unexpected dependency lock');
  const toolchain = io.readText('TOOLCHAIN.txt');
  if (!/^v\d+\.\d+\.\d+\r?\n\d+\.\d+\.\d+\r?\n/.test(toolchain) || !/version\s+"?17\b/i.test(toolchain)) throw Error('Unexpected toolchain record');
  return {commit, apkSha256:io.hash('MonedaMundial-LAB.apk'), apkBytes:io.stat('MonedaMundial-LAB.apk').size, dependencyLockSha256:io.hash('package-lock.json')};
}
function nativeIO(directory) {
  return {
    stat: file => fs.lstatSync(path.join(directory,file)),
    readText: file => fs.readFileSync(path.join(directory,file),'utf8'),
    hash: file => crypto.createHash('sha256').update(fs.readFileSync(path.join(directory,file))).digest('hex'),
  };
}
if (require.main === module) {
  try {
    if (process.argv.length !== 4) throw Error('Usage: verify-lab-artifact.cjs <directory> <expected-commit>');
    const [dir,commit] = process.argv.slice(2);
    console.log(JSON.stringify(verify(commit,nativeIO(dir)),null,2));
    console.log('PASS: checksums, provenance and dependency manifest. Not APK signature or device acceptance.');
  } catch (error) { console.error('FAIL: '+error.message); process.exitCode=1; }
}
module.exports = {verify,nativeIO};
