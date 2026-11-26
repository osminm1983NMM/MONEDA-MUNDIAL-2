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
