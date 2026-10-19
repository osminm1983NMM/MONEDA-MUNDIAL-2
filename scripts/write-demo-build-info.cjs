// GitHub Actions: integrar procedencia técnica NO secreta ANTES del prebuild.
// El checkout de pull_request usa un commit de combinación: GITHUB_SHA
// identifica ese árbol comprobado, y runId enlaza al flujo exacto.
'use strict';
const fs=require('node:fs');
const sha=process.env.GITHUB_SHA||'';
const run=process.env.GITHUB_RUN_ID||'';
const attempt=process.env.GITHUB_RUN_ATTEMPT||'';
if(process.env.CI!=='1' ||
   process.env.REAL_PAYMENTS_ENABLED!=='false' ||
   process.env.EXPO_PUBLIC_REAL_PAYMENTS_ENABLED!=='false' ||
   !/^[0-9a-f]{40}$/.test(sha)||!/^[1-9][0-9]{0,19}$/.test(run)||
   !/^[1-9][0-9]{0,5}$/.test(attempt))
 throw new Error('No se puede identificar una compilación DEMO segura');
const app=JSON.parse(fs.readFileSync('app.json','utf8'));
if(!/^\d+\.\d+\.\d+$/.test(app?.expo?.version||''))throw Error('Versión Expo inválida');
const info={schemaVersion:1,appVersion:app.expo.version,mode:'demo_only',
 realPaymentsEnabled:false,gitSha:sha,runId:run,runAttempt:Number(attempt)};
fs.writeFileSync('src/digital-money/demo-build-info.json',JSON.stringify(info,null,2)+'\n');
console.log('Metadatos DEMO integrados: run '+run+', commit '+sha.slice(0,12));
