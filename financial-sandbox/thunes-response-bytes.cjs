'use strict';
// Bounded offline decoder for synthetic provider response bytes. No HTTP,
// authentication, logging of payloads, financial event or production access.
const {TextDecoder}=require('node:util');
const {inspectThunesCorridorObservation}=require('./thunes-corridor-observation.cjs');
const MAX_BYTES=65536,MAX_DEPTH=24,MAX_NODES=10000;
const fail=code=>{throw Object.assign(Error(code),{code});};
class NumberLexeme{constructor(text){this.text=text;}}
function decode(raw){
 if(!Buffer.isBuffer(raw)||raw.length===0||raw.length>MAX_BYTES)fail('INVALID_RESPONSE_BYTES');
 let source;
 try{source=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(raw);}catch{fail('INVALID_UTF8');}
 let i=0,nodes=0;
 const white=/[ \t\r\n]*/y,num=/-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/y;
 const str=/"(?:[^"\\\u0000-\u001f]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*"/y;
 function skip(){white.lastIndex=i;white.exec(source);i=white.lastIndex;}
 function string(){str.lastIndex=i;const m=str.exec(source);if(!m)fail('INVALID_JSON');i=str.lastIndex;return JSON.parse(m[0]);}
 function value(depth){
  if(depth>MAX_DEPTH||++nodes>MAX_NODES)fail('RESPONSE_LIMIT');
  skip();const ch=source[i];
  if(ch==='"')return string();
  if(ch==='{'){
   i++;skip();const out=Object.create(null);
   if(source[i]==='}'){i++;return out;}
   while(true){
    skip();const k=string();
    if(Object.hasOwn(out,k))fail('DUPLICATE_JSON_KEY');
    skip();if(source[i++]!==':')fail('INVALID_JSON');
    out[k]=value(depth+1);skip();const end=source[i++];
    if(end==='}')return out;if(end!==',')fail('INVALID_JSON');
   }
  }
  if(ch==='['){
   i++;skip();const out=[];if(source[i]===']'){i++;return out;}
   while(true){out.push(value(depth+1));skip();const end=source[i++];if(end===']')return out;if(end!==',')fail('INVALID_JSON');}
  }
  for(const [token,v] of [['true',true],['false',false],['null',null]]){
   if(source.startsWith(token,i)){i+=token.length;return v;}
  }
  num.lastIndex=i;const m=num.exec(source);if(!m)fail('INVALID_JSON');
  i=num.lastIndex;return new NumberLexeme(m[0]);
 }
 const result=value(0);skip();if(i!==source.length)fail('INVALID_JSON');
 if(!result||Object.getPrototypeOf(result)!==null)fail('INVALID_RESPONSE_OBJECT');
 return result;
}
function integer(v){
 if(!(v instanceof NumberLexeme)||!/^[1-9][0-9]{0,15}$/.test(v.text))return null;
 const n=BigInt(v.text);return n<=BigInt(Number.MAX_SAFE_INTEGER)?Number(n):null;
}
function amount(v){return v instanceof NumberLexeme?v.text:null;}
function inspectThunesResponseBytes({environment,expected,raw}={}){
 if(environment!=='sandbox')fail('SANDBOX_ONLY');
 const x=decode(raw);
 const transaction={
  id:integer(x.id),external_id:x.external_id,transaction_type:x.transaction_type,
  status:x.status,status_message:x.status_message,status_class:x.status_class,status_class_message:x.status_class_message,
  source:{country_iso_code:x.source?.country_iso_code,currency:x.source?.currency,amount:amount(x.source?.amount)},
  destination:{currency:x.destination?.currency,amount:amount(x.destination?.amount)},
  payer:{id:integer(x.payer?.id),country_iso_code:x.payer?.country_iso_code,currency:x.payer?.currency,
   service:{id:integer(x.payer?.service?.id)}}
 };
 return inspectThunesCorridorObservation({environment,expected,transaction});
}
module.exports={inspectThunesResponseBytes};
