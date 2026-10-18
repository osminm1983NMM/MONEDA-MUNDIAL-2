import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const program=resolve('scripts/android_anr_triage.py');
function fixture(pkg,hasDialog=true,history=''){
 const dir=mkdtempSync(join(tmpdir(),'mwd-anr-'));
 const title=pkg==='com.google.android.apps.nexuslauncher'?'Pixel Launcher':'Moneda Mundial';
 const xml=hasDialog?'<hierarchy><node resource-id="android:id/alertTitle" text="'+title+' isn&apos;t responding"/><node resource-id="android:id/aerr_close" clickable="true" bounds="[10,20][80,90]"/></hierarchy>':'<hierarchy/>';
 const focus=hasDialog?'mCurrentFocus=Window{123 u0 Application Not Responding: '+pkg+'}\n':'mCurrentFocus=Window{123 u0 com.monedamundial.app/MainActivity}\n';
 const a=join(dir,'ui.xml'),b=join(dir,'window.txt');writeFileSync(a,xml);writeFileSync(b,history+focus);
 const r=spawnSync('python3',[program,'classify',a,b],{encoding:'utf8'});
 const coords=spawnSync('python3',[program,'launcher-close-coordinates',a,b],{encoding:'utf8'});
 rmSync(dir,{recursive:true,force:true});
 return {status:r.status,result:r.stdout.trim(),coordStatus:coords.status,coordinates:coords.stdout.trim()};
}
test('Pixel Launcher ANR actual admite recuperar botón',()=>{
 const r=fixture('com.google.android.apps.nexuslauncher');
 assert.equal(r.result,'launcher_anr');assert.equal(r.coordinates,'45 55');
});
test('un ANR de Moneda Mundial no se ignora',()=>{
 const r=fixture('com.monedamundial.app');
 assert.equal(r.result,'app_anr');assert.notEqual(r.coordStatus,0);
});
test('un ANR histórico sin diálogo actual no bloquea',()=>{
 const r=fixture('com.google.android.apps.nexuslauncher',false,'WINDOW MANAGER LAST ANR: Pixel Launcher\n');
 assert.equal(r.result,'none');assert.notEqual(r.coordStatus,0);
});
test('ANR ajenos bloqueados',()=>{
 const r=fixture('com.other.app');
 assert.equal(r.result,'other_anr');assert.notEqual(r.coordStatus,0);
});
