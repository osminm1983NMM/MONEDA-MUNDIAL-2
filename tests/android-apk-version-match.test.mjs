import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validarVersionAndroidDemo} from '../scripts/comprobar-version-android-demo.mjs';

const config={expo:{android:{package:'com.monedamundial.app',versionCode:2}}};
const informe=(name,code)=>`package: name='${name}' versionCode='${code}' versionName='2.0.0'\n`;

test('el laboratorio declara explícitamente una versión Android superior a 1',()=>{
  const real=JSON.parse(readFileSync(new URL('../app.json',import.meta.url),'utf8'));
  assert.equal(real.expo.android.package,'com.monedamundial.app');
  assert.equal(real.expo.android.versionCode,2);
});

test('acepta APK si paquete y versionCode coinciden con app.json',()=>{
  const resultado=validarVersionAndroidDemo(config,informe('com.monedamundial.app',2));
  assert.deepEqual(resultado,{coincide:true,paquete:'com.monedamundial.app',versionCode:2,
    soloDemostracion:true,autorizaDistribucion:false});
});

test('rechaza versión repetida o mayor no declarada, aunque la firma fuera válida',()=>{
  for(const codigo of [1,3])
    assert.throws(()=>validarVersionAndroidDemo(config,informe('com.monedamundial.app',codigo)),/APK inconsistente/);
});

test('rechaza otro paquete o metadatos inconsistentes',()=>{
  assert.throws(()=>validarVersionAndroidDemo(config,informe('otro.paquete',2)),/APK inconsistente/);
  assert.throws(()=>validarVersionAndroidDemo(config,"package: name='x'\n"),/inválidos/);
});

test('no permite compilación sin versionCode explícito válido',()=>{
  for(const version of [undefined,0,-1,1.5,'2',null]){
    const configInvalida={expo:{android:{package:'com.monedamundial.app',versionCode:version}}};
    assert.throws(()=>validarVersionAndroidDemo(configInvalida,informe('com.monedamundial.app',2)),/versionCode explícito/);
  }
});
