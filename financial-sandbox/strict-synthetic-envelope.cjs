'use strict';
// Internal synthetic protocol only: producers already use JSON.stringify.
// Require the exact compact representation of parsed values (not sorted keys).
// This rejects duplicate keys, escaped aliases and number lexemes that round
// during JSON.parse, before the application can interpret a signed event.
// Not a parser or formatting rule for real provider contracts.
function parseSyntheticEnvelope(raw){
 const fail=()=>{throw Object.assign(Error('INVALID_ENVELOPE'),{code:'INVALID_ENVELOPE'});};
 if(typeof raw!=='string'||Buffer.byteLength(raw)>16384)fail();
 try{
  const value=JSON.parse(raw);
  if(!value||typeof value!=='object'||Array.isArray(value)||JSON.stringify(value)!==raw)fail();
  return value;
 }catch{fail();}
}
module.exports={parseSyntheticEnvelope};
