// Previene inclusión accidental de material de firma o secretos en Git.
// No abre claves ni cambia Git; este detector complementa, no sustituye,
// protección de secretos del repositorio y revisión antes de hacer push.
import {execFileSync} from 'node:child_process';
import {readFileSync,statSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const NOMBRES_SECRETOS=/(?:^|\/)(?:\.env(?:\.|$)|(?:google-services|(?:eas-)?credentials|service-account[^/]*)\.json$)/i;
const EXTENSIONES_SECRETAS=/\.(?:jks|keystore|p12|pfx|pk8|pem|key)$/i;
const EXTENSIONES_TEXTO=/\.(?:js|jsx|mjs|cjs|ts|tsx|json|md|yml|yaml|sh|py|sql|txt|properties|gradle)$/i;
const MARCADOR_CLAVE_PRIVADA=/-----BEGIN\s+(?:(?:RSA|EC|DSA|OPENSSH|ENCRYPTED)\s+)?PRIVATE\s+KEY-----/i;
const MAX_TEXTO=2*1024*1024;

export function clasificarRutaSecreta(ruta){
  if(typeof ruta!=='string'||!ruta||ruta.includes('\0'))throw new Error('Ruta inválida');
  const normalizada=ruta.replaceAll('\\','/');
  if(NOMBRES_SECRETOS.test(normalizada))return 'archivo de credenciales o entorno';
  if(EXTENSIONES_SECRETAS.test(normalizada))return 'archivo de clave/certificado potencialmente privado';
  return null;
}

export function detectarClavePrivadaEnTexto(texto){
  if(typeof texto!=='string')throw new Error('Contenido inválido');
  return MARCADOR_CLAVE_PRIVADA.test(texto);
}

export function inspeccionarArchivosVersionados(rutas,leerArchivo){
  if(!Array.isArray(rutas)||typeof leerArchivo!=='function')throw new Error('Inventario inválido');
  const incidencias=[];
  for(const ruta of rutas){
    const motivo=clasificarRutaSecreta(ruta);
    if(motivo){incidencias.push({ruta,motivo});continue;}
    if(!EXTENSIONES_TEXTO.test(ruta))continue;
    const contenido=leerArchivo(ruta);
    if(typeof contenido!=='string' || contenido.length>MAX_TEXTO){
      incidencias.push({ruta,motivo:'archivo de código demasiado grande o ilegible'});
      continue;
    }
    if(detectarClavePrivadaEnTexto(contenido))
      incidencias.push({ruta,motivo:'bloque de clave privada en código o documentación'});
  }
  return Object.freeze(incidencias);
}

function main(){
  const raiz=resolve(process.cwd());
  const listado=execFileSync('git',['ls-files','-z'],{cwd:raiz,maxBuffer:5*1024*1024});
  const rutas=listado.toString('utf8').split('\0').filter(Boolean);
  const incidencias=inspeccionarArchivosVersionados(rutas,ruta=>{
    const archivo=resolve(raiz,ruta);
    if(!archivo.startsWith(raiz+'/'))throw new Error('Ruta fuera del repositorio');
    if(statSync(archivo).size>MAX_TEXTO)return null;
    return readFileSync(archivo,'utf8');
  });
  if(incidencias.length){
    for(const {ruta,motivo} of incidencias)console.error(`::error::${ruta}: ${motivo}`);
    process.exitCode=1;
    return;
  }
  console.log(`OK: ${rutas.length} archivos versionados inspeccionados; sin claves privadas detectadas.`);
  console.log('Aviso: revisar secretos con mecanismos especializados antes de publicar.');
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{main();}catch(error){console.error(`::error::${error.message}`);process.exitCode=1;}
}
