'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {buildWalletAcceptanceFixture}=require('../../financial-sandbox/wallet-acceptance-fixture.cjs');
test('audited hosted acceptance fixture has distinct isolated synthetic portfolios',()=>{
 const now=new Date().toISOString(),snapshot=buildWalletAcceptanceFixture(now);
 a.equal(snapshot.sourceEventCount,3);a.match(snapshot.sourceManifestSha256,/^[a-f0-9]{64}$/);
 a.equal(snapshot.portfolios.length,2);
 const [one,two]=snapshot.portfolios;
 a.deepEqual(one.portfolio.assets.map(x=>x.availableMinor),['700','300']);
 a.deepEqual(two.portfolio.assets.map(x=>x.availableMinor),['100','0']);
 a.equal(one.portfolio.conversions[0].state,'confirmed');a.deepEqual(two.portfolio.conversions,[]);
 a.deepEqual(snapshot,buildWalletAcceptanceFixture(now));
 // Only fixed fictitious account identifiers and synthetic data are printed.
 // The acceptance operator may map A/B privately to existing LAB accounts.
 console.log('MWD_SYNTHETIC_WALLET_ACCEPTANCE_EXPORT='+JSON.stringify(snapshot));
});
