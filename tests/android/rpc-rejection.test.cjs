const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('App.js','utf8');
const start=source.indexOf('function isDefinitiveRpcRejection(');
const end=source.indexOf('function amountToCents(',start);
assert.ok(start>=0 && end>start);
const ctx=vm.createContext({});
vm.runInContext(source.slice(start,end),ctx);
const cases=[
 ['P0001',400,'Saldo ficticio insuficiente',true],
 ['22023',400,'Importe inválido',true],
 ['42501',400,'Inicia sesión',true],
 ['22023',400,'Identificador reutilizado con datos diferentes',false],
 ['P0001',400,'Reconciliación necesaria',false],
 ['23505',400,'duplicate key',false],
 ['40001',400,'serialization failure',false],
 ['P0001',503,'Unavailable',false],
 [undefined,0,'Network error',false]
];
for(const [code,status,message,expected] of cases) test(String(code)+' '+message,()=>assert.equal(ctx.isDefinitiveRpcRejection({code,message},status),expected));
