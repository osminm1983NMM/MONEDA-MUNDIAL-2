import test from 'node:test';
import assert from 'node:assert/strict';
import {leerIdentidadAndroid,evaluarActualizacionAndroid} from '../scripts/comprobar-actualizacion-android.mjs';

const HUELLA_A='a'.repeat(64);
const HUELLA_B='b'.repeat(64);
const apk=(versionCode,huellaSha256=HUELLA_A,paquete='com.monedamundial.app')=>
  ({versionCode,huellaSha256,paquete});

test('lee paquete y versionCode exactos del informe oficial aapt',()=>{
  const dato=leerIdentidadAndroid("package: name='com.monedamundial.app' versionCode='21' versionName='2.0.0'\n");
  assert.deepEqual(dato,{paquete:'com.monedamundial.app',versionCode:21});
});

test('permite actualización DEMO con misma firma y código incrementado',()=>{
  const resultado=evaluarActualizacionAndroid(apk(12),apk(13));
  assert.equal(resultado.compatible,true);
  assert.equal(resultado.soloDemostracion,true);
  assert.equal(resultado.noAutorizaDineroReal,true);
});

test('bloquea cambios de firma aunque el código sea mayor',()=>{
  const resultado=evaluarActualizacionAndroid(apk(12),apk(13,HUELLA_B));
  assert.equal(resultado.compatible,false);
  assert.match(resultado.motivos.join(' '),/firma es distinta/);
});

test('bloquea código repetido o inferior y paquete ajeno',()=>{
  for(const version of [10,11]){
    const resultado=evaluarActualizacionAndroid(apk(11),apk(version));
    assert.equal(resultado.compatible,false);
    assert.match(resultado.motivos.join(' '),/versionCode/);
  }
  assert.equal(evaluarActualizacionAndroid(apk(10),apk(11,HUELLA_A,'otro.paquete')).compatible,false);
});

test('rechaza informes incompletos, falsificados o con números inseguros',()=>{
  for(const info of ['',"package: name='x' versionCode='0'", "package: name='x' versionCode='2.5'",
    "package: name='x' versionCode='999999999999999999999'"]){
    assert.throws(()=>leerIdentidadAndroid(info));
  }
  assert.throws(()=>evaluarActualizacionAndroid(apk(1),apk(2,'mal')),/metadatos verificados/);
  assert.throws(()=>evaluarActualizacionAndroid(apk(1),null),/metadatos verificados/);
});
