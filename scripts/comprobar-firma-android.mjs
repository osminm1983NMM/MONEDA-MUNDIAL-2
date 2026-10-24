// Comprobación de certificados APK sin manejar llaves privadas ni cambiar fondos.
// apksigner verifica criptográficamente la APK antes de que evaluemos el certificado.
import {execFileSync} from 'node:child_process';
import {existsSync, readdirSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const HEX_SHA256=/^[a-f0-9]{64}$/i;

export function evaluarFirmaAndroid(salida,{modo='demo',huellaAprobada=''}={}){
  if(typeof salida!=='string' || !['demo','distribucion'].includes(modo))
    throw new Error('Informe de firma o modo inválido');
  const signers=salida.match(/^Number of signers:\s*(\d+)\s*$/m);
  if(!signers || Number(signers[1])!==1)
    throw new Error('Se requiere exactamente un firmante APK verificable');
  // apksigner muestra "Signer #1" en compilaciones normales y puede usar
  // "Signer (minSdkVersion=..., maxSdkVersion=...)" según la versión del SDK.
  // No aceptar informes con varios certificados ambiguos para distribución.
  const nombres=[...salida.matchAll(/^Signer(?: #1)?(?: \([^\r\n)]*\))? certificate DN:[ \t]*(.+?)[ \t]*\r?$/gm)];
  const huellas=[...salida.matchAll(/^Signer(?: #1)?(?: \([^\r\n)]*\))? certificate SHA-256 digest:[ \t]*([a-fA-F0-9:]+)[ \t]*\r?$/gm)];
  const dn=nombres[0]?.[1]?.trim();
  const huella=huellas[0]?.[1]?.replaceAll(':','').toLowerCase();
  if(nombres.length!==1 || huellas.length!==1 || !dn || !HEX_SHA256.test(huella||''))
    throw new Error(`No se pudo identificar el certificado APK verificado (DN=${nombres.length}, SHA256=${huellas.length})`);
  const debug=/(?:^|,)\s*CN\s*=\s*Android Debug\s*(?:,|$)/i.test(dn);
  const aprobada=typeof huellaAprobada==='string' ? huellaAprobada.replaceAll(':','').toLowerCase() : '';
  if(modo==='distribucion'){
    if(debug)throw new Error('BLOQUEADO: certificado Android Debug, no distribuir');
    if(!HEX_SHA256.test(aprobada))
      throw new Error('BLOQUEADO: falta huella SHA-256 aprobada para distribución');
    if(aprobada!==huella)
      throw new Error('BLOQUEADO: certificado distinto al autorizado');
  }
  return Object.freeze({
    modo,certificadoDn:dn,huellaSha256:huella,
    esDebug:debug,aptoParaDemo:true,
    // Esta comprobación de firma nunca autoriza una publicación por sí sola.
    coincidenteConCertificadoAprobado:modo==='distribucion' && !debug && aprobada===huella,
    aptoParaPublicacion:false,
  });
}

function buscarApksigner(){
  if(process.env.APKSIGNER_PATH)return process.env.APKSIGNER_PATH;
  for(const root of [process.env.ANDROID_HOME,process.env.ANDROID_SDK_ROOT]){
    if(!root)continue;
    const dir=join(root,'build-tools');
    if(!existsSync(dir))continue;
    for(const version of readdirSync(dir).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true}))){
      const candidato=join(dir,version,'apksigner');
      if(existsSync(candidato))return candidato;
    }
  }
  return 'apksigner';
}

function main(){
  const [archivo,modoArg,huellaAprobada='']=process.argv.slice(2);
  if(!archivo || !['--demo','--distribucion'].includes(modoArg))
    throw new Error('Uso: node scripts/comprobar-firma-android.mjs APK --demo | --distribucion HUELLA_SHA256_APROBADA');
  const salida=execFileSync(buscarApksigner(),['verify','--verbose','--print-certs',resolve(archivo)],
    {encoding:'utf8',maxBuffer:2*1024*1024});
  const resultado=evaluarFirmaAndroid(salida,{
    modo:modoArg==='--demo'?'demo':'distribucion',huellaAprobada,
  });
  console.log(JSON.stringify(resultado,null,2));
  if(resultado.esDebug)
    console.log('::warning::APK verificada para DEMO con certificado Android Debug: NO PUBLICAR NI DISTRIBUIR');
  else if(resultado.modo==='distribucion')
    console.log('Certificado coincidente; siguen pendientes las demás puertas de publicación.');
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{main();}catch(error){console.error(`::error::${error.message}`);process.exitCode=1;}
}
