import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {spawnSync} from 'node:child_process';
function node(text,clickable=false){return '<node text="'+text+'" clickable="'+clickable+'" bounds="[10,20][80,90]"/>';}
function invoke(action,xml){
 const dir=mkdtempSync(join(tmpdir(),'mwd-readiness-'));const file=join(dir,'ui.xml');
 writeFileSync(file,'<hierarchy>'+xml+'</hierarchy>');
 const r=spawnSync('python3',['scripts/android_guest_tour_contract.py',action,file,file],{encoding:'utf8'});
 rmSync(dir,{recursive:true,force:true});return r;
}
test('verificación de preparación pública acepta aviso y ceros visibles',()=>{
 const xml=[node('Preparación pública del proyecto'),node('SOLO INVESTIGACIÓN · SIN FONDOS REALES'),
 node('Estados Unidos → Honduras'),node('Contratos financieros confirmados: 0. Países operativos: 0.'),
 node('Volver al recorrido de Moneda Mundial',true)].join('');
 assert.equal(invoke('readiness',xml).status,0);
 assert.equal(invoke('readiness-back',xml).stdout.trim(),'45 55');
});
test('ausencia de advertencia o de botón bloquea validación',()=>{
 const xml=[node('Preparación pública del proyecto'),node('Estados Unidos → Honduras'),node('Países operativos: 0')].join('');
 assert.notEqual(invoke('readiness',xml).status,0);
 assert.notEqual(invoke('readiness-back',xml).status,0);
});
test('entrada sin cuenta accesible y pulsable',()=>{
 const xml=node('Ver requisitos pendientes (sin cuenta)',true);
 assert.equal(invoke('readiness-entry',xml).stdout.trim(),'45 55');
});
