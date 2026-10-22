const test=require('node:test');
const assert=require('node:assert/strict');
const {pickupPendingStorageKeyDemo,serializePickupPendingDemo,deserializePickupPendingDemo}=require('../pickupPendingRules');
const id='11111111-1111-4111-8111-111111111111';
const record={id,country:'HN',cents:2500};
test('restaura misma solicitud tras reinicio sin codigo secreto',()=>{
 const raw=serializePickupPendingDemo(record);
 assert.deepEqual(deserializePickupPendingDemo(raw),record);
 assert.equal(raw.includes('SIM-'),false);
 assert.equal(pickupPendingStorageKeyDemo(id),'moneda-mundial:pickup-pending-demo:v1:'+id);
});
test('cambia espacio de almacenamiento por usuario, sin mezcla',()=>{
 assert.notEqual(pickupPendingStorageKeyDemo(id),pickupPendingStorageKeyDemo('22222222-2222-4222-8222-222222222222'));
});
test('no restaura registros corruptos o con datos adicionales',()=>{
 for(const raw of ['oops','{}',JSON.stringify({...record,version:1,mode:'sandbox_only',realPaymentsEnabled:true}),
 JSON.stringify({...record,version:1,mode:'sandbox_only',realPaymentsEnabled:false,pickupCode:'SIM-SECRET'})]){
  assert.equal(deserializePickupPendingDemo(raw),null);
 }
 assert.equal(serializePickupPendingDemo({...record,cents:0}),null);
});
