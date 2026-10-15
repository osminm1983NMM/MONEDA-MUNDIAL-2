import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeDemoPartnerDraft,makeDemoBranchDraft,summarizeDemoPayoutAdmin,deleteDemoPartnerDraft} from '../src/payout-admin-drafts.mjs';
test('crea borradores ficticios sin licencias ni pagos reales',()=>{
 const p=makeDemoPartnerDraft({name:'Banco Ejemplo',countryCode:'NI',type:'bank'},'test-partner-001');
 assert.equal(p.status,'draft');
 assert.equal(p.partnerAuthorized,false);
 assert.equal(p.realPaymentsEnabled,false);
 assert.equal(p.licenseVerificationStatus,'not_verified');
 const b=makeDemoBranchDraft({partnerId:p.id,city:'Managua',currencyCode:'NIO',hours:'L-V 9:00-17:00'},'test-branch-001',[p]);
 assert.equal(b.countryCode,'NI');
 assert.equal(b.canPayoutCash,false);
 assert.equal(summarizeDemoPayoutAdmin([p],[b]).authorizedBranches,0);
 const remaining=deleteDemoPartnerDraft([p],[b],p.id);
 assert.equal(remaining.branches.length,0);
});
test('rechaza registros inválidos o sucursales sin socio en borrador',()=>{
 assert.equal(makeDemoPartnerDraft({name:'X',countryCode:'NI',type:'bank'},'test-partner-001'),null);
 assert.equal(makeDemoPartnerDraft({name:'Banco Ejemplo',countryCode:'ZZZ',type:'bank'},'test-partner-001'),null);
 assert.equal(makeDemoPartnerDraft({name:'Banco Ejemplo',countryCode:'NI',type:'unknown'},'test-partner-001'),null);
 assert.equal(makeDemoBranchDraft({partnerId:'unknown',city:'Managua',currencyCode:'NIO',hours:'L-V'},'test-branch-001',[]),null);
});
