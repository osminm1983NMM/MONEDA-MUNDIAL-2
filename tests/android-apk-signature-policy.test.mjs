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
