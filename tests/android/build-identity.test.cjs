const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const app=fs.readFileSync('App.js','utf8');
const workflow=fs.readFileSync('.github/workflows/apk-demo-gradle.yml','utf8');
const marker="const BUILD_COMMIT = 'sin verificar';";
const start=workflow.indexOf("          node <<'NODE'\n");
const end=workflow.indexOf("\n          NODE",start);
assert.ok(start>=0 && end>start);
const script=workflow.slice(start+"          node <<'NODE'\n".length,end).split('\n').map(x=>x.slice(10)).join('\n');
const sha='a'.repeat(40);
function stamp(source,commit){
  const mem={'App.js':source,'app.json':JSON.stringify({expo:{android:{}}})};
  new Function('require','process',script)(
    name=>{assert.equal(name,'node:fs');return {readFileSync:p=>mem[p],writeFileSync:(p,v)=>{mem[p]=v;}};},
    {env:{GITHUB_SHA:commit}}
  );
  return mem;
}
test('LAB embeds exact commit and package',()=>{
  const out=stamp(app,sha);
  assert.ok(out['App.js'].includes("const BUILD_COMMIT = '"+sha+"';"));
  assert.ok(out['App.js'].includes('com.monedamundial.lab.samsung:'));
  assert.equal(JSON.parse(out['app.json']).expo.android.package,'com.monedamundial.lab.samsung');
});
test('reject malformed build identifier',()=>assert.throws(()=>stamp(app,'bad')));
test('reject missing marker',()=>assert.throws(()=>stamp(app.replace(marker,''),sha)));
test('reject duplicated marker',()=>assert.throws(()=>stamp(app+'\n'+marker,sha)));
test('screen and emulator require build identity',()=>{
  assert.ok(app.includes('Compilación: {BUILD_COMMIT}'));
  assert.ok(workflow.includes('grep -F "$GITHUB_SHA" "$RUNNER_TEMP/mwd-ui.xml"'));
});

test('dependency resolution uses a committed lock when present and captures a generated lock otherwise',()=>{
  assert.ok(workflow.includes("'package-lock.json'"));
  assert.match(workflow,/if \[ -f package-lock\.json \]; then\s+npm ci --no-audit --no-fund\s+else\s+npm install --package-lock --no-audit --no-fund/);
  assert.ok(workflow.includes('test -s package-lock.json'));
  assert.ok(workflow.includes('cp package-lock.json "$RUNNER_TEMP/mwd-package-lock.json"'));
});
test('packaged dependency resolution is checked for changes and hashed before upload',()=>{
  assert.ok(workflow.includes('cmp "$RUNNER_TEMP/mwd-package-lock.json" ../package-lock.json'));
  assert.ok(workflow.includes('cp "$RUNNER_TEMP/mwd-package-lock.json" package-lock.json'));
  assert.ok(workflow.includes('sha256sum package-lock.json TOOLCHAIN.txt > DEPENDENCIES-SHA256.txt'));
  assert.ok(workflow.indexOf('sha256sum package-lock.json TOOLCHAIN.txt')<workflow.indexOf('actions/upload-artifact@v4'));
});
test('emulator verifies APK and dependency provenance before installing',()=>{
  const verify=workflow.indexOf('sha256sum -c DEPENDENCIES-SHA256.txt');
  assert.ok(verify>workflow.indexOf('sha256sum -c SHA256.txt'));
  assert.ok(verify<workflow.indexOf('Install and launch Android 35'));
});
