// Contract tests for the DEMO Android login-screen detector.
// No credentials, real device or customer information are required.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const script='scripts/verificar-pantalla-acceso-demo.sh';
function check({screen='PNG',xml='<hierarchy text="MONEDA MUNDIAL" hint="Accede a Moneda Mundial"/>',noScreen=false,noXml=false}={}){
  const dir=mkdtempSync(join(tmpdir(),'mwd-ui-'));
  try{
    const shot=join(dir,'screen.png'),ui=join(dir,'tree.xml');
    if(!noScreen)writeFileSync(shot,screen);
    if(!noXml)writeFileSync(ui,xml);
    return spawnSync('bash',[script,ui,shot],{encoding:'utf8'});
  } finally {rmSync(dir,{recursive:true,force:true});}
}
test('valid DEMO login UI passes',()=>{
  const p=check();assert.equal(p.status,0,p.stderr+' '+p.stdout);
});
test('empty or missing screenshot is rejected',()=>{
  assert.notEqual(check({screen:''}).status,0);
  assert.notEqual(check({noScreen:true}).status,0);
});
test('empty or missing accessibility tree is rejected',()=>{
  assert.notEqual(check({xml:''}).status,0);
  assert.notEqual(check({noXml:true}).status,0);
});
test('blank/error page or unrelated app is rejected',()=>{
  assert.notEqual(check({xml:'<hierarchy/>'}).status,0);
  assert.notEqual(check({xml:'<hierarchy text="Error de conexión"/>'}).status,0);
  assert.notEqual(check({xml:'<hierarchy text="MONEDA MUNDIAL"/>'}).status,0);
  assert.notEqual(check({xml:'<hierarchy text="Iniciar sesión"/>'}).status,0);
});
test('alternate visible DEMO entry labels are accepted',()=>{
  for(const label of ['Iniciar sesión','Crear cuenta de prueba']){
    assert.equal(check({xml:`<hierarchy text="MONEDA MUNDIAL" hint="${label}"/>`}).status,0,label);
  }
});