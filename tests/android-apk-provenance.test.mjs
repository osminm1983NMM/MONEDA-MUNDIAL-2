import test from 'node:test';
import assert from 'node:assert/strict';
import {construirRegistroApkDemo} from '../scripts/registrar-identidad-apk-demo.mjs';

const base={
  config:{expo:{android:{package:'com.monedamundial.app',versionCode:2}}},
  badging:"package: name='com.monedamundial.app' versionCode='2' versionName='2.0.0'\n",
  firmaVerificada:'Verifies\nVerified using v2 scheme (APK Signature Scheme v2): true\nNumber of signers: 1\nSigner #1 certificate DN: CN=Android Debug, OU=Android, O=Unknown\nSigner #1 certificate SHA-256 digest: '+('a'.repeat(64))+'\n',
  sha256Apk:'b'.repeat(64),
  commit:'c'.repeat(40),
  runId:'40138353554',
};

test('registra identidad no publicable de archivo, paquete, versión, firmante y commit',()=>{
  const resultado=construirRegistroApkDemo(base);
  assert.equal(resultado.tipo,'MONEDA_MUNDIAL_APK_DEMO_NO_PUBLICAR');
  assert.equal(resultado.paquete,'com.monedamundial.app');
  assert.equal(resultado.versionCode,2);
  assert.equal(resultado.sha256Apk,'b'.repeat(64));
  assert.equal(resultado.certificadoSha256,'a'.repeat(64));
  assert.equal(resultado.commit,'c'.repeat(40));
  assert.equal(resultado.autorizaDistribucion,false);
  assert.equal(resultado.autorizaDineroReal,false);
});

test('rechaza discrepancia de paquete y versión de APK frente al código',()=>{
  for(const badging of [
    "package: name='otro.paquete' versionCode='2'\n",
    "package: name='com.monedamundial.app' versionCode='1'\n",
  ])assert.throws(()=>construirRegistroApkDemo({...base,badging}),/APK inconsistente/);
});

test('rechaza un supuesto manifiesto demo firmado con certificado de distribución',()=>{
  const release=base.firmaVerificada.replace('Android Debug','Moneda Mundial Release');
  assert.throws(()=>construirRegistroApkDemo({...base,firmaVerificada:release}),/solo admite APK/);
});

test('rechaza firma ambigua, archivo sin SHA, commit incorrecto o runId inseguro',()=>{
  const invalidos=[
    {firmaVerificada:'Not verified'},
    {sha256Apk:'b'},
    {commit:'main'},
    {runId:'0'},
    {runId:'999999999999999999999999999'},
    {runId:''},
  ];
  for(const mod of invalidos)
    assert.throws(()=>construirRegistroApkDemo({...base,...mod}));
});
