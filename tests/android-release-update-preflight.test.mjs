import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluarCandidatoActualizacionPublica} from '../scripts/comprobar-candidato-actualizacion-publica.mjs';

const RELEASE='a'.repeat(64),DEBUG='b'.repeat(64);
const informe=(dn,sha)=>`Verifies\nVerified using v2 scheme (APK Signature Scheme v2): true\nNumber of signers: 1\nSigner #1 certificate DN: CN=${dn}, O=Test\nSigner #1 certificate SHA-256 digest: ${sha}\n`;
const pkg=(versionCode,name='com.monedamundial.app')=>`package: name='${name}' versionCode='${versionCode}' versionName='2.0.0'\n`;
const caso={
  config:{expo:{android:{package:'com.monedamundial.app',versionCode:2}}},
  metadataActual:pkg(1),metadataNueva:pkg(2),
  firmaActual:informe('Moneda Mundial Release',RELEASE),
  firmaNueva:informe('Moneda Mundial Release',RELEASE),
  huellaDistribucionAprobada:RELEASE,
};

test('acepta técnicamente un update firmado igual y con versión mayor, pero NO publica',()=>{
  const resultado=evaluarCandidatoActualizacionPublica(caso);
  assert.equal(resultado.revisionesTecnicasSuperadas,true);
  assert.equal(resultado.versionCodeAnterior,1);
  assert.equal(resultado.versionCodeNueva,2);
  assert.equal(resultado.autorizacionDePublicacion,false);
  assert.equal(resultado.autorizacionDeDineroReal,false);
});

test('rechaza certificado Android Debug aun cuando coincide la huella aprobada',()=>{
  assert.throws(()=>evaluarCandidatoActualizacionPublica({...caso,
    firmaActual:informe('Android Debug',DEBUG),firmaNueva:informe('Android Debug',DEBUG),
    huellaDistribucionAprobada:DEBUG,
  }),/Android Debug/);
});

test('rechaza update desde la DEMO con firma distinta, sin desinstalar datos',()=>{
  assert.throws(()=>evaluarCandidatoActualizacionPublica({...caso,
    firmaActual:informe('Android Debug',DEBUG),
  }),/La firma es distinta/);
});

test('rechaza certificados no aprobados y ausencia de huella de distribución',()=>{
  assert.throws(()=>evaluarCandidatoActualizacionPublica({...caso,
    huellaDistribucionAprobada:DEBUG,
  }),/certificado distinto/);
  assert.throws(()=>evaluarCandidatoActualizacionPublica({...caso,
    huellaDistribucionAprobada:'',
  }),/falta huella/);
});

test('rechaza instalar la misma versión, una menor o un paquete diferente',()=>{
  for(const versionCode of [2,3])
    assert.throws(()=>evaluarCandidatoActualizacionPublica({...caso,
      metadataActual:pkg(versionCode),
    }),/versionCode/);
  assert.throws(()=>evaluarCandidatoActualizacionPublica({...caso,
    metadataNueva:pkg(2,'otro.paquete'),
  }),/no coincide con app.json/);
});

test('rechaza app.json incorrecto e informes falsos o incompletos',()=>{
  assert.throws(()=>evaluarCandidatoActualizacionPublica({...caso,
    config:{expo:{android:{package:'com.monedamundial.app'}}},
  }),/app.json/);
  assert.throws(()=>evaluarCandidatoActualizacionPublica({...caso,
    firmaActual:'No verified',
  }),/exactamente un firmante/);
  assert.throws(()=>evaluarCandidatoActualizacionPublica({...caso,
    metadataActual:'',
  }),/identificar el paquete/);
});
