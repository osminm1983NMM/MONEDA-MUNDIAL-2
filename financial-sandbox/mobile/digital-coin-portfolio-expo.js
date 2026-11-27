'use strict';
// Compose the already tested client, host and panel for an isolated Expo screen.
// No default origin or fetch; no persistence; disabled unless explicitly enabled.
const {createPortfolioClient}=require('../digital-coin-portfolio-client.cjs');
const {createPortfolioHost}=require('./digital-coin-portfolio-host.js');
const {createPortfolioPanel}=require('./digital-coin-portfolio-panel.js');
function createExpoPortfolio({React,Native,environment,enabled=false,sandboxOrigin,expoFetch,timeoutMs,onChange,transport='isolated-http',publishableKey}={}){
 if(environment!=='sandbox'||typeof enabled!=='boolean'||typeof onChange!=='function')throw Error('INVALID_WALLET_HOST');
 const Panel=createPortfolioPanel(React,Native);
 let current={enabled:false,revision:0,state:'signed_out'},disposed=false;
 const client=enabled?createPortfolioClient({environment,sandboxOrigin,fetchImpl:requireExpoFetch(expoFetch),timeoutMs,transport,publishableKey}):undefined;
 const host=createPortfolioHost({environment,enabled,client,requireSnapshot:transport==='hosted-snapshot',onChange:view=>{
  current=view;onChange(view);
 }});
 function requireExpoFetch(value){
  if(typeof value!=='function')throw Error('EXPO_FETCH_REQUIRED');
  return value;
 }
 function render(locale='es'){
  const view=current;
  return React.createElement(Panel,{enabled:enabled&&!disposed,revision:view.revision,view,locale,requireSnapshot:transport==='hosted-snapshot',onRefresh:host.refresh});
 }
 return Object.freeze({setSession:host.setSession,refresh:host.refresh,render,
  dispose(){if(disposed)return;disposed=true;host.dispose();}});
}
module.exports={createExpoPortfolio};
