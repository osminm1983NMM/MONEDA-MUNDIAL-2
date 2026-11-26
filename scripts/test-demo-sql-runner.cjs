'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, 'run-demo-sql-gates.cjs'), 'utf8');
function simulate(mode, options = {}) {
  const calls = [], logs = [], exitSignal = Symbol('exit');
  let status = 0;
  const env = { PATH: '/test', MWD_CONFIRM_ISOLATED: 'YES_LOCAL_DISPOSABLE', MWD_LOCAL_DB_PASSWORD: 'fake-test-only', PGHOSTADDR: '192.0.2.1', PGSERVICE: 'remote', PGOPTIONS: 'unsafe', ...options.env };
  const proc = { argv: ['node', 'runner', mode], env, exit(code) { status = code; throw exitSignal; } };
  try {
    vm.runInNewContext(source, { __dirname, process: proc, console: { log: v => logs.push(v), error: v => logs.push(v) }, require(name) {
      if (name === 'node:child_process') return { spawnSync(cmd, args, opts) { calls.push({cmd,args,opts}); return calls.length === options.failAt ? { status: 1 } : { status: 0 }; } };
      if (name === 'node:fs') return { existsSync: file => !options.missing || !file.endsWith(options.missing) };
      if (name === 'node:path') return path;
      throw Error('Unexpected import: ' + name);
    } });
  } catch (error) { if (error !== exitSignal) throw error; }
  return { status, calls, logs };
}
test('historical mode runs 14 distinct gates', () => {
  const r = simulate('historical'); assert.equal(r.status, 0); assert.equal(r.calls.length, 14); assert.equal(new Set(r.calls.map(c=>c.args.at(-1))).size, 14);
});
test('functional mode runs only three first-operation gates', () => {
  const r = simulate('functional'); assert.equal(r.status, 0); assert.equal(r.calls.length, 3); assert.ok(r.calls.every(c=>/functional|contribution-pickup/.test(c.args.at(-1))));
});
test('unknown mode refuses to execute', () => { const r=simulate('all'); assert.equal(r.status,2); assert.equal(r.calls.length,0); });
test('missing confirmation or password refuses to execute', () => {
  for (const env of [{MWD_CONFIRM_ISOLATED:''},{MWD_LOCAL_DB_PASSWORD:''}]) {const r=simulate('historical',{env});assert.equal(r.status,2);assert.equal(r.calls.length,0);}
});
test('missing gate aborts before opening connections', () => { const r=simulate('historical',{missing:'demo-route-simulation-only-gate.sql'});assert.equal(r.status,2);assert.equal(r.calls.length,0); });
test('failed SQL gate stops execution immediately', () => { const r=simulate('historical',{failAt:3});assert.equal(r.status,1);assert.equal(r.calls.length,3); });
test('local fixed target and no inherited remote parameters', () => {
  for(const c of simulate('functional').calls){assert.equal(c.cmd,'psql');assert.equal(c.args[c.args.indexOf('-h')+1],'127.0.0.1');assert.equal(c.args[c.args.indexOf('-p')+1],'54322');assert.equal(c.args[c.args.indexOf('-d')+1],'mwd_demo_isolated');assert.equal(c.opts.env.PGHOSTADDR,undefined);assert.equal(c.opts.env.PGSERVICE,undefined);assert.match(c.opts.env.PGOPTIONS,/statement_timeout/);assert.ok(c.args.includes('ON_ERROR_STOP=1'));}
});
