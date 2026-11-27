'use strict';
// Actual HTTP transport for an isolated, loopback-only laboratory.
// No public listener, TLS termination, provider calls or credential discovery.
const http=require('node:http');
const {createOrderStatusHttp,route}=require('./order-status-http.cjs');
const origin='http://127.0.0.1';
const maxBody=1024;
function reply(res,status,code,extra={}){
 if(res.destroyed||res.writableEnded)return;
 res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','connection':'close',...extra});
 res.end(JSON.stringify({mode:'sandbox',error:code}));
}
function readBody(req,ms){
 return new Promise((resolve,reject)=>{
  let size=0;const chunks=[];
  const finish=(err,value)=>{
   clearTimeout(timer);req.off('data',data);req.off('end',end);req.off('aborted',abort);req.off('error',abort);
   req.pause();if(err)reject(err);else resolve(value);
  };
  const data=chunk=>{size+=chunk.length;if(size>maxBody)finish(Error('BODY_TOO_LARGE'));else chunks.push(chunk);};
  const end=()=>finish(null,Buffer.concat(chunks,size));
  const abort=()=>finish(Error('ABORTED'));
  const timer=setTimeout(()=>finish(Error('DEADLINE')),ms);
  req.on('data',data);req.once('end',end);req.once('aborted',abort);req.once('error',abort);
 });
}
function createOrderStatusLoopback({environment,service,bodyTimeoutMs=5000,serviceTimeoutMs=8000,maxActive=32,maxConnections=64}={}){
 if(environment!=='sandbox')throw Error('SANDBOX_ONLY');
 if(!Number.isInteger(maxConnections)||maxConnections<1||maxConnections>256)throw Error('INVALID_CONNECTION_LIMIT');
 const handle=createOrderStatusHttp({environment,service,bodyTimeoutMs,serviceTimeoutMs,maxActive});
 const server=http.createServer({maxHeaderSize:12288,headersTimeout:5000,requestTimeout:Math.max(6000,bodyTimeoutMs+1000),connectionsCheckingInterval:1000},async(req,res)=>{
  // Never log raw headers, tokens, bodies or internal exceptions.
  req.on('error',()=>{});res.on('error',()=>{});
  try{
   if(req.url!==route)return reply(res,req.url?.startsWith(route+'?')?400:404,req.url?.startsWith(route+'?')?'INVALID_REQUEST':'NOT_FOUND');
   if(req.method!=='POST')return reply(res,405,'METHOD_NOT_ALLOWED',{allow:'POST'});
   // Raw duplicate detection, before Node's normalized header map can hide one.
   const counts=Object.create(null);
   for(let i=0;i<req.rawHeaders.length;i+=2){const key=req.rawHeaders[i].toLowerCase();counts[key]=(counts[key]??0)+1;}
   if(['host','origin','authorization','content-type','content-length','transfer-encoding'].some(k=>counts[k]>1))return reply(res,400,'INVALID_REQUEST');
   // Bind both the TCP listener and HTTP authority to the same loopback
   // endpoint; reject cross-origin browser requests and DNS rebinding hosts.
   const authority='127.0.0.1:'+req.socket.localPort;
   if(req.headers.host!==authority)return reply(res,400,'INVALID_REQUEST');
   if(req.headers.origin!==undefined&&req.headers.origin!==('http://'+authority))return reply(res,403,'ORIGIN_NOT_ALLOWED');
   const auth=req.headers.authorization;
   if(typeof auth!=='string'||!/^Bearer [A-Za-z0-9._~-]{1,8192}$/i.test(auth))return reply(res,401,'AUTH_REQUIRED',{'www-authenticate':'Bearer'});
   const media=req.headers['content-type'];
   if(typeof media!=='string'||media.split(';')[0].trim().toLowerCase()!=='application/json')return reply(res,415,'UNSUPPORTED_MEDIA_TYPE');
   const size=req.headers['content-length'];
   if(size!==undefined&&(!/^\d{1,10}$/.test(size)||Number(size)>maxBody))return reply(res,413,'BODY_TOO_LARGE');
   let body;
   try{body=await readBody(req,bodyTimeoutMs);}catch(e){
    if(e.message==='ABORTED')return;
    return reply(res,e.message==='BODY_TOO_LARGE'?413:408,e.message==='BODY_TOO_LARGE'?'BODY_TOO_LARGE':'INVALID_REQUEST');
   }
   if(res.destroyed)return;
   const response=await handle(new Request(origin+route,{method:'POST',headers:{authorization:auth,'content-type':media},body}));
   if(res.destroyed||res.writableEnded)return;
   res.writeHead(response.status,{...Object.fromEntries(response.headers),'connection':'close'});
   res.end(Buffer.from(await response.arrayBuffer()));
  }catch{return reply(res,503,'UNAVAILABLE');}
 });
 server.maxConnections=maxConnections;server.maxRequestsPerSocket=1;
 server.on('checkContinue',(req,res)=>reply(res,417,'INVALID_REQUEST'));
 server.on('checkExpectation',(req,res)=>reply(res,417,'INVALID_REQUEST'));
 server.on('upgrade',(_req,socket)=>socket.destroy());
 server.on('connect',(_req,socket)=>socket.destroy());
 // Return only a fixed-bind lifecycle; never expose a configurable host.
 return Object.freeze({
  async start(port=0){
   if(!Number.isInteger(port)||port<0||port>65535||server.listening)throw Error('INVALID_LISTENER');
   await new Promise((resolve,reject)=>{
    const fail=e=>{server.off('listening',ready);reject(e);};
    const ready=()=>{server.off('error',fail);resolve();};
    server.once('error',fail);server.once('listening',ready);server.listen(port,'127.0.0.1');
   });
   return origin+':'+server.address().port;
  },
  async close(){
   if(!server.listening)return;
   await new Promise((resolve,reject)=>{server.close(e=>e?reject(e):resolve());server.closeAllConnections();});
  }
 });
}
module.exports={createOrderStatusLoopback};
