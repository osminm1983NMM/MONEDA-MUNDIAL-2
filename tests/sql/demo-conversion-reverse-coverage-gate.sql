-- Read-only reverse coverage for conversions; works with one or both directions.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
DO $gate$
DECLARE result record;
BEGIN
 SELECT
 (SELECT count(*) FROM mwd_swap_private.demo_conversions) AS conversions,
 (SELECT count(*) FROM mwd_swap_private.demo_quotes q WHERE q.status='executed' AND NOT EXISTS (SELECT 1 FROM mwd_swap_private.demo_conversions c WHERE c.quote_id=q.id)) AS orphan_quotes,
 (SELECT count(*) FROM mwd_swap_private.demo_journal j WHERE NOT EXISTS (SELECT 1 FROM mwd_swap_private.demo_conversions c WHERE c.id=j.conversion_id)) AS orphan_journal,
 (SELECT count(*) FROM mwd_swap_private.demo_quotes q WHERE q.status='executed' AND (q.executed_at IS NULL OR q.gross_out_micro IS DISTINCT FROM q.amount_out_micro+q.fee_out_micro OR q.amount_out_micro<=0 OR q.fee_out_micro<0 OR q.amount_in_micro<=0)) AS invalid_executed_quotes,
 (SELECT count(*) FROM mwd_swap_private.demo_conversions c LEFT JOIN mwd_swap_private.demo_quotes q ON q.id=c.quote_id WHERE q.id IS NULL OR q.status IS DISTINCT FROM 'executed' OR c.settled_at IS DISTINCT FROM q.executed_at OR (c.user_id,c.from_asset,c.to_asset,c.amount_in_micro,c.amount_out_micro,c.fee_out_micro,c.stable_per_coin) IS DISTINCT FROM (q.user_id,q.from_asset,q.to_asset,q.amount_in_micro,q.amount_out_micro,q.fee_out_micro,q.stable_per_coin)) AS quote_mismatches INTO result;
 IF result.conversions=0 THEN RAISE EXCEPTION 'Missing conversion fixtures'; END IF;
 IF result.orphan_quotes<>0 OR result.orphan_journal<>0 OR result.invalid_executed_quotes<>0 OR result.quote_mismatches<>0 THEN
  RAISE EXCEPTION 'Conversion reverse coverage or quote identity mismatch';
 END IF;
END $gate$;
SELECT
 (SELECT count(*) FROM mwd_swap_private.demo_conversions) AS conversions,
 (SELECT count(*) FROM mwd_swap_private.demo_quotes q WHERE q.status='executed' AND NOT EXISTS (SELECT 1 FROM mwd_swap_private.demo_conversions c WHERE c.quote_id=q.id)) AS orphan_quotes,
 (SELECT count(*) FROM mwd_swap_private.demo_journal j WHERE NOT EXISTS (SELECT 1 FROM mwd_swap_private.demo_conversions c WHERE c.id=j.conversion_id)) AS orphan_journal,
 (SELECT count(*) FROM mwd_swap_private.demo_quotes q WHERE q.status='executed' AND (q.executed_at IS NULL OR q.gross_out_micro IS DISTINCT FROM q.amount_out_micro+q.fee_out_micro OR q.amount_out_micro<=0 OR q.fee_out_micro<0 OR q.amount_in_micro<=0)) AS invalid_executed_quotes,
 (SELECT count(*) FROM mwd_swap_private.demo_conversions c LEFT JOIN mwd_swap_private.demo_quotes q ON q.id=c.quote_id WHERE q.id IS NULL OR q.status IS DISTINCT FROM 'executed' OR c.settled_at IS DISTINCT FROM q.executed_at OR (c.user_id,c.from_asset,c.to_asset,c.amount_in_micro,c.amount_out_micro,c.fee_out_micro,c.stable_per_coin) IS DISTINCT FROM (q.user_id,q.from_asset,q.to_asset,q.amount_in_micro,q.amount_out_micro,q.fee_out_micro,q.stable_per_coin)) AS quote_mismatches;
ROLLBACK;
