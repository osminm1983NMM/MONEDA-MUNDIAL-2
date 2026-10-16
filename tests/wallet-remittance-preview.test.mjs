import test from 'node:test';
import assert from 'node:assert/strict';
import {previewWalletRemittance as preview,SOURCES,PAYOUTS} from '../src/digital-money/wallet-remittance-preview.mjs';
test('ningún MWD, Coin o Digital puede financiar remesas reales o ficticias',()=>{
 for(const source of ['demo_wallet','digital_concept','coin_concept'])
  for(const payout of PAYOUTS.map(p=>p.id)){
   const r=preview({source,payout,destination:'NI',
     hypotheticalUsdCents:999999,realPaymentsEnabled:true,walletBalanceCents:999999999});
   assert.equal(r.illustrativeUsdCents,null);
   assert.equal(r.illustrativeReceiveCents,null);
   assert.equal(r.walletDebitedCents,0);
   assert.equal(r.creditsHaveUsdValue,false);
   assert.equal(r.canSend,false);assert.equal(r.canDisburse,false);
   assert.equal(r.canIssueRedeemableCode,false);
  }
});
test('sólo USD externo hipotético puede visualizar comisiones y nunca inventa FX',()=>{
 const r=preview({source:'external_usd_scenario',destination:'NI',hypotheticalUsdCents:10000});
 assert.equal(r.illustrativeUsdCents,10000);
 assert.ok(r.illustrativeFeeCents>0);
 assert.equal(r.fxRate,null);
 assert.equal(r.illustrativeReceiveCents,null);
 assert.equal(r.providerConnected,false);
 assert.equal(r.realPaymentsEnabled,false);
});
test('un destino USD tampoco habilita dinero real',()=>{
 const r=preview({source:'external_usd_scenario',destination:'SV',
   payout:'payment_card',funding:'card',hypotheticalUsdCents:10000});
 assert.equal(r.illustrativeReceiveCents,10000);
 assert.equal(r.canChargeCard,false);assert.equal(r.canDebitWallet,false);
});
test('rechaza países no configurados, montos o métodos irregulares',()=>{
 assert.equal(SOURCES.length,4);assert.equal(PAYOUTS.length,3);
 for(const p of [{source:'usd_real'},{destination:'FR'},{payout:'atm'},
  {hypotheticalUsdCents:99},{hypotheticalUsdCents:10000001},
  {hypotheticalUsdCents:10.5},{funding:'coin'}])assert.equal(preview(p),null);
});
