// Moneda Mundial 2.0 — seguridad de código de retiro EXCLUSIVAMENTE FICTICIO.
// Este laboratorio en memoria no comprueba documentos, no se conecta a agentes,
// no crea instrumentos financieros, NO verifica identidad real ni entrega dinero.
import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';

// Catálogo configurable SOLO PARA PRUEBAS. No concede cobertura ni red de retiro.
const DEFAULT_COUNTRIES=Object.freeze(['HN','NI']);
const COUNTRY=/^[A-Z]{2}$/;
const CASE=/^SIM-([A-Z]{2})-[A-Z0-9]{8,30}$/;
const ALIAS=/^SAMPLE-([A-Z]{2})-[A-Z0-9]{6,25}$/;
const plainRecord=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 (Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);
const exact=(x,keys)=>plainRecord(x)&&Object.keys(x).sort().join('|')===keys.slice().sort().join('|');
const SAMPLE_CODE=/^SIMONLY-[0-9A-F]{32}$/; // 128 bits aleatorios, NO cobrables.
const LIFE_MS=15*60*1000,MAX_FAILED=5;
const fail=message=>{throw new Error(message)};
const readonly=o=>Object.freeze({...o});
function hashCode(secret,caseId,code){
 return createHmac('sha256',secret).update('MWD_CASH_PICKUP_MOCK_V1\n'+caseId+'\n'+code).digest();
}
const equal=(a,b)=>a.length===b.length&&timingSafeEqual(a,b);

export function createMockCashPickupVerifier(options={}){
 if(!plainRecord(options)||Object.keys(options).some(k=>!['mode','secret','clock','countryCodes'].includes(k)))
  fail('Configuración de retiro ficticio inválida');
 const {mode='mock',secret,clock=()=>Date.now(),countryCodes=DEFAULT_COUNTRIES}=options;
 if(mode!=='mock')fail('RETIRO DE DINERO REAL BLOQUEADO');
 if(typeof secret!=='string'||secret.length<32||secret.length>200)
  fail('Se requiere clave fuerte de laboratorio almacenada en el servidor');
 if(typeof clock!=='function')fail('Reloj no disponible');
 if(!Array.isArray(countryCodes)||countryCodes.length===0||countryCodes.length>249||
    countryCodes.some(c=>typeof c!=='string'||!COUNTRY.test(c)||c==='US')||
    new Set(countryCodes).size!==countryCodes.length)
  fail('Catálogo de destinos DEMO inválido');
 const designCountries=new Set(countryCodes);
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
  createSample(input={}){
   // La app jamás debe enviar identidad ni datos de tarjeta para emitir un SAMPLE.
   if(!exact(input,['caseId','beneficiaryAlias','country','amountCents']))
    fail('Caso de retirada ficticia inválido; campos bancarios/personales prohibidos');
   const {caseId,beneficiaryAlias,country,amountCents}=input;
   if(typeof caseId!=='string'||!CASE.test(caseId)||
      typeof beneficiaryAlias!=='string'||!ALIAS.test(beneficiaryAlias)||
      !designCountries.has(country)||
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
  verifySyntheticCode(input={}){
   if(!exact(input,['caseId','sampleCode','beneficiaryAlias']))
    fail('Verificación de código ficticio inválida; campos inesperados');
   const {caseId,sampleCode,beneficiaryAlias}=input;
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
   const item=cases.get(caseId);
   // La consulta de seguimiento también refleja la caducidad del SAMPLE.
   // Nunca permite canjearlo ni regenerarlo, y audita la expiración una sola vez.
   if(item.status==='issued_mock' && now()>=item.expiresAt){
    item.status='expired_mock';
    audit.push(readonly({kind:'sample_expired_mock',caseId}));
   }
   return publicCase(item);
  },
  sanitizedAudit(){
   return Object.freeze(audit.map(x=>readonly(x)));
  },
 });
}
