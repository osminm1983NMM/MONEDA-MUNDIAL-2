// Compara dos APK de demostración antes de recomendar instalar una sobre otra.
// Nunca firma aplicaciones, manipula llaves ni desinstala datos del teléfono.
import {execFileSync} from 'node:child_process';
import {existsSync, readdirSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {evaluarFirmaAndroid} from './comprobar-firma-android.mjs';

const SHA256=/^[a-f0-9]{64}$/i;
const PACKAGE_ID='com.monedamundial.app';

export function leerIdentidadAndroid(informeAapt){
  if(typeof informeAapt!=='string')throw new Error('Informe Android inválido');
  const lineas=informeAapt.split(/\r?\n/).filter(linea=>linea.startsWith('package:'));
  if(lineas.length!==1)throw new Error('No se pudo identificar el paquete Android');
  const paquete=lineas[0].match(/\bname='([^']+)'/)?.[1];
  const codigoTexto=lineas[0].match(/\bversionCode='([^']+)'/)?.[1];
  if(!paquete || !/^\d+$/.test(codigoTexto||''))
    throw new Error('Paquete o versión Android inválidos');
  const versionCode=Number(codigoTexto);
  if(!Number.isSafeInteger(versionCode)||versionCode<1)
    throw new Error('Número de compilación Android inválido');
  return Object.freeze({paquete,versionCode});
}

export function evaluarActualizacionAndroid(instalada,candidata){
  for(const item of [instalada,candidata]){
    if(!item || typeof item.paquete!=='string' ||
       !Number.isSafeInteger(item.versionCode) || item.versionCode<1 ||
       typeof item.huellaSha256!=='string' || !SHA256.test(item.huellaSha256))
      throw new Error('Faltan metadatos verificados de las dos APK');
  }
  const motivos=[];
  if(instalada.paquete!==PACKAGE_ID || candidata.paquete!==PACKAGE_ID ||
     instalada.paquete!==candidata.paquete)
    motivos.push('El identificador de aplicación no coincide');
  if(instalada.huellaSha256.toLowerCase()!==candidata.huellaSha256.toLowerCase())
    motivos.push('La firma es distinta: no intentar instalar sobre la versión anterior');
  // Nuestra política exige incremento, aun si Android permite algunos códigos iguales.
  if(candidata.versionCode<=instalada.versionCode)
    motivos.push('La nueva APK debe aumentar versionCode');
  return Object.freeze({
    compatible:motivos.length===0,
    motivos,
    soloDemostracion:true,
    noAutorizaDineroReal:true,
  });
}

function herramienta(nombre){
  const configurada=process.env[nombre==='apksigner'?'APKSIGNER_PATH':'AAPT_PATH'];
  if(configurada)return configurada;
  for(const root of [process.env.ANDROID_HOME,process.env.ANDROID_SDK_ROOT]){
    if(!root)continue;
    const dir=join(root,'build-tools');
    if(!existsSync(dir))continue;
    for(const version of readdirSync(dir).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true}))){
      const ruta=join(dir,version,nombre);
      if(existsSync(ruta))return ruta;
    }
  }
  return nombre;
}

function detallesDeApk(archivo){
  const firma=execFileSync(herramienta('apksigner'),
    ['verify','--verbose','--print-certs',resolve(archivo)],
    {encoding:'utf8',maxBuffer:2*1024*1024});
  const certificado=evaluarFirmaAndroid(firma,{modo:'demo'});
  const informe=execFileSync(herramienta('aapt'),
    ['dump','badging',resolve(archivo)],
    {encoding:'utf8',maxBuffer:2*1024*1024});
  return {...leerIdentidadAndroid(informe),huellaSha256:certificado.huellaSha256};
}

function main(){
  const [anterior,nueva]=process.argv.slice(2);
  if(!anterior || !nueva || process.argv.length!==4)
    throw new Error('Uso: node scripts/comprobar-actualizacion-android.mjs APK_ANTERIOR APK_NUEVA');
  const resultado=evaluarActualizacionAndroid(detallesDeApk(anterior),detallesDeApk(nueva));
  console.log(JSON.stringify(resultado,null,2));
  if(!resultado.compatible)process.exitCode=1;
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{main();}catch(error){console.error('::error::'+error.message);process.exitCode=1;}
}
