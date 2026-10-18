// Orquestación educativa de retiro por un agente de laboratorio. Sin banco/HTTP/PII.
// Los códigos SAMPLE/ SIMONLY jamás pueden canjearse ni acreditar fondos.
export function createMockAgentPickupSession({sessionGateway,pickupVerifier}={}){
 if(sessionGateway?.mode!=='mock'||pickupVerifier?.mode!=='mock'||
    typeof sessionGateway.authorizeMockSession!=='function'||
    typeof pickupVerifier.verifySyntheticCode!=='function')
   throw Error('Requiere sesión y verificador sólo de laboratorio');
 return Object.freeze({
  mode:'mock',moneyMovementEnabled:false,realBeneficiaryVerification:false,
  verifySample({sessionToken,caseId,sampleCode,beneficiaryAlias}={}){
   const auth=sessionGateway.authorizeMockSession({
    sessionToken,action:'verify_mock_cash_pickup',
   });
   if(!auth.allowed||auth.institutionKind!=='agent')
    return Object.freeze({acceptedMock:false,reason:'agent_not_authorized',
      canPay:false,realMoneyEnabled:false});
   if(typeof caseId!=='string'||caseId.slice(0,7)!=='SIM-'+auth.country+'-')
    return Object.freeze({acceptedMock:false,reason:'cross_country_denied',
      canPay:false,realMoneyEnabled:false});
   const result=pickupVerifier.verifySyntheticCode({caseId,sampleCode,beneficiaryAlias});
   return Object.freeze({...result,agentInstitutionId:auth.institutionId,
     staffId:auth.memberId,identityCheckedByProvider:false,canPay:false,
     realMoneyEnabled:false});
  },
 });
}
