'use strict';
// Private operator export for a future hosted read-only LAB projection.
// It is a point-in-time synthetic snapshot, NOT a live balance service.
// Do not commit exported account data, use this for production, or infer
// financial finality from the export timestamp or manifest digest.
const {openDigitalCoinWalletSnapshot}=require('./digital-coin-ledger.cjs');
const {readDigitalCoinPortfolio}=require('./digital-coin-portfolio.cjs');
const {validPortfolio}=require('./digital-coin-portfolio-contract.cjs');
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v);
function exportWalletSnapshot({environment,enabled=false,path,expected,enrolledActors,exportedAt}={}){
 if(environment!=='sandbox'||enabled!==true)throw Error('WALLET_EXPORT_DISABLED');
 if(!Array.isArray(enrolledActors)||enrolledActors.length<1||enrolledActors.length>100||!enrolledActors.every(uuid)||new Set(enrolledActors).size!==enrolledActors.length)throw Error('INVALID_ENROLLMENT');
 if(typeof exportedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(exportedAt)||!Number.isFinite(Date.parse(exportedAt))||new Date(exportedAt).toISOString()!==exportedAt)throw Error('INVALID_EXPORT_TIME');
 const actors=[...enrolledActors].sort();
 const reader=openDigitalCoinWalletSnapshot({environment,path,expected});
 try{
  // All user projections use the same verified transaction snapshot.
  const cut=reader.reconciliationSnapshot(),ledger={reconciliationSnapshot:()=>cut};
  const portfolios=actors.map(actor=>{
   const portfolio=readDigitalCoinPortfolio({environment,ledger,verifiedActor:actor});
   if(!validPortfolio(portfolio))throw Error('INVALID_PORTFOLIO');
   return {actor,portfolio};
  });
  return {mode:'sandbox',kind:'immutable_wallet_snapshot',exportedAt,sourceManifestSha256:cut.manifest.sha256,sourceEventCount:cut.manifest.events,portfolios};
 }finally{reader.close();}
}
module.exports={exportWalletSnapshot};
