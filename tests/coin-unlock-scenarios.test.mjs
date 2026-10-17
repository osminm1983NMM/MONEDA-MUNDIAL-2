import test from 'node:test';
import assert from 'node:assert/strict';
import {COIN_ALLOCATION_RESEARCH_PLANS,previewCoinUnlockScenario}
 from '../src/digital-money/coin-unlock-scenarios.mjs';

test('el estudio de 100 millones conserva exactamente oferta asignada',()=>{
 const p=previewCoinUnlockScenario({maximumSupplyUnits:'100000000',planId:'balanced',month:0});
 assert.equal(p.entries.length,4);
 assert.equal(p.hypotheticallyUnlockedUnits,'41000000');
 assert.equal(p.hypotheticallyLockedUnits,'59000000');
 assert.equal(p.entries.find(row=>row.bucket==='team').hypotheticallyUnlockedUnits,'0');
 assert.equal(p.entries.find(row=>row.bucket==='community').allocatedUnits,'35000000');
 assert.equal(p.status,'illustrative_tokenomics_only');
 assert.equal(p.tokenIssued,false);
 assert.equal(p.canSell,false);
});
test('los tokens hipotéticamente liberados crecen sin inventar emisión',()=>{
 for(const planId of Object.keys(COIN_ALLOCATION_RESEARCH_PLANS)){
  const values=[0,1,6,12,24,48,72,120].map(month=>
   previewCoinUnlockScenario({maximumSupplyUnits:'100000000',planId,month}));
  for(let i=1;i<values.length;i++){
   assert.ok(BigInt(values[i].hypotheticallyUnlockedUnits)>=
             BigInt(values[i-1].hypotheticallyUnlockedUnits));
  }
  const end=values.at(-1);
  assert.equal(end.hypotheticallyUnlockedUnits,'100000000');
  assert.equal(end.hypotheticallyLockedUnits,'0');
  assert.equal(end.officialDistributionApproved,false);
  assert.equal(end.unlockedMeansCirculating,false);
 }
});
test('suministro indivisible se conserva y residuos se asignan a reserva',()=>{
 const p=previewCoinUnlockScenario({maximumSupplyUnits:'101',planId:'balanced',month:0});
 assert.equal(p.roundingRemainderAssignedToReserveUnits,'2');
 assert.equal(p.entries.reduce((sum,row)=>sum+BigInt(row.allocatedUnits),0n),101n);
 assert.equal(BigInt(p.hypotheticallyUnlockedUnits)+BigInt(p.hypotheticallyLockedUnits),101n);
});
test('el inicio del cliff no acelera la liberación del equipo',()=>{
 const at12=previewCoinUnlockScenario({maximumSupplyUnits:'100000000',planId:'balanced',month:12});
 const at13=previewCoinUnlockScenario({maximumSupplyUnits:'100000000',planId:'balanced',month:13});
 const team12=at12.entries.find(r=>r.bucket==='team');
 const team13=at13.entries.find(r=>r.bucket==='team');
 assert.equal(team12.hypotheticallyUnlockedUnits,'0');
 assert.ok(BigInt(team13.hypotheticallyUnlockedUnits)>0n);
});
test('una proyección nunca autoriza comercio ni acredita liquidez',()=>{
 const x=previewCoinUnlockScenario({maximumSupplyUnits:'1000000000',planId:'broad_distribution',month:120});
 for(const k of ['tokenIssued','officialDistributionApproved','liquidityAvailable',
  'priceDefined','canMint','canBuy','canSell','canSend','realMoneyEnabled'])
   assert.equal(x[k],false,k);
});
test('rechaza exceso de meses, suministro inválido y políticas no aprobadas',()=>{
 const base={maximumSupplyUnits:'100000000',planId:'balanced',month:0};
 for(const change of [
  {month:-1},{month:121},{month:0.5},{month:'12'},
  {maximumSupplyUnits:'0'},{maximumSupplyUnits:'1.5'},
  {maximumSupplyUnits:'1e8'},{maximumSupplyUnits:'-100'},
  {maximumSupplyUnits:100000000},{planId:'official'},
 ]){
  assert.equal(previewCoinUnlockScenario({...base,...change}),null);
 }
});
