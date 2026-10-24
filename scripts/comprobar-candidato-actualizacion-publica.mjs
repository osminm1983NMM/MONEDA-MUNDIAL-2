// Revisión TÉCNICA de dos APK antes de siquiera considerar un update público.
// No firma, instala, envía dinero ni concede autorización para publicación.
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {evaluarFirmaAndroid} from './comprobar-firma-android.mjs';
import {leerIdentidadAndroid,evaluarActualizacionAndroid} from './comprobar-actualizacion-android.mjs';

const EXPECTED_PACKAGE='com.monedamundial.app';

export function evaluarCandidatoActualizacionPublica({config,
  metadataActual,firmaActual,metadataNueva,firmaNueva,huellaDistribucionAprobada}){
  const versionEsperada=config?.expo?.android?.versionCode;
  if(config?.expo?.android?.package!==EXPECTED_PACKAGE ||
     !Number.isSafeInteger(versionEsperada)||versionEsperada<1)
    throw new Error('app.json no declara paquete y versionCode válidos');

  const anterior=leerIdentidadAndroid(metadataActual);
  const candidata=leerIdentidadAndroid(metadataNueva);
  if(candidata.paquete!==EXPECTED_PACKAGE || candidata.versionCode!==versionEsperada)
    throw new Error('La APK candidata no coincide con app.json');

  // Examinar ambas firmas criptográficamente ANTES de comparar huellas.
  const firmaAnterior=evaluarFirmaAndroid(firmaActual,{modo:'demo'});
  const firmaCandidata=evaluarFirmaAndroid(firmaNueva,{
    modo:'distribucion',huellaAprobada:huellaDistribucionAprobada,
  });
  if(!firmaCandidata.coincidenteConCertificadoAprobado)
    throw new Error('Certificado de distribución no aprobado');

  const compatibilidad=evaluarActualizacionAndroid(
    {...anterior,huellaSha256:firmaAnterior.huellaSha256},
    {...candidata,huellaSha256:firmaCandidata.huellaSha256},
  );
  if(!compatibilidad.compatible)
    throw new Error('Actualización bloqueada: '+compatibilidad.motivos.join('; '));

  return Object.freeze({
    revisionesTecnicasSuperadas:true,
    paquete:candidata.paquete,
    versionCodeAnterior:anterior.versionCode,
    versionCodeNueva:candidata.versionCode,
    certificadoPublicoSha256:firmaCandidata.huellaSha256,
    firmaDeDistribucionNoDebug:true,
    autorizacionDePublicacion:false,
    autorizacionDeDineroReal:false,
    mensaje:'Pendiente: identidad de APK instalada, protección de datos, licencia, revisión de seguridad y aprobación de distribución.',
  });
}

function informes(archivo){
  const path=resolve(archivo);
  const firma=execFileSync(process.env.APKSIGNER_PATH||'apksigner',
    ['verify','--verbose','--print-certs',path],{encoding:'utf8',maxBuffer:2*1024*1024});
  const metadata=execFileSync(process.env.AAPT_PATH||'aapt',
    ['dump','badging',path],{encoding:'utf8',maxBuffer:2*1024*1024});
  return {firma,metadata};
}

function main(){
  const [apkAnterior,apkNueva,configArg='app.json']=process.argv.slice(2);
  if(!apkAnterior||!apkNueva||process.argv.length>5)
    throw new Error('Uso: node scripts/comprobar-candidato-actualizacion-publica.mjs APK_INSTALADA_ORIGINAL.apk APK_NUEVA.apk [app.json]');
  const huellaDistribucionAprobada=process.env.MWD_RELEASE_CERT_SHA256;
  if(!huellaDistribucionAprobada)
    throw new Error('BLOQUEADO: falta MWD_RELEASE_CERT_SHA256 aprobada fuera del repositorio');
  const anterior=informes(apkAnterior);
  const nueva=informes(apkNueva);
  const config=JSON.parse(readFileSync(resolve(configArg),'utf8'));
  const resultado=evaluarCandidatoActualizacionPublica({
    config,metadataActual:anterior.metadata,firmaActual:anterior.firma,
    metadataNueva:nueva.metadata,firmaNueva:nueva.firma,
    huellaDistribucionAprobada,
  });
  console.log(JSON.stringify(resultado,null,2));
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{main();}catch(error){console.error(`::error::${error.message}`);process.exitCode=1;}
}
