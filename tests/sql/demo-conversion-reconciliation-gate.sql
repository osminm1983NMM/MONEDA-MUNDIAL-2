-- DEMO only. Read-only historical conversion reconciliation.
BEGIN TRANSACTION READ ONLY;
DO $gate$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM mwd_swap_private.demo_conversions WHERE from_asset='COIN' AND to_asset='STABLE') OR NOT EXISTS(SELECT 1 FROM mwd_swap_private.demo_conversions WHERE from_asset='STABLE' AND to_asset='COIN') THEN RAISE EXCEPTION 'Missing conversion fixtures'; END IF;
 IF EXISTS(SELECT 1 FROM mwd_swap_private.demo_balances WHERE balance_micro<0 OR balance_micro IS NULL) OR EXISTS(SELECT 1 FROM mwd_swap_private.demo_pool WHERE balance_micro<0 OR balance_micro IS NULL) THEN RAISE EXCEPTION 'Invalid balance'; END IF;
 IF EXISTS(SELECT 1 FROM mwd_swap_private.demo_journal GROUP BY conversion_id,asset_code HAVING sum(delta_micro)<>0) THEN RAISE EXCEPTION 'Unbalanced journal'; END IF;
 IF EXISTS(SELECT 1 FROM mwd_swap_private.demo_conversions GROUP BY quote_id HAVING count(*)>1) THEN RAISE EXCEPTION 'Duplicate conversion'; END IF;
 IF EXISTS(SELECT 1 FROM mwd_swap_private.demo_conversions c LEFT JOIN mwd_swap_private.demo_quotes q ON q.id=c.quote_id WHERE q.id IS NULL OR q.status IS DISTINCT FROM 'executed' OR (c.user_id,c.from_asset,c.to_asset,c.amount_in_micro,c.amount_out_micro,c.fee_out_micro,c.stable_per_coin) IS DISTINCT FROM (q.user_id,q.from_asset,q.to_asset,q.amount_in_micro,q.amount_out_micro,q.fee_out_micro,q.stable_per_coin)) THEN RAISE EXCEPTION 'Quote mismatch'; END IF;
 IF EXISTS(SELECT 1 FROM mwd_swap_private.demo_conversions c WHERE (SELECT count(*) FROM mwd_swap_private.demo_journal j WHERE j.conversion_id=c.id AND j.asset_code=c.from_asset AND j.account_type='user' AND j.delta_micro=-c.amount_in_micro)<>1 OR (SELECT count(*) FROM mwd_swap_private.demo_journal j WHERE j.conversion_id=c.id AND j.asset_code=c.to_asset AND j.account_type='user' AND j.delta_micro=c.amount_out_micro)<>1 OR (SELECT count(*) FROM mwd_swap_private.demo_journal j WHERE j.conversion_id=c.id AND j.asset_code=c.from_asset AND j.account_type='sandbox_pool' AND j.delta_micro=c.amount_in_micro)<>1 OR (SELECT count(*) FROM mwd_swap_private.demo_journal j WHERE j.conversion_id=c.id AND j.asset_code=c.to_asset AND j.account_type='sandbox_pool' AND j.delta_micro=-c.amount_out_micro)<>1 OR (SELECT count(*) FROM mwd_swap_private.demo_journal j WHERE j.conversion_id=c.id)<>4) THEN RAISE EXCEPTION 'Conversion journal mismatch'; END IF;
END $gate$;
ROLLBACK;
