// Combina una sesión firmada ficticia con el alcance de alertas inventadas.
// Nunca acepta rol ni ID institucional aportado por cliente como autoridad.
// Sin HTTP, JWT real, credenciales, banco, Supabase ni movimientos de fondos.
import {projectMockAlerts} from '../admin/mock-financial-alert-dashboard.mjs';
export function createMockInstitutionAuthorizedAlerts({sessionGateway}={}){
 if(!sessionGateway||sessionGateway.mode!=='mock'||
   typeof sessionGateway.authorizeMockSession!=='function')
   throw Error('Se requiere servidor de sesión sólo DEMO');
 return Object.freeze({
  fetchOwnMockAlerts({sessionToken}={}){
   const auth=sessionGateway.authorizeMockSession({
     sessionToken,action:'read_mock_cases',
   });
   if(!auth.allowed)return Object.freeze({
    allowed:false,reason:auth.reason,alerts:Object.freeze([]),
    canPay:false,realMoneyEnabled:false,
   });
   const view=projectMockAlerts({role:auth.institutionKind,entityId:auth.institutionId});
   if(!view.allowed)throw Error('Alcance del servidor incompatible con datos de prueba');
   return Object.freeze({
    ...view,memberId:auth.memberId,institutionId:auth.institutionId,
    verifiedRealBank:false,canPay:false,realMoneyEnabled:false,
   });
  },
  canPay:false,realMoneyEnabled:false,connectedToRealProvider:false,
 });
}
