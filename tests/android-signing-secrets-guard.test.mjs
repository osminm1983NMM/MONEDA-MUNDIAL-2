import test from 'node:test';
import assert from 'node:assert/strict';
import {clasificarRutaSecreta,detectarClavePrivadaEnTexto,inspeccionarArchivosVersionados} from '../scripts/proteger-claves-firma-android.mjs';

test('bloquea material privado de firma en cualquier carpeta',()=>{
  for(const ruta of ['android/app/release.jks','keys/upload.keystore','signing/key.p12',
    'firmas/key.pfx','android/release.pk8','private.pem','keys/signing.key',
    '.env','config/.env.production','credentials.json','config/service-account-prod.json'])
    assert.ok(clasificarRutaSecreta(ruta),ruta);
});

test('no confunde huellas públicas, código fuente o ejemplos sin secretos',()=>{
  for(const ruta of ['app.json','scripts/comprobar-firma-android.mjs','docs/versionCode.md',
    'public-cert.crt','screenshots/mock.png'])assert.equal(clasificarRutaSecreta(ruta),null,ruta);
  assert.equal(detectarClavePrivadaEnTexto('SHA-256 de certificado público: abc'),false);
});

test('detecta encabezados de claves privadas sin imprimir su contenido',()=>{
  const begin=['-----BEGIN',' PRIVATE KEY-----'].join('');
  const beginRsa=['-----BEGIN',' RSA PRIVATE KEY-----'].join('');
  assert.equal(detectarClavePrivadaEnTexto(begin+'\nNO ES UNA CLAVE REAL'),true);
  assert.equal(detectarClavePrivadaEnTexto(beginRsa),true);
});

test('inspecciona archivos rastreados y reporta solo ruta y motivo',()=>{
  const marcador=['-----BEGIN',' OPENSSH PRIVATE KEY-----'].join('');
  const lista=inspeccionarArchivosVersionados(['README.md','src/app.js','keys/privada.jks'],
    path=>path==='README.md'?marcador:'export const demo=true;');
  assert.equal(lista.length,2);
  assert.deepEqual(lista.map(x=>x.ruta),['README.md','keys/privada.jks']);
  assert.equal(JSON.stringify(lista).includes('OPENSSH'),false);
});

test('rechaza contenidos ilegibles sin pasarlos por alto',()=>{
  const lista=inspeccionarArchivosVersionados(['app.js'],()=>null);
  assert.equal(lista.length,1);
  assert.match(lista[0].motivo,/ilegible/);
});
