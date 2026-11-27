'use strict';
// Private local wallet runtime. Explicit enablement, fixed loopback only.
// This is NOT a public HTTPS deployment. The caller owns the audited ledger.
const http=require('node:http');
const {createHostedWalletService}=require('./hosted-wallet-auth.cjs');
const {createPortfolioHttp}=require('./digital-coin-portfolio-http.cjs');
const route='/v1/sandbox/wallet/portfolio';
function createWalletLabServer({environment,enabled=false,ledger,publishableKey,enrolledActors,fetchImpl,timeoutMs=8000,maxActive=8,maxConnections=16}={}){
 if(environment!=='sandbox'||enabled!==true)throw Error('WALLET_LAB_DISABLED');
 if(!Number.isInteger(maxConnections)||maxConnections<1||maxConnections>64)throw Error('INVALID_CONNECTION_LIMIT');
 const service=createHostedWalletService({environment,enabled,ledger,publishableKey,enrolledActors,fetchImpl});
 const handle=createPortfolioHttp({environment,service,timeoutMs,maxActive});
 function reply(res,status,code,extra={}){
  if(res.destroyed||res.writableEnded)return;
  res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','connection':'close',...extra});
  res.end(JSON.stringify({mode:'sandbox',error:code}));
 }
 const server=http.createServer({maxHeaderSize:12288,headersTimeout:5000,requestTimeout:10000,connectionsCheckingInterval:1000},async(req,res)=>{
  req.on('error',()=>{});res.on('error',()=>{});
  try{
   const authority='127.0.0.1:'+req.socket.localPort;
   const counts=Object.create(null);
   for(let i=0;i<req.rawHeaders.length;i+=2){const k=req.rawHeaders[i].toLowerCase();counts[k]=(counts[k]??0)+1;}
   if(['host','authorization','origin','content-length','transfer-encoding'].some(k=>counts[k]>1)||req.headers.host!==authority)return reply(res,400,'INVALID_REQUEST');
   if(req.headers.origin!==undefined&&req.headers.origin!=='http://'+authority)return reply(res,403,'ORIGIN_NOT_ALLOWED');
   if(req.url!==route)return reply(res,req.url?.startsWith(route+'?')?400:404,req.url?.startsWith(route+'?')?'INVALID_REQUEST':'NOT_FOUND');
   if(req.method!=='GET')return reply(res,405,'METHOD_NOT_ALLOWED',{allow:'GET'});
   if(req.headers['transfer-encoding']!==undefined||(req.headers['content-length']!==undefined&&req.headers['content-length']!=='0'))return reply(res,400,'INVALID_REQUEST');
   const auth=req.headers.authorization;
   if(typeof auth!=='string'||!/^Bearer [A-Za-z0-9._~-]{1,8192}$/i.test(auth))return reply(res,401,'AUTH_REQUIRED',{'www-authenticate':'Bearer'});
   const controller=new AbortController();
   const disconnect=()=>{if(!res.writableFinished)controller.abort();};
   res.once('close',disconnect);
   try{
    if(res.destroyed)controller.abort();
    const result=await handle(new Request('http://'+authority+route,{method:'GET',headers:{authorization:auth},signal:controller.signal}));
    if(controller.signal.aborted||res.destroyed||res.writableEnded)return;
    const bytes=Buffer.from(await result.arrayBuffer());
    if(controller.signal.aborted||res.destroyed||res.writableEnded)return;
    res.writeHead(result.status,{...Object.fromEntries(result.headers),'connection':'close'});res.end(bytes);
   }finally{res.off('close',disconnect);}
  }catch{return reply(res,503,'UNAVAILABLE');}
 });
 server.maxConnections=maxConnections;server.maxRequestsPerSocket=1;
 server.on('checkContinue',(_req,res)=>reply(res,417,'INVALID_REQUEST'));
 server.on('checkExpectation',(_req,res)=>reply(res,417,'INVALID_REQUEST'));
 server.on('upgrade',(_req,socket)=>socket.destroy());
 server.on('connect',(_req,socket)=>socket.destroy());
 let state='idle',starting,closing;
 return Object.freeze({
  start(){
   if(state!=='idle')return Promise.reject(Error('INVALID_LISTENER_STATE'));
   state='starting';
   starting=new Promise((resolve,reject)=>{
    const fail=e=>{server.off('listening',ready);state='closed';reject(e);};
    const ready=()=>{server.off('error',fail);if(state==='starting')state='running';resolve('http://127.0.0.1:'+server.address().port);};
    server.once('error',fail);server.once('listening',ready);server.listen(0,'127.0.0.1');
   });
   return starting;
  },
  close(){
   if(closing)return closing;
   state='closing';
   closing=(async()=>{
    try{if(starting)await starting.catch(()=>{});if(server.listening)await new Promise((resolve,reject)=>{server.close(e=>e?reject(e):resolve());server.closeAllConnections();});}
    finally{state='closed';}
   })();
   return closing;
  }
 });
}
module.exports={createWalletLabServer};
