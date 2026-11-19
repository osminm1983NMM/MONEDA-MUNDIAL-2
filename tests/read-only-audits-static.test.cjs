'use strict';
// Static safety checks for reproducible SQL audits. These do not execute SQL.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const files = [
  'sql-readonly-social-fund-preflight-2026-11-19.sql',
  'sql-readonly-transfer-crosscheck-2026-11-19.sql',
  'sql-readonly-public-rls-review-2026-11-19.sql'
];

for (const name of files) {
  test(name + ' is a read-only audit', () => {
    const sql = fs.readFileSync(path.join('audits', name), 'utf8');
    const withoutComments = sql.replace(/--[^\n]*/g, '');
    assert.match(withoutComments, /\bSELECT\b/i);
    assert.doesNotMatch(withoutComments, /\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE|GRANT|REVOKE|CALL|DO|EXECUTE)\b/i,
      'read-only audit must not contain database writes or executable procedures');
  });
}

test('transfer crosscheck verifies both ledger sides and orphan records', () => {
  const sql = fs.readFileSync('audits/sql-readonly-transfer-crosscheck-2026-11-19.sql','utf8');
  for (const check of ['missing_ledger','not_posted','wrong_entry_count','amount_mismatch','wrong_account_direction','orphan_transfer_ledger']) {
    assert.ok(sql.includes(check), 'missing transfer audit metric: ' + check);
  }
});

test('RLS audit includes grants and user-scoped policies', () => {
  const sql = fs.readFileSync('audits/sql-readonly-public-rls-review-2026-11-19.sql','utf8');
  assert.match(sql,/relrowsecurity/);
  assert.match(sql,/has_table_privilege/);
  assert.match(sql,/pg_policies/);
});
