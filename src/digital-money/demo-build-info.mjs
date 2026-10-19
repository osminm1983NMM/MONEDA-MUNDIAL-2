// Únicamente procedencia técnica pública. No examina sesión, saldo ni datos del usuario.
const GIT_SHA=/^[0-9a-f]{40}$/;
const RUN_ID=/^[1-9][0-9]{0,19}$/;
const APP_VERSION=/^[0-9]+\.[0-9]+\.[0-9]+$/;
export function safeDemoBuildInfo(raw){
 if(!raw||typeof raw!=='object'||raw.schemaVersion!==1 ||
    raw.mode!=='demo_only'||raw.realPaymentsEnabled!==false ||
    typeof raw.appVersion!=='string'||!APP_VERSION.test(raw.appVersion))
  return null;
 const commit=typeof raw.gitSha==='string'&&GIT_SHA.test(raw.gitSha)?raw.gitSha:null;
 const runId=typeof raw.runId==='string'&&RUN_ID.test(raw.runId)?raw.runId:null;
 const runAttempt=Number.isSafeInteger(raw.runAttempt)&&raw.runAttempt>=1?raw.runAttempt:null;
 return Object.freeze({
  version:raw.appVersion,commit,runId,runAttempt,
  githubProvenanceAvailable:!!(commit&&runId),
  buildMode:'SOLO DEMOSTRACIÓN',
  realPaymentsEnabled:false,
  physicallyVerified:false, // Nunca reclamar prueba en teléfono real.
 });
}

// URL de solo lectura, restringida a ESTE repositorio y a ID decimal verificado.
// No consume datos del usuario; no hay claves ni API de pagos.
export function demoGithubRunUrl(buildInfo){
 if(!buildInfo||buildInfo.githubProvenanceAvailable!==true||
    typeof buildInfo.runId!=='string'||!RUN_ID.test(buildInfo.runId))return null;
 return 'https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/'+buildInfo.runId;
}
