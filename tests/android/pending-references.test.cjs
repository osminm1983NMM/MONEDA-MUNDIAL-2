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
