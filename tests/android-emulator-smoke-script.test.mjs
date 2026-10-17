import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const program=resolve('scripts/probar-apk-emulador.sh');
const verifier=resolve('scripts/verificar-pantalla-acceso-demo.sh');
const fakeAdb=String.raw`#!/usr/bin/env bash
set -euo pipefail
case "$*" in
  'install -r '*) echo 'Success' ;;
  'shell pm path '*) echo 'package:/data/app/com.monedamundial.app/base.apk' ;;
  'shell am force-stop '*) ;;
  'logcat -c') ;;
  'shell am start -W -n '*)
    if [[ "\${MOCK_SCENARIO:-}" == 'launch_timeout' ]]; then echo 'Status: timeout'; else echo 'Status: ok'; fi ;;
  'exec-out screencap -p') printf 'MOCK_PNG' ;;
  'shell uiautomator dump '*) echo 'UI hierarchy dumped' ;;
  'pull /sdcard/moneda-mundial-ui.xml smoke-results/ui.xml')
    count_file="\${MOCK_COUNTER_FILE}"
    n=0
    if [[ -f "$count_file" ]]; then n=$(cat "$count_file"); fi
    n=$((n+1))
    echo "$n" > "$count_file"
    if [[ "\${MOCK_SCENARIO:-}" == 'all_pull_fail' || ( "\${MOCK_SCENARIO:-}" == 'retry_pull' && "$n" -lt 3 ) ]]; then
      echo 'adb pull failed' >&2
      exit 1
    fi
    printf '%s' '<hierarchy text="MONEDA MUNDIAL" hint="Iniciar sesión"/>' > smoke-results/ui.xml ;;
  'logcat -d -s '*) ;;
  'shell dumpsys window')
    if [[ "\${MOCK_SCENARIO:-}" == 'anr' ]]; then echo 'Application Not Responding'; fi ;;
  'shell pidof '*) echo '1001' ;;
  'shell ls -l '*) echo 'mock xml path' ;;
  *) echo "Unknown fake adb request: $*" >&2; exit 2 ;;
esac
`;
function run(scenario){
  const dir=mkdtempSync(join(tmpdir(),'mwd-android-sim-'));
  const bin=join(dir,'bin');
  mkdirSync(bin);
  writeFileSync(join(dir,'test.apk'),'FAKE_APK');
  writeFileSync(join(bin,'adb'),fakeAdb,{mode:0o755});
  writeFileSync(join(bin,'sleep'),'#!/usr/bin/env bash\nexit 0\n',{mode:0o755});
  writeFileSync(join(bin,'unzip'),String.raw`#!/usr/bin/env bash
if [[ "$1" == "-Z1" ]]; then printf 'assets/index.android.bundle\n'; fi
exit 0
`,{mode:0o755});
  mkdirSync(join(dir,'scripts'));
  writeFileSync(join(dir,'scripts/verificar-pantalla-acceso-demo.sh'),readFileSync(verifier));
  const out=spawnSync('bash',[program],{
    cwd:dir,encoding:'utf8',timeout:20000,
    env:{...process.env,PATH:bin+':'+process.env.PATH,MOCK_SCENARIO:scenario,MOCK_COUNTER_FILE:join(dir,'attempts'),APK_PATH:join(dir,'test.apk')}
  });
  const tries=(()=>{try{return Number(readFileSync(join(dir,'attempts'),'utf8'));}catch{return 0;}})();
  rmSync(dir,{recursive:true,force:true});
  return {...out,tries};
}
test('normal Android login smoke passes',()=>{
  const r=run('ok');assert.equal(r.status,0,r.stdout+' '+r.stderr);assert.equal(r.tries,1);
});
test('Android Activity startup timeout is never accepted',()=>{
  const r=run('launch_timeout');assert.notEqual(r.status,0);assert.match(r.stdout,/arranque.*falló/);assert.equal(r.tries,0);
});
test('accessibility tree retrieval retries until ready',()=>{
  const r=run('retry_pull');assert.equal(r.status,0,r.stdout+' '+r.stderr);assert.equal(r.tries,3);
});
test('three failures to read UI fail closed',()=>{
  const r=run('all_pull_fail');assert.notEqual(r.status,0);assert.equal(r.tries,3);assert.match(r.stdout,/no entregó el árbol/);
});
test('Android system not responding screen is rejected',()=>{
  const r=run('anr');assert.notEqual(r.status,0);assert.match(r.stdout,/ANR/);
});
