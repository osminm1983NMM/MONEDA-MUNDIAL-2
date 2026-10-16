// Vista administrativa de sólo lectura, con historia COMPLETAMENTE INVENTADA.
// No consulta PostgreSQL CI, Supabase, bancos ni personas reales.
const DEMO=Object.freeze([
 Object.freeze({seq:1,id:'AUD-HN-001',caseId:'SIM-HN-001',country:'HN',
  event:'Revisión ficticia iniciada',reviewer:'Empleado DEMO A',stage:'Pendiente'}),
 Object.freeze({seq:2,id:'AUD-HN-002',caseId:'SIM-HN-001',country:'HN',
  event:'Intento ficticio de autoaprobación rechazado',reviewer:'Empleado DEMO A',stage:'Rechazado'}),
 Object.freeze({seq:3,id:'AUD-HN-003',caseId:'SIM-HN-001',country:'HN',
  event:'Segunda revisión ficticia registrada',reviewer:'Empleado DEMO B',stage:'Revisión registrada'}),
 Object.freeze({seq:4,id:'AUD-NI-001',caseId:'SIM-NI-001',country:'NI',
  event:'Revisión ficticia iniciada',reviewer:'Empleado DEMO C',stage:'Pendiente'}),
]);
export function listMockAuditPreview({country='ALL'}={}){
 if(!['ALL','HN','NI'].includes(country))throw Error('Filtro DEMO inválido');
 const rows=DEMO.filter(x=>country==='ALL'||x.country===country);
 return Object.freeze({source:'hardcoded_example_only',
  databaseConnected:false,realAuditVerified:false,canEdit:false,canExecute:false,
  integrityStatus:'NO_VERIFICADO_EN_APP',
  total:rows.length,events:Object.freeze(rows.map(x=>Object.freeze({...x})))});
}
