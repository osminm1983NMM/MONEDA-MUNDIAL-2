// Moneda Mundial 2.0 — seguridad de código de retiro EXCLUSIVAMENTE FICTICIO.
// Este laboratorio en memoria no comprueba documentos, no se conecta a agentes,
// no crea instrumentos financieros, NO verifica identidad real ni entrega dinero.
import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';

const CASE=/^SIM-(HN|NI)-[A-Z0-9]{8,30}$/;
const ALIAS=/^SAMPLE-(HN|NI)-[A-Z0-9]{6,25}$/;
const SAMPLE_CODE=/^SIMONLY-[0-9A-F]{32}$/; // 128 bits aleatorios, NO cobrables.
const LIFE_MS=15*60*1000,MAX_FAILED=5;
const fail=message=>{throw new Error(message)};
const readonly=o=>Object.freeze({...o});
function hashCode(secret,caseId,code){
 return createHmac('sha256',secret).update('MWD_CASH_PICKUP_MOCK_V1\n'+caseId+'\n'+code).digest();
}
const equal=(a,b)=>a.length===b.length&&timingSafeEqual(a,b);

export function createMockCashPickupVerifier({mode='mock',secret,clock=()=>Date.now()}={}){
 if(mode!=='mock')fail('RETIRO DE DINERO REAL BLOQUEADO');
 if(typeof secret!=='string'||secret.length<32||secret.length>200)
  fail('Se requiere clave fuerte de laboratorio almacenada en el servidor');
 if(typeof clock!=='function')fail('Reloj no disponible');
 const cases=new Map(),audit=[];
 function now(){
  const value=clock();
  if(!Number.isSafeInteger(value)||value<0)fail('Reloj inválido');
  return value;
 }
 function publicCase(item){
  return readonly({caseId:item.caseId,destination:item.country,
   status:item.status,failedAttempts:item.failedAttempts,
   expiresAt:item.expiresAt,syntheticAliasOnly:true,
   trueBeneficiaryIdentityVerified:false,providerAuthenticated:false,
   redeemableAtAnyAgent:false,livePayoutAuthorized:false,
   moneyDelivered:false,realMoneyEnabled:false,
   canRedeem:false,canPay:false});
 }
 return Object.freeze({
  mode:'mock',providerConnected:false,realIdentityVerificationConnected:false,
  realMoneyEnabled:false,canRedeem:false,
  createSample({caseId,beneficiaryAlias,country,amountCents}={}){
   if(typeof caseId!=='string'||!CASE.test(caseId)||
      typeof beneficiaryAlias!=='string'||!ALIAS.test(beneficiaryAlias)||
      !['HN','NI'].includes(country)||
      caseId.slice(4,6)!==country||beneficiaryAlias.slice(7,9)!==country||
      !Number.isSafeInteger(amountCents)||amountCents<100||amountCents>10000000)
      fail('Caso de retirada ficticia inválido; no usar datos reales');
   if(cases.has(caseId))fail('No se permite volver a emitir un código para el mismo caso');
   const issuedAt=now();
   const sampleCode='SIMONLY-'+randomBytes(16).toString('hex').toUpperCase();
   const item={caseId,country,beneficiaryAlias,amountCents,
     digest:hashCode(secret,caseId,sampleCode),failedAttempts:0,
     status:'issued_mock',expiresAt:issuedAt+LIFE_MS};
   cases.set(caseId,item);
   audit.push(readonly({kind:'sample_issued_mock',caseId}));
   // El código de ejemplo solo se entrega una vez al harness; jamás se devuelve
   // por inspect(), verify() o audit(). No es una referencia para bancos.
   return readonly({...publicCase(item),sampleCode,
    nonRedeemableWarning:'SOLO PRUEBA. Código sin valor, no presentarlo en ningún banco o agencia.'});
  },
  verifySyntheticCode({caseId,sampleCode,beneficiaryAlias}={}){
   if(typeof caseId!=='string'||!CASE.test(caseId)||!cases.has(caseId))
      fail('Caso de prueba inexistente');
   const item=cases.get(caseId),t=now();
   if(item.status!=='issued_mock')
      return readonly({...publicCase(item),acceptedMock:false,reason:'already_closed'});
   if(t>=item.expiresAt){
    item.status='expired_mock';audit.push(readonly({kind:'sample_expired_mock',caseId}));
    return readonly({...publicCase(item),acceptedMock:false,reason:'expired'});
   }
   // No permitir bypass de rate limits por entradas malformadas.
   const inputValid=typeof sampleCode==='string'&&SAMPLE_CODE.test(sampleCode)&&
      typeof beneficiaryAlias==='string'&&ALIAS.test(beneficiaryAlias);
   const digest=inputValid?hashCode(secret,caseId,sampleCode):Buffer.alloc(32);
   const sameCode=equal(item.digest,digest);
   const sameSyntheticAlias=inputValid&&beneficiaryAlias===item.beneficiaryAlias;
   if(!sameCode||!sameSyntheticAlias){
    item.failedAttempts++;
    if(item.failedAttempts>=MAX_FAILED)item.status='locked_mock';
    audit.push(readonly({kind:'attempt_rejected_mock',caseId}));
    return readonly({...publicCase(item),acceptedMock:false,reason:'invalid_or_locked'});
   }
   item.status='consumed_mock';
   audit.push(readonly({kind:'one_time_sample_checked_mock',caseId}));
   return readonly({...publicCase(item),acceptedMock:true,
     syntheticAliasMatched:true,realIdentityConfirmed:false,
     payoutOccurred:false,bankFundsVerified:false});
  },
  inspectSample(caseId){
   if(typeof caseId!=='string'||!CASE.test(caseId)||!cases.has(caseId))
    fail('Caso de prueba inexistente');
   return publicCase(cases.get(caseId));
  },
  sanitizedAudit(){
   return Object.freeze(audit.map(x=>readonly(x)));
  },
 });
}
