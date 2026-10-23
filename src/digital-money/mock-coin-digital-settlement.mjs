// MONEDA MUNDIAL — SIMULADOR AISLADO DE LIQUIDACIÓN Coin ⇄ Digital.
// NO se conecta a blockchain, exchange, proveedor, Supabase, dinero ni React Native.
// La liquidez es un fixture inventado en RAM y nunca constituye saldo, precio o token.
// Todas las cantidades son UNIDADES DE PRUEBA ENTERAS, no cotización en USD.
import { randomUUID } from 'node:crypto';

const ASSETS=Object.freeze(['coin','digital']);
const DEMO_USER='demo_user', DEMO_POOL='demo_pool';
const UNITS=/^(0|[1-9][0-9]{0,17})$/;
const REQUEST=/^[a-zA-Z0-9_-]{12,90}$/;
const QUOTE_TTL_MS=120000;
const LOCK_TTL_MS=60000;
const MAX_MS=8640000000000000;
const fail=message=>{throw new Error(message);};
const validUnits=(value,allowZero=false)=>{
 if(typeof value!=='string'||!UNITS.test(value))fail('Unidades de prueba inválidas');
 const n=BigInt(value);
 if(!allowZero&&n===0n)fail('Se requieren unidades positivas');
 return n;
};
const reqId=value=>{if(typeof value!=='string'||!REQUEST.test(value))fail('Solicitud de prueba inválida');return value;};
const safeTime=now=>{const t=now();if(!Number.isSafeInteger(t)||t<0||t>MAX_MS)fail('Reloj de prueba inválido');return t;};

export function createMockCoinDigitalSettlement({mode='mock',clock=()=>Date.now(),balancesFixture}={}){
 // Fail-closed incluso si quien llama introduce variables de producción.
 if(mode!=='mock')fail('Dinero real bloqueado. El motor sólo acepta modo mock.');
 if(typeof clock!=='function')fail('Reloj no disponible');
 if(!balancesFixture||typeof balancesFixture!=='object'||
   Object.keys(balancesFixture).sort().join(',')!=='demo_pool,demo_user')
    fail('Sólo se permiten cuentas ficticias demo_user y demo_pool');
 const balances=new Map();
 for(const id of [DEMO_USER,DEMO_POOL]){
   const row=balancesFixture[id];
   if(!row||Object.keys(row).sort().join(',')!=='coin,digital')
      fail('Fixture incompleto');
   balances.set(id,{coin:validUnits(row.coin,true),digital:validUnits(row.digital,true),
                    heldCoin:0n,heldDigital:0n});
 }
 const quotes=new Map(),operations=new Map(),requests=new Map(),transitionRequests=new Map(),events=[];
 const totals=Object.fromEntries(ASSETS.map(a=>[a,[...balances.values()].reduce((x,r)=>x+r[a],0n)]));
 const copy=record=>Object.freeze({...record,realPaymentsEnabled:false,realSettlement:false,
    blockchainTransaction:false,stablecoinIssued:false,productionReady:false});
 function account(id){if(!balances.has(id))fail('No existe cuenta ficticia');return balances.get(id);}
 function available(row,asset){return row[asset]-(asset==='coin'?row.heldCoin:row.heldDigital);}
 function setHeld(row,asset,next){if(next<0n)fail('Retención inconsistente');
   if(asset==='coin')row.heldCoin=next;else row.heldDigital=next;}
 function held(row,asset){return asset==='coin'?row.heldCoin:row.heldDigital;}
 function assertInvariant(){
  for(const asset of ASSETS){
   let sum=0n;
   for(const row of balances.values()){
     if(row[asset]<0n||available(row,asset)<0n)fail('Invariante de saldos violada');
     sum+=row[asset];
   }
   if(sum!==totals[asset])fail('Invariante de conservación violada');
  }
 }
 function release(op,reason){
   const row=account(DEMO_USER),pool=account(DEMO_POOL);
   setHeld(row,op.fromAsset,held(row,op.fromAsset)-op.fromUnits);
   setHeld(pool,op.toAsset,held(pool,op.toAsset)-op.toUnits);
   op.status=reason;
   events.push(Object.freeze({type:reason,operationId:op.id}));assertInvariant();
 }
 function expireLocks(){
   const now=safeTime(clock);
   for(const op of operations.values())
      if(op.status==='reserved'&&now>=op.deadline)release(op,'expired');
 }
 function response(op,alreadyProcessed=false){return copy({
   operationId:op.id,status:op.status,
   fromAsset:op.fromAsset,toAsset:op.toAsset,
   fromUnits:op.fromUnits.toString(),toUnits:op.toUnits.toString(),
   alreadyProcessed,simulatedOnly:true,
 });}
 function checkUserId(userId){if(userId!==DEMO_USER)fail('Sólo cuenta ficticia permitida');}
 return Object.freeze({
  mode:'mock',providerConnected:false,canTradeRealAssets:false,
  canAccessProductionBalances:false,
  createScenarioQuote({userId=DEMO_USER,fromAsset,fromUnits,toUnits}={}){
    checkUserId(userId);
    if(!ASSETS.includes(fromAsset))fail('Activo de prueba inválido');
    const toAsset=fromAsset==='coin'?'digital':'coin';
    const amountFrom=validUnits(fromUnits), amountTo=validUnits(toUnits);
    const now=safeTime(clock),id=randomUUID();
    const expiresAt=now+QUOTE_TTL_MS;
    if(!Number.isSafeInteger(expiresAt))fail('Vencimiento inválido');
    const q={id,userId,fromAsset,toAsset,fromUnits:amountFrom,toUnits:amountTo,expiresAt,used:false};
    quotes.set(id,q);
    return copy({quoteId:id,fromAsset,toAsset,fromUnits,toUnits,
      expiresAt,scenarioSource:'manual_fixture_only',priceVerified:false,
      executableMarketQuote:false,canExecuteReal:false});
  },
  reserveScenario({quoteId,userId=DEMO_USER,requestId}={}){
    checkUserId(userId);reqId(requestId);expireLocks();
    const previous=requests.get(requestId);
    if(previous){
      if(previous.quoteId!==quoteId||previous.userId!==userId)
        fail('Idempotency key reutilizada para otra operación');
      return response(operations.get(previous.operationId),true);
    }
    const q=quotes.get(quoteId);
    if(!q||q.userId!==userId)fail('Cotización ficticia inexistente');
    if(q.used)fail('Cotización ya consumida');
    if(safeTime(clock)>=q.expiresAt)fail('Cotización de ejemplo vencida');
    const row=account(DEMO_USER),pool=account(DEMO_POOL);
    if(available(row,q.fromAsset)<q.fromUnits)fail('Saldo de prueba insuficiente');
    if(available(pool,q.toAsset)<q.toUnits)fail('Liquidez ficticia insuficiente');
    const deadline=Math.min(q.expiresAt,safeTime(clock)+LOCK_TTL_MS);
    const op={id:randomUUID(),userId,quoteId,fromAsset:q.fromAsset,toAsset:q.toAsset,
      fromUnits:q.fromUnits,toUnits:q.toUnits,deadline,status:'reserved'};
    setHeld(row,q.fromAsset,held(row,q.fromAsset)+q.fromUnits);
    setHeld(pool,q.toAsset,held(pool,q.toAsset)+q.toUnits);
    operations.set(op.id,op);requests.set(requestId,{quoteId,userId,operationId:op.id});
    q.used=true;
    events.push(Object.freeze({type:'reserved',operationId:op.id}));
    assertInvariant();
    return response(op);
  },
  finalizeScenario({operationId,requestId}={}){
    reqId(requestId);expireLocks();
    const existing=transitionRequests.get(requestId);
    if(existing){
      if(existing.operationId!==operationId||existing.action!=='finalize')fail('Solicitud de cierre reutilizada');
      return copy({...existing.result,alreadyProcessed:true});
    }
    const op=operations.get(operationId);
    if(!op)fail('Orden de prueba inexistente');
    if(op.status!=='reserved')fail('La operación ya no admite liquidación de prueba');
    const user=account(DEMO_USER),pool=account(DEMO_POOL);
    // All four changes are synchronous in the same JS turn. No network calls.
    if(held(user,op.fromAsset)<op.fromUnits||held(pool,op.toAsset)<op.toUnits)
      fail('Reserva de prueba inconsistente');
    setHeld(user,op.fromAsset,held(user,op.fromAsset)-op.fromUnits);
    setHeld(pool,op.toAsset,held(pool,op.toAsset)-op.toUnits);
    user[op.fromAsset]-=op.fromUnits;pool[op.fromAsset]+=op.fromUnits;
    pool[op.toAsset]-=op.toUnits;user[op.toAsset]+=op.toUnits;
    op.status='simulated_completed';
    events.push(Object.freeze({type:'simulated_completed',operationId:op.id}));
    assertInvariant();
    const result=response(op);
    transitionRequests.set(requestId,{operationId,action:'finalize',result});
    return result;
  },
  cancelScenario({operationId,requestId}={}){
    reqId(requestId);expireLocks();
    const existing=transitionRequests.get(requestId);
    if(existing){
      if(existing.operationId!==operationId||existing.action!=='cancel')fail('Solicitud de cierre reutilizada');
      return copy({...existing.result,alreadyProcessed:true});
    }
    const op=operations.get(operationId);
    if(!op||op.status!=='reserved')fail('La operación ya no admite cancelación de prueba');
    release(op,'cancelled');
    const result=response(op);
    transitionRequests.set(requestId,{operationId,action:'cancel',result});
    return result;
  },
  inspectDemoBalance(userId=DEMO_USER){
    expireLocks();const row=account(userId);return copy({
      userId,coinUnits:row.coin.toString(),digitalUnits:row.digital.toString(),
      availableCoinUnits:available(row,'coin').toString(),
      availableDigitalUnits:available(row,'digital').toString(),
      heldCoinUnits:row.heldCoin.toString(),heldDigitalUnits:row.heldDigital.toString(),
      actualMarketPrice:null,actualCustomerFunds:false
    });
  },
  getDemoOperation(operationId){expireLocks();const op=operations.get(operationId);
    return op?response(op):null;},
  // Consulta por requestId: permite verificar una reserva de DEMO tras perder
  // respuesta de red SIN volver a llamar reserveScenario (sólo lectura de estado).
  // NO usar como endpoint público: el motor no autentica clientes verdaderos.
  getDemoReservationByRequest({requestId,userId=DEMO_USER}={}){
    checkUserId(userId);reqId(requestId);expireLocks();
    const found=requests.get(requestId);
    if(!found||found.userId!==userId)return null;
    const op=operations.get(found.operationId);
    return op?response(op):null;
  },
  auditEvents(){return Object.freeze(events.map(v=>({...v})));},
 });
}
