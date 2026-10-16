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

const ACCESS_DENIED_CODES = new Set(['42501', 'PGRST301']);
const RPC_MISSING_CODES = new Set(['PGRST202', '42883']);

// Nunca devolver detalles internos del backend, SQL o credenciales a la interfaz.
// Un fallo de red NO equivale a una RPC pendiente de instalación.
export function classifyAdminDiagnosticError(check, error) {
  const code = typeof error?.code === 'string' ? error.code : '';
  const httpStatus = Number(error?.status ?? error?.statusCode);
  if (ACCESS_DENIED_CODES.has(code) || httpStatus === 401 || httpStatus === 403) {
    return 'sin_permiso';
  }
  if (check?.optional && RPC_MISSING_CODES.has(code)) return 'pendiente';
  return 'error';
}

export function summarizeAdminDiagnostic(check, response) {
  if (!check || !OWNER_READ_ONLY_CHECKS.some(x=>x.id===check.id && x.rpc===check.rpc)) {
    return Object.freeze({status:'error',count:null});
  }
  if (!response || response.error) {
    return Object.freeze({
      status:classifyAdminDiagnosticError(check, response?.error),
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
    } catch (error) {
      return Object.freeze({
        id:check.id,name:check.name,status:classifyAdminDiagnosticError(check,error),
        count:null,
      });
    }
  }));
  return Object.freeze(results);
}
