'use strict';
// Operator-owned, immutable, verified snapshot. No seed creation or writable
// ledger handle in the serving process. This runtime is loopback-only.
const {openDigitalCoinWalletSnapshot}=require('./digital-coin-ledger.cjs');
const {createWalletLabServer}=require('./wallet-lab-server.cjs');
function createWalletSnapshotRuntime({environment,enabled=false,path,expected,publishableKey,enrolledActors,fetchImpl,timeoutMs,maxActive,maxConnections}={}){
 if(environment!=='sandbox'||enabled!==true)throw Error('WALLET_LAB_DISABLED');
 const ledger=openDigitalCoinWalletSnapshot({environment,path,expected});
 let server;
 try{server=createWalletLabServer({environment,enabled,ledger,publishableKey,enrolledActors,fetchImpl,timeoutMs,maxActive,maxConnections});}
 catch(e){ledger.close();throw e;}
 let closing;
 return Object.freeze({start:server.start,close(){
  if(!closing)closing=(async()=>{try{await server.close();}finally{ledger.close();}})();
  return closing;
 }});
}
module.exports={createWalletSnapshotRuntime};
