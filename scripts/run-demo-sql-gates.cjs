#!/usr/bin/env node
'use strict';
// Operator-only runner. Use a disposable local database; never a remote tunnel.
const { spawnSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');
const historical = [
  'accounting-release', 'ledger-posting-identity', 'ledger-reverse-coverage', 'security-release', 'auth-isolation', 'wallet-isolation',
  'remittance-quote', 'owner-authorization', 'owner-nonnull-authorization', 'conversion-reconciliation', 'conversion-reverse-coverage',
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
// Repeat the guard in the SAME psql connection as each test file. A
// different server behind a local port cannot pass merely by using the DB name.
// A marker is an additional safeguard, not proof against malicious tunnels.
const guard = `DO $isolation$
BEGIN
 IF current_database() <> 'mwd_demo_isolated' OR
    (SELECT shobj_description(oid,'pg_database') FROM pg_database WHERE datname=current_database()) IS DISTINCT FROM 'MWD_DISPOSABLE_CONCURRENCY_TEST_ONLY'
 THEN RAISE EXCEPTION 'DISPOSABLE_DATABASE_REQUIRED'; END IF;
 IF EXISTS (SELECT 1 FROM mwd_finance_private.demo_fee_routes WHERE real_payments_enabled IS DISTINCT FROM false)
 THEN RAISE EXCEPTION 'REAL_PAYMENTS_MUST_BE_DISABLED'; END IF;
 IF (SELECT count(*) FROM auth.users) <> 2 OR
    (SELECT count(*) FROM auth.users WHERE ((id='f1a00000-0000-4000-8000-000000000001' AND email='fixture-a@example.invalid') OR (id='f1a00000-0000-4000-8000-000000000002' AND email='fixture-b@example.invalid')) AND coalesce(encrypted_password,'')='') <> 2 OR
    (SELECT count(*) FROM public.mwd_wallets) <> 2 OR
    (SELECT count(*) FROM public.mwd_wallets WHERE user_id IN ('f1a00000-0000-4000-8000-000000000001','f1a00000-0000-4000-8000-000000000002')) <> 2
 THEN RAISE EXCEPTION 'SYNTHETIC_FIXTURES_REQUIRED'; END IF;
END $isolation$;`;
for (const file of files) {
  console.log('RUN ' + path.basename(file));
  const result = spawnSync('psql', [...args, '-c', guard, '-f', file], { env, stdio: 'inherit' });
  if (result.error || result.status !== 0) {
    console.error('FAILED ' + path.basename(file));
    process.exit(1);
  }
}
console.log(`PASS ${files.length} SQL gates (${mode}); does not certify concurrent requests, Android or real payments.`);
