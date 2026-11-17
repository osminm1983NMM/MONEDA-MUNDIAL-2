\set ON_ERROR_STOP on
-- Modelo sintético de seguridad de retiro. PostgreSQL efímero, sin Supabase principal.
CREATE SCHEMA IF NOT EXISTS mwd_pickup_test;
CREATE TABLE mwd_pickup_test.orders(id int PRIMARY KEY,status text NOT NULL);
CREATE TABLE mwd_pickup_test.codes(order_id int PRIMARY KEY REFERENCES mwd_pickup_test.orders(id),status text NOT NULL DEFAULT 'active', failed_attempts int NOT NULL DEFAULT 0, secret text NOT NULL, identity_checked boolean NOT NULL DEFAULT false, consume_request uuid);
CREATE TABLE mwd_pickup_test.attempts(order_id int NOT NULL, request_id uuid NOT NULL, supplied_code text, accepted boolean NOT NULL, PRIMARY KEY(order_id,request_id));
CREATE TABLE mwd_pickup_test.payouts(order_id int PRIMARY KEY, status text NOT NULL DEFAULT 'planned',request_id uuid);
INSERT INTO mwd_pickup_test.orders VALUES (1,'simulated'),(2,'simulated'),(3,'simulated');
INSERT INTO mwd_pickup_test.codes(order_id,secret,identity_checked) VALUES (1,'DEMO-SECRET',true),(2,'DEMO-SECRET',true),(3,'DEMO-SECRET',false);
INSERT INTO mwd_pickup_test.payouts(order_id) VALUES (1),(2),(3);
CREATE FUNCTION mwd_pickup_test.try_code(p_order int,p_code text,p_request uuid)
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE c mwd_pickup_test.codes%rowtype; a mwd_pickup_test.attempts%rowtype; ok boolean;
BEGIN
 IF p_request IS NULL THEN RAISE EXCEPTION 'missing request'; END IF;
 SELECT * INTO c FROM mwd_pickup_test.codes WHERE order_id=p_order FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'missing code'; END IF;
 SELECT * INTO a FROM mwd_pickup_test.attempts WHERE order_id=p_order AND request_id=p_request;
 IF FOUND THEN
  IF a.supplied_code IS DISTINCT FROM p_code THEN RAISE EXCEPTION 'reused request with different code'; END IF;
  RETURN a.accepted;
 END IF;
 IF c.status<>'active' THEN RETURN false; END IF;
 ok := (p_code=c.secret AND c.identity_checked);
 IF p_code IS DISTINCT FROM c.secret THEN
  UPDATE mwd_pickup_test.codes SET failed_attempts=failed_attempts+1,
   status=CASE WHEN failed_attempts+1>=5 THEN 'locked' ELSE 'active' END WHERE order_id=p_order;
 ELSIF ok THEN
  UPDATE mwd_pickup_test.codes SET status='consumed',consume_request=p_request WHERE order_id=p_order;
 END IF;
 INSERT INTO mwd_pickup_test.attempts VALUES(p_order,p_request,p_code,ok);
 RETURN ok;
END $$;
CREATE FUNCTION mwd_pickup_test.finish(p_order int,p_request uuid)
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE c mwd_pickup_test.codes%rowtype; p mwd_pickup_test.payouts%rowtype;
BEGIN
 SELECT * INTO c FROM mwd_pickup_test.codes WHERE order_id=p_order FOR UPDATE;
 SELECT * INTO p FROM mwd_pickup_test.payouts WHERE order_id=p_order FOR UPDATE;
 IF p.status='sample_completed' AND p.request_id=p_request THEN RETURN true; END IF;
 IF p.status<>'planned' OR c.status<>'consumed' OR NOT c.identity_checked
   OR (SELECT status FROM mwd_pickup_test.orders WHERE id=p_order)<>'simulated' THEN
  RAISE EXCEPTION 'not eligible'; END IF;
 UPDATE mwd_pickup_test.payouts SET status='sample_completed',request_id=p_request WHERE order_id=p_order;
 RETURN true;
END $$;
DO $$
DECLARE i int; rid uuid; BEGIN
 -- No completar antes de consumir.
 BEGIN PERFORM mwd_pickup_test.finish(1,'00000000-0000-0000-0000-000000000101'); RAISE EXCEPTION 'premature payout accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'not eligible' THEN RAISE; END IF; END;
 -- Cinco errores bloquean y el código correcto posterior no desbloquea.
 FOR i IN 1..5 LOOP
  rid:=('00000000-0000-0000-0000-'||lpad((200+i)::text,12,'0'))::uuid;
  IF mwd_pickup_test.try_code(2,'WRONG',rid) THEN RAISE EXCEPTION 'wrong code accepted'; END IF;
 END LOOP;
 IF (SELECT status FROM mwd_pickup_test.codes WHERE order_id=2)<>'locked' OR
  (SELECT failed_attempts FROM mwd_pickup_test.codes WHERE order_id=2)<>5 THEN RAISE EXCEPTION 'lockout failed'; END IF;
 IF mwd_pickup_test.try_code(2,'DEMO-SECRET','00000000-0000-0000-0000-000000000206') THEN RAISE EXCEPTION 'locked code accepted'; END IF;
 -- Identidad simulada pendiente: nunca consumir.
 IF mwd_pickup_test.try_code(3,'DEMO-SECRET','00000000-0000-0000-0000-000000000301') THEN RAISE EXCEPTION 'identity bypass'; END IF;
 IF (SELECT status FROM mwd_pickup_test.codes WHERE order_id=3)<>'active' THEN RAISE EXCEPTION 'identity pending consumed'; END IF;
 -- Consumo correcto, replay idéntico, replay con código distinto rechazado.
 rid:='00000000-0000-0000-0000-000000000401';
 IF NOT mwd_pickup_test.try_code(1,'DEMO-SECRET',rid) OR
    NOT mwd_pickup_test.try_code(1,'DEMO-SECRET',rid) THEN RAISE EXCEPTION 'valid or replay failed'; END IF;
 BEGIN PERFORM mwd_pickup_test.try_code(1,'WRONG',rid); RAISE EXCEPTION 'changed replay accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'reused request with different code' THEN RAISE; END IF; END;
 IF NOT mwd_pickup_test.finish(1,'00000000-0000-0000-0000-000000000402') OR
    NOT mwd_pickup_test.finish(1,'00000000-0000-0000-0000-000000000402') THEN RAISE EXCEPTION 'completion replay failed'; END IF;
 IF (SELECT count(*) FROM mwd_pickup_test.payouts WHERE status='sample_completed')<>1 THEN RAISE EXCEPTION 'unexpected completed payouts'; END IF;
END $$;
SELECT 'POSTGRES_PICKUP_NEGATIVE_MODEL_PASS' AS result;
