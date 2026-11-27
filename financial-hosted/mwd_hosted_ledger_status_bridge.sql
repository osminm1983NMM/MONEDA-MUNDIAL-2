-- Hosted synthetic ledger -> status projection. No API or runtime writer enabled.
BEGIN;
DO $$ BEGIN
 IF current_database()<>'postgres' OR NOT EXISTS(SELECT 1 FROM mwd_financial_hosted.environment_guard WHERE environment='sandbox' AND NOT live_funds_enabled AND NOT provider_dispatch_enabled)
 OR EXISTS(SELECT 1 FROM mwd_financial_hosted.multi_orders)
 OR EXISTS(SELECT 1 FROM mwd_financial_hosted.order_status_projection)
 THEN RAISE EXCEPTION 'EMPTY_HOSTED_LAB_REQUIRED'; END IF;
END $$;
SET LOCAL search_path=mwd_financial_hosted,pg_catalog,pg_temp;
ALTER TABLE order_status_projection ADD COLUMN ledger_id text GENERATED ALWAYS AS (order_id::text) STORED;
ALTER TABLE order_status_projection ADD CONSTRAINT hosted_projection_ledger_fk FOREIGN KEY(ledger_id) REFERENCES multi_orders(id) ON DELETE RESTRICT;
CREATE FUNCTION hosted_project_state(p_state text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT SECURITY INVOKER SET search_path=pg_catalog AS $$
 SELECT CASE p_state WHEN 'awaiting_funding' THEN 'funding_pending' WHEN 'funding_failed' THEN 'funding_failed'
 WHEN 'funded' THEN 'funded' WHEN 'fx_acquired' THEN 'funded' WHEN 'paid' THEN 'paid'
 WHEN 'payout_failed_converted' THEN 'payout_failed' WHEN 'payout_failed_unconverted' THEN 'payout_failed'
 WHEN 'refunded' THEN 'refunded' END
$$;
-- No invented payout_pending/refund_pending without evidence of dispatch.
CREATE FUNCTION hosted_projection_check() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,mwd_financial_hosted,pg_temp AS $$
DECLARE o multi_orders%ROWTYPE;
BEGIN
 IF TG_OP='UPDATE' AND (NEW.order_id,NEW.user_id,NEW.principal_minor,NEW.fee_minor,NEW.total_minor,NEW.payout_minor,NEW.accepted_at)
 IS DISTINCT FROM (OLD.order_id,OLD.user_id,OLD.principal_minor,OLD.fee_minor,OLD.total_minor,OLD.payout_minor,OLD.accepted_at)
 THEN RAISE EXCEPTION 'PROJECTION_IDENTITY_IMMUTABLE'; END IF;
 SELECT * INTO STRICT o FROM multi_orders WHERE id=NEW.order_id::text FOR UPDATE;
 IF (NEW.status,NEW.principal_minor,NEW.fee_minor,NEW.total_minor,NEW.payout_minor)
 IS DISTINCT FROM (hosted_project_state(o.state),o.principal,o.fee,o.principal+o.fee,o.payout)
 THEN RAISE EXCEPTION 'PROJECTION_LEDGER_MISMATCH'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER hosted_projection_check BEFORE INSERT OR UPDATE ON order_status_projection FOR EACH ROW EXECUTE FUNCTION hosted_projection_check();
CREATE FUNCTION hosted_sync_projection() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,mwd_financial_hosted,pg_temp AS $$
BEGIN
 IF (NEW.id,NEW.principal,NEW.fee,NEW.payout) IS DISTINCT FROM (OLD.id,OLD.principal,OLD.fee,OLD.payout)
 THEN RAISE EXCEPTION 'LEDGER_ORDER_IMMUTABLE'; END IF;
 IF NEW.state IS DISTINCT FROM OLD.state THEN
 UPDATE order_status_projection SET status=hosted_project_state(NEW.state) WHERE ledger_id=NEW.id;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER hosted_sync_projection AFTER UPDATE ON multi_orders FOR EACH ROW EXECUTE FUNCTION hosted_sync_projection();
CREATE FUNCTION hosted_register_synthetic_order(p_order uuid,p_user uuid,p_principal bigint,p_fee bigint,p_payout bigint)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,mwd_financial_hosted,pg_temp AS $$
DECLARE o multi_orders%ROWTYPE; p order_status_projection%ROWTYPE;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM environment_guard WHERE environment='sandbox' AND NOT live_funds_enabled AND NOT provider_dispatch_enabled)
 THEN RAISE EXCEPTION 'SANDBOX_DISABLED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM status_bindings WHERE user_id=p_user AND active) THEN RAISE EXCEPTION 'BINDING_REQUIRED'; END IF;
 PERFORM multi_create(p_order::text,p_principal,p_fee,p_payout);
 SELECT * INTO STRICT o FROM multi_orders WHERE id=p_order::text FOR UPDATE;
 SELECT * INTO p FROM order_status_projection WHERE order_id=p_order;
 IF FOUND THEN
 IF p.user_id<>p_user THEN RAISE EXCEPTION 'ORDER_OWNER_CONFLICT'; END IF;
 RETURN 'duplicate';
 END IF;
 IF o.state<>'awaiting_funding' OR EXISTS(SELECT 1 FROM multi_events WHERE order_id=o.id)
 THEN RAISE EXCEPTION 'ORDER_HISTORY_EXISTS'; END IF;
 INSERT INTO order_status_projection(order_id,user_id,status,principal_minor,fee_minor,total_minor,payout_minor,accepted_at)
 VALUES(p_order,p_user,hosted_project_state(o.state),o.principal,o.fee,o.principal+o.fee,o.payout,statement_timestamp());
 RETURN 'created';
END $$;
REVOKE ALL ON FUNCTION hosted_project_state(text),hosted_projection_check(),hosted_sync_projection(),hosted_register_synthetic_order(uuid,uuid,bigint,bigint,bigint) FROM PUBLIC,anon,authenticated,service_role,mwd_hosted_status_reader;
COMMIT;
