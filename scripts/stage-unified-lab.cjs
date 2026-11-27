'use strict';
const fs=require('node:fs'),path=require('node:path');
const scheme='com.monedamundial.unifiedlab';
function stage(root){
 const read=p=>fs.readFileSync(path.join(root,p),'utf8');
 const target=p=>path.join(root,p);
 const demo=read('App.js'),config=JSON.parse(read('app.json'));
 const hosted=read('financial-sandbox/mobile/hosted-lab-entry.jsx');
 const entry=read('financial-sandbox/mobile/unified-lab-entry.jsx');
 if(config.expo?.android?.package!=='com.monedamundial.app'||config.expo.scheme!=='com.monedamundial.app')throw Error('UNEXPECTED_BASE_CONFIG');
 if(!demo.includes("const PASSWORD_RESET_REDIRECT = 'com.monedamundial.app://auth/reset-password';")||!demo.includes('  async function requestPasswordReset() {')||!demo.includes("parsed.protocol !== 'com.monedamundial.app:'"))throw Error('UNEXPECTED_DEMO_AUTH');
 if(!hosted.includes('SOLO PRUEBAS')||!entry.includes('SIN DINERO REAL'))throw Error('MISSING_LAB_WARNING');
 if(['DemoApp.jsx','HostedFinancialLab.jsx'].some(p=>fs.existsSync(target(p))))throw Error('ALREADY_STAGED');
 // Never send a recovery email that targets the installed standalone DEMO.
 // This package's redirect has not been authorized in the test Auth service.
 const start=demo.indexOf('  async function requestPasswordReset() {'),end=demo.indexOf('  async function saveNewPassword() {',start);
 if(end<=start||demo.indexOf('  async function requestPasswordReset() {',start+1)!==-1)throw Error('UNEXPECTED_RECOVERY_BOUNDARY');
 const isolatedDemo=(demo.slice(0,start)+'  async function requestPasswordReset() {\n    return message("Recuperar contraseña", "Utiliza la DEMO independiente para recuperación. Este LAB no tiene redirección autorizada.");\n  }\n\n'+demo.slice(end)).replaceAll('com.monedamundial.app',scheme);
 if(isolatedDemo.includes('resetPasswordForEmail('))throw Error('RECOVERY_SEND_NOT_DISABLED');
 const expo={name:'Moneda Mundial LAB Unificado',slug:'moneda-mundial-unified-lab',scheme,version:config.expo.version,orientation:'portrait',userInterfaceStyle:'automatic',android:{package:scheme},plugins:config.expo.plugins};
 fs.writeFileSync(target('DemoApp.jsx'),isolatedDemo,{flag:'wx'});
 fs.writeFileSync(target('HostedFinancialLab.jsx'),hosted,{flag:'wx'});
 fs.writeFileSync(target('App.js'),entry);
 fs.writeFileSync(target('app.json'),JSON.stringify({expo},null,2)+'\n');
}
module.exports={stage,scheme};
if(require.main===module){
 if(process.env.CI!=='true'||process.argv.length!==3||process.argv[2]!=='--disposable-checkout')throw Error('DISPOSABLE_CI_CHECKOUT_REQUIRED');
 const {execFileSync}=require('node:child_process');
 if(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim())throw Error('CLEAN_CHECKOUT_REQUIRED');
 stage(process.cwd());
}
