// Manifiesto verificable del archivo DEMO exacto salido de GitHub Actions.
// No genera ni usa llaves privadas; nunca habilita pagos o distribución.
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createReadStream,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {evaluarFirmaAndroid} from './comprobar-firma-android.mjs';
import {validarVersionAndroidDemo} from './comprobar-version-android-demo.mjs';

const SHA256=/^[0-9a-f]{64}$/i;
const SHA_GIT=/^[0-9a-f]{40}$/i;

export function construirRegistroApkDemo({config,badging,firmaVerificada,sha256Apk,commit,runId}){
  const identidad=validarVersionAndroidDemo(config,badging);
  const firma=evaluarFirmaAndroid(firmaVerificada,{modo:'demo'});
  if(!firma.esDebug)
    throw new Error('Este manifiesto solo admite APK con firma Android Debug de laboratorio');
  if(typeof sha256Apk!=='string' || !SHA256.test(sha256Apk))
    throw new Error('Falta SHA-256 válido del archivo APK completo');
  if(typeof commit!=='string'||!SHA_GIT.test(commit))
    throw new Error('Falta commit GitHub verificable de 40 caracteres hexadecimales');
  if(typeof runId!=='string'||!/^[1-9]\d*$/.test(runId) || !Number.isSafeInteger(Number(runId)))
    throw new Error('Falta identificador de ejecución de GitHub Actions válido');
  return Object.freeze({
    tipo:'MONEDA_MUNDIAL_APK_DEMO_NO_PUBLICAR',
    paquete:identidad.paquete,
    versionCode:identidad.versionCode,
    sha256Apk:sha256Apk.toLowerCase(),
    certificadoSha256:firma.huellaSha256,
    certificadoDebug:true,
    commit:commit.toLowerCase(),
    runId,
    verificacionFirma:true,
    autorizaDistribucion:false,
    autorizaDineroReal:false,
  });
}

async function resumenSha256(archivo){
  const digest=createHash('sha256');
  for await (const bloque of createReadStream(archivo))digest.update(bloque);
  return digest.digest('hex');
}

async function main(){
  const [archivo,archivoConfig='app.json']=process.argv.slice(2);
  if(!archivo||process.argv.length>4)
    throw new Error('Uso: node scripts/registrar-identidad-apk-demo.mjs ARCHIVO.apk [app.json]');
  const apk=resolve(archivo);
  const config=JSON.parse(readFileSync(resolve(archivoConfig),'utf8'));
  const firmaVerificada=execFileSync(process.env.APKSIGNER_PATH||'apksigner',
    ['verify','--verbose','--print-certs',apk],{encoding:'utf8',maxBuffer:2*1024*1024});
  const badging=execFileSync(process.env.AAPT_PATH||'aapt',
    ['dump','badging',apk],{encoding:'utf8',maxBuffer:2*1024*1024});
  const registro=construirRegistroApkDemo({
    config,badging,firmaVerificada,sha256Apk:await resumenSha256(apk),
    commit:process.env.GITHUB_SHA,runId:process.env.GITHUB_RUN_ID,
  });
  console.log(JSON.stringify(registro,null,2));
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  main().catch(error=>{console.error(`::error::${error.message}`);process.exitCode=1;});
}
