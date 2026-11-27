const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('App.js','utf8');
const start=source.indexOf('function parsePendingOperation(');
const end=source.indexOf('function isDefinitiveRpcRejection(',start);
assert.ok(start>=0 && end>start);
const ctx=vm.createContext({LIMIT_CENTS:100000000});
vm.runInContext(source.slice(start,end),ctx);
const id='12345678-1234-4234-8234-123456789abc';
const transfer={userId:'a',id,type:'transfer',cents:100,code:'MWD-0123456789ABCDEF'};
const pickup={userId:'a',id,destinationCountry:'HN',cents:100};
for(const [name,fn,valid] of [['transfer',ctx.parsePendingOperation,transfer],['pickup',ctx.parsePendingPickup,pickup]]){
 test(name+' accepts valid reference',()=>assert.equal(fn(JSON.stringify(valid),'a').id,id));
 test(name+' rejects invalid references',()=>{
 for(const value of [null,{...valid,id:'-'.repeat(36)},{...valid,userId:'b'},{...valid,cents:-1},{...valid,cents:0},{...valid,cents:1.5}]) assert.throws(()=>fn(JSON.stringify(value),'a'));
 });
}
test('transfer rejects invalid destination and excessive amount',()=>{
 for(const value of [{...transfer,code:'invalid'},{...transfer,cents:100000001}]) assert.throws(()=>ctx.parsePendingOperation(JSON.stringify(value),'a'));
});

test('contribution accepts only empty recipient code',()=>{
 const valid={...transfer,type:'contribution',code:''};
 assert.equal(ctx.parsePendingOperation(JSON.stringify(valid),'a').type,'contribution');
 assert.throws(()=>ctx.parsePendingOperation(JSON.stringify({...valid,code:transfer.code}),'a'));
});
test('pickup enforces corridor and inclusive limits',()=>{
 for(const cents of [100,100000]) assert.equal(ctx.parsePendingPickup(JSON.stringify({...pickup,cents}),'a').cents,cents);
 for(const value of [{...pickup,cents:99},{...pickup,cents:100001},{...pickup,destinationCountry:'US'}]) assert.throws(()=>ctx.parsePendingPickup(JSON.stringify(value),'a'));
});
test('malformed JSON is rejected',()=>{
 for(const fn of [ctx.parsePendingOperation,ctx.parsePendingPickup]) assert.throws(()=>fn('{','a'));
});
