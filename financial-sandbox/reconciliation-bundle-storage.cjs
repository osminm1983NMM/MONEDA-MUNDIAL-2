'use strict';
// Local POSIX laboratory only. Trusted, private directory; no live data.
const fs=require('node:fs');
const {join}=require('node:path');
const {randomUUID}=require('node:crypto');
const {createReconciliationBundle}=require('./reconciliation-evidence-bundle.cjs');
const MAX_BYTES=80*1024*1024;
const fail=code=>{throw Object.assign(Error(code),{code});};
function target({environment,directory,archive,receiptId}){
 if(environment!=='sandbox')fail('SANDBOX_ONLY');
 if(typeof directory!=='string'||!directory||typeof archive?.verifyArchivedBundle!=='function'||
 typeof receiptId!=='string'||!/^[a-f0-9]{64}$/.test(receiptId))fail('INVALID_STORAGE_CONFIG');
 if(!fs.lstatSync(directory).isDirectory())fail('INVALID_STORAGE_DIRECTORY');
 return join(directory,receiptId+'.json');
}
function canonical(environment,bundle){
 if(bundle?.format!=='synthetic-reconciliation-bundle-v1')fail('INVALID_BUNDLE');
 return createReconciliationBundle({environment,internalPages:bundle.internalPages,providerPages:bundle.providerPages}).bundle;
}
function load(path){
 const fd=fs.openSync(path,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW|fs.constants.O_NONBLOCK);
 try{
  const stat=fs.fstatSync(fd);
  if(!stat.isFile()||stat.size<1||stat.size>MAX_BYTES)fail('INVALID_BUNDLE_FILE');
  // Allocate only the already validated size. A growing file cannot cause
  // readFileSync to allocate beyond MAX_BYTES after the initial fstat.
  const bytes=Buffer.alloc(stat.size);
  let offset=0;
  while(offset<bytes.length){
   const n=fs.readSync(fd,bytes,offset,bytes.length-offset,offset);
   if(n===0)fail('INVALID_BUNDLE_FILE');
   offset+=n;
  }
  const extra=Buffer.alloc(1);
  if(fs.readSync(fd,extra,0,1,offset)!==0)fail('INVALID_BUNDLE_FILE');
  const after=fs.fstatSync(fd);
  if(after.size!==stat.size||after.mtimeMs!==stat.mtimeMs||after.ctimeMs!==stat.ctimeMs)fail('INVALID_BUNDLE_FILE');
  return bytes;
 }finally{fs.closeSync(fd);}
}
function syncDirectory(directory){
 const fd=fs.openSync(directory,fs.constants.O_RDONLY|fs.constants.O_DIRECTORY|fs.constants.O_NOFOLLOW);
 try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
}
function readStoredBundle(options={}){
 const path=target(options),bytes=load(path);
 let parsed;
 try{parsed=JSON.parse(bytes.toString('utf8'));}catch{fail('INVALID_BUNDLE_FILE');}
 const bundle=canonical(options.environment,parsed);
 // Only normalized fields are allowed in the persisted representation.
 if(!bytes.equals(Buffer.from(JSON.stringify(bundle))))fail('NONCANONICAL_BUNDLE_FILE');
 const receipt=options.archive.verifyArchivedBundle(options.receiptId,bundle);
 return {bundle,receipt};
}
function saveStoredBundle(options={}){
 const path=target(options),bundle=canonical(options.environment,options.bundle);
 const receipt=options.archive.verifyArchivedBundle(options.receiptId,bundle);
 const bytes=Buffer.from(JSON.stringify(bundle));
 if(bytes.length>MAX_BYTES)fail('BUNDLE_TOO_LARGE');
 const temp=join(options.directory,'.pending-'+randomUUID());
 let fd,created=false;
 try{
  fd=fs.openSync(temp,'wx',0o600);created=true;
  fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);fs.closeSync(fd);fd=undefined;
  let status='stored';
  try{fs.linkSync(temp,path);}
  catch(e){
   if(e.code!=='EEXIST')throw e;
   // Never replace an existing file, even if it is corrupt.
   if(!load(path).equals(bytes))fail('BUNDLE_FILE_CONFLICT');
   status='duplicate';
  }
  fs.unlinkSync(temp);created=false;
  syncDirectory(options.directory);
  return {status,receipt};
 }finally{
  if(fd!==undefined)fs.closeSync(fd);
  if(created)fs.unlinkSync(temp);
 }
}
// Run only while archive and bundle writers are paused. This is a coverage
// report, not a snapshot across two stores or permission to release funds.
function auditStoredBundles({environment,directory,archive,limit=1000}={}){
 if(environment!=='sandbox')fail('SANDBOX_ONLY');
 if(typeof directory!=='string'||!directory||typeof archive?.listReceiptIds!=='function'||
 typeof archive?.verifyArchivedBundle!=='function')fail('INVALID_STORAGE_CONFIG');
 if(!Number.isSafeInteger(limit)||limit<1||limit>10000)fail('INVALID_INVENTORY_LIMIT');
 if(!fs.lstatSync(directory).isDirectory())fail('INVALID_STORAGE_DIRECTORY');
 const ids=archive.listReceiptIds({limit}),expected=new Set(ids);
 const files=new Set(),pending=[],unexpected=[];
 const dir=fs.opendirSync(directory);let count=0;
 try{
  let entry;
  while((entry=dir.readSync())!==null){
   if(++count>limit)fail('INVENTORY_LIMIT_EXCEEDED');
   const name=entry.name;
   if(/^[a-f0-9]{64}\.json$/.test(name))files.add(name.slice(0,-5));
   else if(/^\.pending-[a-f0-9-]{36}$/.test(name))pending.push(name);
   else unexpected.push(name);
  }
 }finally{dir.closeSync();}
 const missing=ids.filter(id=>!files.has(id)),orphaned=[...files].filter(id=>!expected.has(id)).sort();
 const verified=[],invalid=[];
 for(const receiptId of ids){
  if(!files.has(receiptId))continue;
  try{readStoredBundle({environment,directory,archive,receiptId});verified.push(receiptId);}
  catch(e){invalid.push({receiptId,code:typeof e.code==='string'?e.code:'BUNDLE_READ_FAILED'});}
 }
 return {mode:'sandbox',completeCoverage:missing.length===0&&orphaned.length===0&&
  invalid.length===0&&pending.length===0&&unexpected.length===0,
  receipts:ids.length,verified,missing,orphaned,invalid,pending:pending.sort(),unexpected:unexpected.sort()};
}
module.exports={saveStoredBundle,readStoredBundle,auditStoredBundles};
