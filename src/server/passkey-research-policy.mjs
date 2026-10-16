// MONEDA MUNDIAL 2.0 — PREFLIGHT WebAuthn/Passkeys, solo investigación.
// Verifica CONFIGURACIÓN estática para el futuro portal institucional.
// NO procesa respuestas WebAuthn (authenticatorData/COSE/clientDataJSON),
// NO emite sesiones ni MFA ni verifica identidades o firma alguna.
// Prohibido usar la respuesta para dar permisos, abonar saldos o mover dinero.
const freeze=Object.freeze;
const RP_RE=/^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const RESEARCH=requireNotAvailable();
function requireNotAvailable(){
 // Recordatorio intencional: no se carga librería de producción WebAuthn aquí.
 return freeze({realWebAuthnLibraryInstalled:false,realIdentityProviderSelected:false});
}
const requiredChecks=freeze([
 'trusted_origin_exact_match',
 'rp_id_hash_validated_by_library',
 'challenge_bound_and_one_time',
 'user_presence_validated',
 'user_verification_validated',
 'credential_id_bound_to_member',
 'credential_public_key_signature_verified',
 'credential_counter_and_backup_flags_reviewed',
 'membership_active_on_every_request',
 'session_revocation_and_rotation',
 'rate_limits_and_audit',
 'verified_institution_and_legal_provider',
]);

export const PASSKEY_SECURITY_REQUIREMENTS=requiredChecks;
export function assessPasskeyConfigurationResearch({
 rpId,allowedOrigins,userVerification='required',
 challengeTtlSeconds=90,sessionTtlSeconds=900,
}={}){
 const issues=[];
 if(typeof rpId!=='string'||!RP_RE.test(rpId)||rpId.includes('..')||
    rpId.endsWith('.localhost')||rpId.endsWith('.test'))
    issues.push('invalid_relying_party_id');
 if(!Array.isArray(allowedOrigins)||allowedOrigins.length===0||
    allowedOrigins.length>4||new Set(allowedOrigins).size!==allowedOrigins.length)
    issues.push('invalid_origin_allowlist');
 else {
   for(const origin of allowedOrigins){
     let acceptable=false;
     try{
       const u=new URL(origin);
       acceptable=typeof origin==='string'&&u.protocol==='https:'&&
         u.origin===origin&&u.username===''&&u.password===''&&u.port===''&&
         (u.hostname===rpId||u.hostname.endsWith('.'+rpId));
     }catch{}
     if(!acceptable)issues.push('untrusted_or_inexact_origin');
   }
 }
 if(userVerification!=='required')issues.push('user_verification_not_required');
 if(!Number.isInteger(challengeTtlSeconds)||challengeTtlSeconds<30||challengeTtlSeconds>180)
   issues.push('challenge_expiry_outside_research_policy');
 if(!Number.isInteger(sessionTtlSeconds)||sessionTtlSeconds<60||sessionTtlSeconds>900)
   issues.push('session_expiry_outside_research_policy');
 return freeze({
  configValidForResearch:issues.length===0,
  issues:freeze([...new Set(issues)]),
  rpId:typeof rpId==='string'?rpId:null,
  userVerification:'required',
  requiredChecks,
  realVerificationLibraryInstalled:RESEARCH.realWebAuthnLibraryInstalled,
  identityProviderSelected:RESEARCH.realIdentityProviderSelected,
  employeeAuthenticationActive:false,
  bankAuthenticated:false,
  actualPasskeyAssertionVerified:false,
  liveInstitutionalSessionEnabled:false,
  canMoveRealMoney:false,canAuthorizePayout:false,canIssueCoin:false,
  status:'CONFIGURATION_RESEARCH_ONLY',
 });
}
// Control de ACCIONES PRIVILEGIADAS: en laboratorio no autorizamos ninguna.
// No aceptar claims booleanos como "mfaVerified:true" enviados por cliente.
export function assessPrivilegedActionResearch({action}={}){
 const privileged=freeze(['institution_onboarding','staff_membership_change',
  'refund_approval','bank_payout','cash_pickup_release','crypto_exchange']);
 return freeze({
  action:privileged.includes(action)?action:null,
  recognized:privileged.includes(action),
  requiresPhishingResistantAuthentication:true,
  requiresVerifiedBankRole:true,
  requiresServerSidePermissionCheck:true,
  requiresImmutableAudit:true,
  requiresOutOfBandOrDualControlPolicy:true,
  verifiedPasskeySession:false,
  providerAvailable:false,realActionEnabled:false,
  decision:'DENY_RESEARCH_ONLY',
 });
}
