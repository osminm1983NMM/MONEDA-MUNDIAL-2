// Moneda Mundial — SESIONES INSTITUCIONALES DE LABORATORIO.
// Solo Node servidor, no React Native. No es WebAuthn, MFA real ni identidad
// verificada. Todas las instituciones/miembros son IDENTIDADES FICTICIAS.
// No conectar a Supabase, bancos, dinero real, Coin ni Digital.
import {randomBytes,randomUUID,createHash,createPublicKey,verify} from 'node:crypto';

const MEMBERSHIP_STATES=new Set(['active_mock','pending_mock','revoked_mock']);
const INSTITUTIONS=Object.freeze({
 'bank-hn':{kind:'bank',country:'HN'},'bank-ni':{kind:'bank',country:'NI'},
 'agent-hn':{kind:'agent',country:'HN'},'agent-ni':{kind:'agent',country:'NI'},
});
const MEMBER_ID=/^[a-zA-Z0-9_-]{8,72}$/;
const TIMEOUT_CHALLENGE=90000, TIMEOUT_SESSION=900000;
const fail=message=>{throw new Error(message);};
const digest=value=>createHash('sha256').update(value).digest('hex');
const time=(clock)=>{const n=clock();if(!Number.isSafeInteger(n)||n<0)fail('Reloj DEMO inválido');return n;};
const copy=o=>Object.freeze({...o});
const noLive=Object.freeze({
 verifiedBankIdentity:false,realMfaEnabled:false,realMoneyEnabled:false,
 canPay:false,canIssueRefund:false,canOperateCrypto:false,
});

export function createMockInstitutionSessionGateway({
 mode='mock',clock=()=>Date.now(),members=[],
}={}){
 if(mode!=='mock')fail('Acceso institucional real BLOQUEADO');
 if(typeof clock!=='function'||!Array.isArray(members)||members.length===0||members.length>20)
  fail('Se requieren identidades de laboratorio');
 const registry=new Map(),challenges=new Map(),sessions=new Map(),audit=[];
 for(const m of members){
  if(!m||typeof m!=='object'||Array.isArray(m)||!MEMBER_ID.test(m.memberId||'')||
    !Object.hasOwn(INSTITUTIONS,m.institutionId)||
    !MEMBERSHIP_STATES.has(m.state)||typeof m.publicKeyPem!=='string'||
    registry.has(m.memberId))fail('Miembro DEMO inválido');
  let key;
  try{key=createPublicKey(m.publicKeyPem);}catch{fail('Clave pública inválida');}
  if(key.asymmetricKeyType!=='ed25519')fail('Sólo claves de firma Ed25519 de investigación');
  registry.set(m.memberId,{
   institutionId:m.institutionId,state:m.state,publicKey:key,
   revision:0,
  });
 }
 const status=memberId=>{
  const m=registry.get(memberId);
  if(!m)fail('Miembro de laboratorio desconocido');
  return m;
 };
 function inactiveSessions(memberId){
  for(const [hash,s] of sessions)if(s.memberId===memberId)sessions.delete(hash);
  for(const [id,c] of challenges)if(c.memberId===memberId)challenges.delete(id);
 }
 return Object.freeze({
  mode:'mock',productionConnected:false,realAuthentication:false,
  beginMockChallenge({memberId}={}){
   const member=status(memberId),now=time(clock);
   if(member.state!=='active_mock')fail('Membresía no activa');
   const challengeId=randomUUID();
   const nonce=randomBytes(32).toString('base64url');
   const expiresAt=now+TIMEOUT_CHALLENGE;
   const signedMessage='MWD_INSTITUTION_MOCK_V1\n'+challengeId+'\n'+memberId+
      '\n'+member.institutionId+'\n'+nonce+'\n'+expiresAt;
   challenges.set(challengeId,{
    memberId,revision:member.revision,expiresAt,signedMessage,attempts:0,
   });
   return copy({challengeId,signedMessage,expiresAt,
    expiresInSeconds:90,identityVerified:false,realMfaEnabled:false,
    realMoneyEnabled:false});
  },
  completeMockChallenge({challengeId,memberId,signatureBase64url}={}){
   const member=status(memberId),c=challenges.get(challengeId);
   const now=time(clock);
   if(!c||c.memberId!==memberId)fail('Desafío no encontrado');
   if(member.state!=='active_mock'||member.revision!==c.revision||
      now>=c.expiresAt){challenges.delete(challengeId);fail('Desafío vencido o revocado');}
   if(c.attempts>=3){challenges.delete(challengeId);fail('Máximo de intentos de laboratorio');}
   c.attempts++;
   if(typeof signatureBase64url!=='string'||
      !/^[A-Za-z0-9_-]{80,100}$/.test(signatureBase64url)){
     if(c.attempts>=3)challenges.delete(challengeId);
     fail('Firma DEMO inválida');
   }
   const buffer=Buffer.from(signatureBase64url,'base64url');
   if(buffer.length!==64||!verify(null,Buffer.from(c.signedMessage),member.publicKey,buffer)){
    if(c.attempts>=3)challenges.delete(challengeId);
    fail('Firma DEMO no verificada');
   }
   challenges.delete(challengeId); // No reutilizar desafío.
   const sessionToken=randomBytes(32).toString('base64url');
   const expiresAt=now+TIMEOUT_SESSION;
   sessions.set(digest(sessionToken),{
    memberId,institutionId:member.institutionId,
    membershipRevision:member.revision,expiresAt,
   });
   audit.push(copy({event:'laboratory_session_created',memberId,
      institutionId:member.institutionId}));
   return copy({sessionToken,expiresAt,expiresInSeconds:900,...noLive});
  },
  authorizeMockSession({sessionToken,action}={}){
   // Backend de laboratorio: institución y alcance se derivan del token,
   // nunca del role/country/entityId que envíe un cliente.
   if(typeof sessionToken!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(sessionToken))
     return copy({allowed:false,reason:'invalid_token',...noLive});
   const tokenHash=digest(sessionToken);
   const session=sessions.get(tokenHash),now=time(clock);
   if(!session)return copy({allowed:false,reason:'unknown_or_revoked',...noLive});
   const member=status(session.memberId);
   if(now>=session.expiresAt||member.revision!==session.membershipRevision||
      member.state!=='active_mock'){
     sessions.delete(tokenHash);
     return copy({allowed:false,reason:'expired_or_revoked',...noLive});
   }
   if(!['read_mock_cases','request_mock_review'].includes(action))
     return copy({allowed:false,reason:'action_not_authorized',...noLive});
   const inst=INSTITUTIONS[session.institutionId];
   return copy({allowed:true,reason:'scoped_mock_access',
    memberId:session.memberId,institutionId:session.institutionId,
    institutionKind:inst.kind,country:inst.country,
    availableAction:action,...noLive,
   });
  },
  inspectMockSession({sessionToken,institutionId,action}={}){
   const auth=this.authorizeMockSession({sessionToken,action});
   if(!auth.allowed)return auth;
   if(auth.institutionId!==institutionId)return copy({
    allowed:false,reason:'cross_institution_denied',...noLive});
   return auth;
  },
  logoutMockSession({sessionToken}={}){
   if(typeof sessionToken!=='string')return copy({revoked:false,...noLive});
   const hash=digest(sessionToken),revoked=sessions.delete(hash);
   return copy({revoked,...noLive});
  },
  // Método de FIxture controlado desde tests locales, no endpoint de cliente.
  simulateAdminMembershipRevocation(memberId){
   const member=status(memberId);
   member.state='revoked_mock';member.revision++;
   inactiveSessions(memberId);
   audit.push(copy({event:'mock_membership_revoked',memberId,
     institutionId:member.institutionId}));
   return copy({revoked:true,disabledSessions:true,...noLive});
  },
  safeAudit(){return Object.freeze(audit.map(e=>copy(e)));},
 });
}
