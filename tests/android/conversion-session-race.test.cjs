const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync('App.js','utf8');
const helpers=source.slice(source.indexOf('function beginSwapBusy()'),source.indexOf('useEffect(() =>',source.indexOf('function beginSwapBusy()')));
const handlers=source.slice(source.indexOf('async function loadSwapWallet()'),source.indexOf('async function recoverPendingPickup('));
const q={quoteId:'12345678-1234-4234-8234-123456789abc'};
const q2={quoteId:'469bea32-c0b9-43bd-b2e4-cadcaf0a3883'};
function harness(){
 let actor='A',saved=null;
 const token={current:null},quote={current:q},calls=[],alerts=[],wallets=[],quotes=[],removed=[],busy=[];
 const api=new Function('userId','isCurrentUser','swapBusyTokenRef','setSwapBusy','swapQuoteRef','setSwapQuote','setSwapWallet','setSwapAmount','swapBusy','swapAmount','swapFrom','uniqueRequestId','supabase','AsyncStorage','message','isDefinitiveRpcRejection',helpers+handlers+';return {loadSwapWallet,requestSwapQuote,confirmSwap};')('A',id=>id===actor,token,v=>busy.push(v),quote,v=>quotes.push(v),v=>wallets.push(v),()=>{},false,'1','COIN',()=>q2.quoteId,{rpc:(name,args)=>new Promise(resolve=>calls.push({name,args,resolve}))},{getItem:async()=>saved,setItem:async(k,v)=>{saved=v},removeItem:async k=>{removed.push(k);saved=null}},(...v)=>alerts.push(v),()=>false);
 return {...api,calls,alerts,wallets,quotes,removed,busy,token,quote,saved:()=>saved,cycle:()=>{actor='B';token.current=null;quote.current=null;actor='A';}};
}
test('A-B-A obsolete wallet response cannot replace newer wallet or unlock',async()=>{
 const h=harness(),old=h.loadSwapWallet();h.cycle();const fresh=h.loadSwapWallet();
 h.calls[0].resolve({data:{balance:'old'}});await old;
 assert.equal(h.wallets.length,0);assert.ok(h.token.current);
 h.calls[1].resolve({data:{balance:'new'}});await fresh;
 assert.deepEqual(h.wallets,[{balance:'new'}]);assert.equal(h.token.current,null);
});
test('A-B-A obsolete quote response cannot replace new quote or unlock',async()=>{
 const h=harness(),old=h.requestSwapQuote();await Promise.resolve();h.cycle();const fresh=h.requestSwapQuote();await Promise.resolve();
 h.calls[0].resolve({data:q});await old;
 assert.equal(h.quote.current,null);assert.ok(h.token.current);
 h.calls[1].resolve({data:q2});await fresh;
 assert.equal(h.quote.current.quoteId,q2.quoteId);assert.equal(h.token.current,null);
});
test('A-B-A obsolete conversion success preserves reference for current recovery',async()=>{
 const h=harness(),old=h.confirmSwap(q.quoteId);await Promise.resolve();await Promise.resolve();
 assert.equal(h.calls[0].name,'mwd_conversion_confirm_demo');h.cycle();
 const fresh=h.requestSwapQuote();await fresh;
 assert.equal(h.quote.current.quoteId,q.quoteId);
 h.calls[0].resolve({data:{status:'ok'}});await old;
 assert.equal(h.removed.length,0);assert.ok(h.saved());assert.equal(h.quote.current.quoteId,q.quoteId);
 const confirm=h.confirmSwap(q.quoteId);await Promise.resolve();
 assert.equal(h.calls[1].args.p_quote_id,q.quoteId);
 h.calls[1].resolve({data:{status:'already_processed'}});await Promise.resolve();await Promise.resolve();
 h.calls[2].resolve({data:{balance:'new'}});await confirm;
 assert.equal(h.removed.length,1);assert.equal(h.saved(),null);assert.deepEqual(h.wallets,[{balance:'new'}]);
});
test('A-B-A obsolete conversion rejection cannot report an error or release new request',async()=>{
 const h=harness(),old=h.confirmSwap(q.quoteId);await Promise.resolve();await Promise.resolve();h.cycle();
 const fresh=h.loadSwapWallet();h.calls[0].resolve({error:{message:'old error'}});await old;
 assert.equal(h.alerts.length,0);assert.ok(h.token.current);assert.ok(h.saved());
 h.calls[1].resolve({data:{}});await fresh;
 assert.equal(h.token.current,null);
});
