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
      if (name === 'node:child_process') return { spawnSync(cmd, args, opts) { calls.push({cmd,args,opts}); return calls.length === options.failAt ? { status: 1 } : calls.length === options.timeoutAt ? { status: null, error: Object.assign(Error('timeout'),{code:'ETIMEDOUT'}) } : { status: 0 }; } };
      if (name === 'node:fs') return { existsSync: file => !options.missing || !file.endsWith(options.missing) };
      if (name === 'node:path') return path;
      throw Error('Unexpected import: ' + name);
    } });
  } catch (error) { if (error !== exitSignal) throw error; }
  return { status, calls, logs };
}
test('historical mode runs 17 distinct gates', () => {
  const r = simulate('historical'); assert.equal(r.status, 0); assert.equal(r.calls.length, 17); assert.equal(new Set(r.calls.map(c=>c.args.at(-1))).size, 17);
  assert.ok(r.calls.some(c=>c.args.at(-1).endsWith('demo-conversion-reverse-coverage-gate.sql')));
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

test('each SQL file is preceded by isolation, fixture and payment checks in one psql invocation', () => {
 for(const mode of ['historical','functional']){
  const result=simulate(mode);
  for(const {args} of result.calls){
   const i=args.indexOf('-c'),j=args.indexOf('-f');
   assert.ok(i>=0&&j===i+2);
   const guard=args[i+1];
   assert.match(guard,/MWD_DISPOSABLE_CONCURRENCY_TEST_ONLY/);
   assert.match(guard,/real_payments_enabled IS DISTINCT FROM false/);
   assert.match(guard,/SYNTHETIC_FIXTURES_REQUIRED/);
   assert.match(guard,/fixture-a@example\.invalid/);
   assert.match(guard,/fixture-b@example\.invalid/);
   assert.ok(args.includes('ON_ERROR_STOP=1'));
  }
 }
});

test('runner has a bounded process deadline and stops on a timed-out SQL gate', () => {
 const r=simulate('historical',{timeoutAt:2});
 assert.equal(r.status,1);assert.equal(r.calls.length,2);
 for(const c of r.calls){assert.equal(c.opts.timeout,120000);assert.equal(c.opts.killSignal,'SIGKILL');}
});
