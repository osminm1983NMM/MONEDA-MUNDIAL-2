'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const sql = fs.readFileSync('audits/sql-draft-social-fund-contribution-v1.sql','utf8');

test('social fund migration remains review-only and atomic', () => {
  assert.match(sql,/REVIEW-ONLY DRAFT: NOT DEPLOYED/);
  assert.match(sql,/\bBEGIN;/);
  assert.match(sql,/\bCOMMIT;/);
  assert.match(sql,/social_fund/);
  assert.match(sql,/transaction_kind IN \([^;]*'contribution'/s);
});
test('contributions have deterministic ledger identity and balanced entries', () => {
  assert.match(sql,/IF NEW.kind <> 'contribution' THEN RETURN NEW/);
  assert.match(sql,/NEW.actor_id IS DISTINCT FROM NEW.source_user_id/);
  assert.match(sql,/NEW.destination_user_id IS NOT NULL/);
  assert.match(sql,/mwd-demo-contribution:'\|\|NEW.id::text/);
  assert.match(sql,/VALUES \(v_tx,v_source,'debit',NEW.amount_cents\),\s*\(v_tx,v_fund,'credit',NEW.amount_cents\)/);
  assert.match(sql,/VALUES \('mwd-demo-contribution:'\|\|NEW.id::text,'contribution','MWD','draft'\)/);
  assert.match(sql,/SET status='posted' WHERE id=v_tx/);
});
test('social fund is internal and trigger is scoped', () => {
  assert.match(sql,/MWD-DEMO-SOCIAL-FUND/);
  assert.match(sql,/owner_user_id IS NULL/);
  assert.match(sql,/REVOKE ALL ON FUNCTION mwd_finance_private.post_demo_contribution_ledger_v1\(\)\s+FROM PUBLIC, anon, authenticated/);
  assert.match(sql,/AFTER INSERT ON public.mwd_operations FOR EACH ROW/);
  assert.doesNotMatch(sql,/GRANT\s+EXECUTE\s+ON\s+FUNCTION/i);
  assert.doesNotMatch(sql,/\bUPDATE\s+public\.mwd_wallets\b/i);
});
