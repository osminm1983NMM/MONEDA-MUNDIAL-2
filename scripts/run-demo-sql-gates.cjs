#!/usr/bin/env node
'use strict';
// Operator-only runner. Use a disposable local database; never a remote tunnel.
const { spawnSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');
const historical = [
  'accounting-release', 'ledger-posting-identity', 'ledger-reverse-coverage', 'security-release', 'auth-isolation', 'wallet-isolation',
  'remittance-quote', 'owner-authorization', 'owner-nonnull-authorization', 'conversion-reconciliation',
  'private-permissions', 'historical-recovery', 'conversion-recovery-history',
  'pickup-recovery-history', 'transfer-contribution-retry-history', 'route-simulation-only',
];
const functional = ['transfer-functional', 'conversion-functional', 'contribution-pickup'];
const mode = process.argv[2];
if (!['historical', 'functional'].includes(mode) || process.argv.length !== 3) {
  console.error('Usage: node scripts/run-demo-sql-gates.cjs historical|functional');
  process.exit(2);
}
if (process.env.MWD_CONFIRM_ISOLATED !== 'YES_LOCAL_DISPOSABLE' || !process.env.MWD_LOCAL_DB_PASSWORD) {
  console.error('Refusing: explicit local disposable database confirmation and password required.');
  process.exit(2);
}
const root = path.resolve(__dirname, '..');
const files = (mode === 'historical' ? historical : functional).map(name => path.join(root, 'tests', 'sql', `demo-${name}-gate.sql`));
for (const file of files) {
  if (!existsSync(file)) { console.error('Missing gate: ' + path.basename(file)); process.exit(2); }
}
const args = ['-X', '-w', '-h', '127.0.0.1', '-p', '54322', '-U', 'postgres', '-d', 'mwd_demo_isolated', '-v', 'ON_ERROR_STOP=1'];
// Do not inherit PGHOSTADDR, PGSERVICE, PGOPTIONS, connection URLs or other settings.
const env = { PATH: process.env.PATH, PGPASSWORD: process.env.MWD_LOCAL_DB_PASSWORD, PGCONNECT_TIMEOUT: '5', PGOPTIONS: '-c statement_timeout=30000 -c lock_timeout=2000' };
for (const file of files) {
  console.log('RUN ' + path.basename(file));
  const result = spawnSync('psql', [...args, '-f', file], { env, stdio: 'inherit' });
  if (result.error || result.status !== 0) {
    console.error('FAILED ' + path.basename(file));
    process.exit(1);
  }
}
console.log(`PASS ${files.length} SQL gates (${mode}); does not certify concurrent requests, Android or real payments.`);
