// Rechaza APK de laboratorio cuyo paquete/versionCode difiera de app.json.
// No instala archivos, no toca datos del teléfono ni autoriza distribución.
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {leerIdentidadAndroid} from './comprobar-actualizacion-android.mjs';

export function validarVersionAndroidDemo(config, informeAapt){
  const expo=config?.expo;
  if(!expo || expo.android?.package!=='com.monedamundial.app' ||
     !Number.isSafeInteger(expo.android?.versionCode) || expo.android.versionCode<1)
    throw new Error('Falta paquete Android o versionCode explícito y válido en app.json');
  const apk=leerIdentidadAndroid(informeAapt);
  if(apk.paquete!==expo.android.package || apk.versionCode!==expo.android.versionCode)
    throw new Error(`APK inconsistente: se esperaba ${expo.android.package} versión ${expo.android.versionCode}, se encontró ${apk.paquete} versión ${apk.versionCode}`);
  return Object.freeze({
    coincide:true,paquete:apk.paquete,versionCode:apk.versionCode,
    soloDemostracion:true,autorizaDistribucion:false,
  });
}

function main(){
  const [archivoApk,configArg='app.json']=process.argv.slice(2);
  if(!archivoApk || process.argv.length>4)
    throw new Error('Uso: node scripts/comprobar-version-android-demo.mjs ARCHIVO.apk [app.json]');
  const configuracion=JSON.parse(readFileSync(resolve(configArg),'utf8'));
  const informe=execFileSync(process.env.AAPT_PATH||'aapt',
    ['dump','badging',resolve(archivoApk)],{encoding:'utf8',maxBuffer:2*1024*1024});
  console.log(JSON.stringify(validarVersionAndroidDemo(configuracion,informe),null,2));
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{main();}catch(error){console.error(`::error::${error.message}`);process.exitCode=1;}
}
