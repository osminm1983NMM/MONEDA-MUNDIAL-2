'use strict';
// The host must inject fetch imported from expo/fetch, not React Native's
// global fetch. No default origin, credentials, network call, or activation.
const {createOrderStatusClient}=require('../order-status-client.cjs');
function createExpoOrderStatusClient({environment,enabled=false,sandboxOrigin,expoFetch,timeoutMs,transport,publishableKey}={}){
 if(environment!=='sandbox'||enabled!==true||typeof expoFetch!=='function')throw Error('MOBILE_SANDBOX_DISABLED');
 return createOrderStatusClient({environment,sandboxOrigin,fetchImpl:expoFetch,timeoutMs,transport,publishableKey});
}
module.exports={createExpoOrderStatusClient};
