import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluarFirmaAndroid} from '../scripts/comprobar-firma-android.mjs';

const DEBUG='f'.repeat(64);
const RELEASE='a'.repeat(64);
const printCert=(dn,sha,count=1)=>`Verifies\nVerified using v2 scheme: true\nNumber of signers: ${count}\nSigner #1 certificate DN: ${dn}\nSigner #1 certificate SHA-256 digest: ${sha}\n`;
const debug=printCert('CN=Android Debug, OU=Android, O=Unknown, C=US',DEBUG);
const release=printCert('CN=Moneda Mundial Test Release, O=Example, C=US',RELEASE);

test('firma debug admite solo verificación DEMO y nunca declara APK publicable',()=>{
  const resultado=evaluarFirmaAndroid(debug,{modo:'demo'});
  assert.equal(resultado.esDebug,true);
  assert.equal(resultado.aptoParaDemo,true);
  assert.equal(resultado.aptoParaPublicacion,false);
  assert.equal(resultado.coincidenteConCertificadoAprobado,false);
});

test('firma debug queda bloqueada para distribución incluso con huella coincidente',()=>{
  assert.throws(()=>evaluarFirmaAndroid(debug,{modo:'distribucion',huellaAprobada:DEBUG}),/Android Debug/);
});

test('distribución requiere fijar huella específica de certificado no debug',()=>{
  assert.throws(()=>evaluarFirmaAndroid(release,{modo:'distribucion'}),/falta huella/);
  assert.throws(()=>evaluarFirmaAndroid(release,{modo:'distribucion',huellaAprobada:DEBUG}),/distinto/);
  const resultado=evaluarFirmaAndroid(release,{modo:'distribucion',huellaAprobada:RELEASE.toUpperCase()});
  assert.equal(resultado.coincidenteConCertificadoAprobado,true);
  assert.equal(resultado.aptoParaPublicacion,false);
});

test('informe incompleto o varios firmantes bloquean por precaución',()=>{
  assert.throws(()=>evaluarFirmaAndroid('',{modo:'demo'}),/exactamente un firmante/);
  assert.throws(()=>evaluarFirmaAndroid(printCert('CN=Moneda Mundial',RELEASE,2)),/exactamente un firmante/);
  assert.throws(()=>evaluarFirmaAndroid('Number of signers: 1\nSigner #1 certificate DN: CN=NoDigest'),/identificar/);
  assert.throws(()=>evaluarFirmaAndroid(release,{modo:'otra'}),/modo inválido/);
});

test('admite formatos de certificado con rango Android SDK sin rebajar verificaciones',()=>{
  const variant=release.replaceAll('Signer #1 certificate',
    'Signer (minSdkVersion=24, maxSdkVersion=35) certificate').replaceAll('\n','\r\n');
  const result=evaluarFirmaAndroid(variant,{modo:'demo'});
  assert.equal(result.huellaSha256,RELEASE);
  assert.equal(result.aptoParaPublicacion,false);
  const numbered=release.replaceAll('Signer #1 certificate',
    'Signer #1 (minSdkVersion=24, maxSdkVersion=35) certificate');
  assert.equal(evaluarFirmaAndroid(numbered,{modo:'demo'}).huellaSha256,RELEASE);
});

test('bloquea certificados repetidos o contradictorios aunque el contador diga uno',()=>{
  const duplicated=release+'Signer #1 certificate DN: CN=Otro\nSigner #1 certificate SHA-256 digest: '+DEBUG+'\n';
  assert.throws(()=>evaluarFirmaAndroid(duplicated,{modo:'demo'}),/DN=2, SHA256=2/);
  assert.throws(()=>evaluarFirmaAndroid(release.replace('Signer #1 certificate DN:',
    'Signer #2 certificate DN:'),{modo:'demo'}),/DN=0/);
});
