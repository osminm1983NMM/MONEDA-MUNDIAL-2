const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const s=fs.readFileSync('App.js','utf8');
const ctx=vm.createContext({LIMIT_CENTS:100000000});
vm.runInContext(s.slice(s.indexOf('function amountToCents('),s.indexOf('function uniqueRequestId(')),ctx);
for(const [v,e] of [["0.01",1],["1,25",125],[" 10.1 ",1010],["1000000",100000000],["1000000.01",null],["0",null],["-1",null],["1.001",null],["1e3",null],["1,2.3",null],[null,null],["",null],["999999.99",99999999]]) test('amount '+JSON.stringify(v),()=>assert.equal(ctx.amountToCents(v),e));
