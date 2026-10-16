// Comprobación de diagnóstico SIN escrituras para el panel propietario de Moneda Mundial.
// NUNCA se usan RPC de transferencia, pagos, saldos ni modificación de socios.
export const OWNER_READ_ONLY_CHECKS = Object.freeze([
  Object.freeze({
    id:'partners',
    name:'Registro de candidatos',
    rpc:'mwd_owner_partners_demo',
    args:undefined,
    optional:false,
  }),
  Object.freeze({
    id:'countries',
    name:'Catálogo mundial',
    rpc:'mwd_world_countries_demo',
    args:undefined,
    optional:false,
  }),
  Object.freeze({
    id:'expiry',
    name:'Vencimientos y contratos',
    rpc:'mwd_owner_partner_expiry_dashboard_demo',
    args:Object.freeze({p_days:60}),
    optional:false,
  }),
  Object.freeze({
    id:'agenda',
    name:'Agenda interna (pendiente de habilitación)',
    rpc:'mwd_owner_partner_activities_demo',
    args:Object.freeze({p_partner_id:null}),
    optional:true,
  }),
]);

export function summarizeAdminDiagnostic(check, response) {
  if (!check || !OWNER_READ_ONLY_CHECKS.some(x=>x.id===check.id && x.rpc===check.rpc)) {
    return Object.freeze({status:'error',count:null});
  }
  if (!response || response.error) {
    return Object.freeze({
      status:check.optional?'pendiente':'error',
      count:null,
    });
  }
  if (!Array.isArray(response.data)) {
    return Object.freeze({status:'error',count:null});
  }
  return Object.freeze({status:'disponible',count:response.data.length});
}

export async function runAdminReadOnlyChecks(rpc) {
  if (typeof rpc !== 'function') throw new Error('Servicio administrativo no disponible');
  const results=await Promise.all(OWNER_READ_ONLY_CHECKS.map(async check=>{
    try {
      const response=await rpc(check.rpc, check.args);
      return Object.freeze({
        id:check.id,name:check.name,...summarizeAdminDiagnostic(check,response),
      });
    } catch {
      return Object.freeze({
        id:check.id,name:check.name,status:check.optional?'pendiente':'error',
        count:null,
      });
    }
  }));
  return Object.freeze(results);
}
