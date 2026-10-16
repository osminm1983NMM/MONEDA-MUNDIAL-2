#!/usr/bin/env bash
# Prueba SOLO CI: interrumpir sesión PostgreSQL dentro de una transacción mock.
# NUNCA correr en bases de clientes o Supabase. No mover fondos.
set -Eeuo pipefail
[[ "${PGDATABASE:-}" == "ledger_test" && "${PGHOST:-}" == "localhost" && "${PGPORT:-}" == "5432" ]] || {
  echo "BLOQUEADO: requiere base ledger_test en localhost:5432" >&2;exit 90;
}
TMP_DIR=$(mktemp -d)
worker_pid=""
cleanup(){
 if [[ -n "$worker_pid" ]];then kill "$worker_pid" 2>/dev/null || true;wait "$worker_pid" 2>/dev/null || true;fi
 rm -rf "$TMP_DIR"
}
trap cleanup EXIT
PSQL=(psql -X -qAt -v ON_ERROR_STOP=1)
PROVIDER=future_regulated_provider_alpha
ORDER=forced-rollback-hn-001
EVENT=forced-rollback-event-001

"${PSQL[@]}" -c "SELECT mwd_inbox_research.register_mock_order('$PROVIDER','$ORDER','HN',10000);" > /dev/null
# Operación exitosa DENTRO del BEGIN, pero aún no confirmada. La sesión
# aguarda pg_sleep para poder terminar exclusivamente este backend de CI.
PGAPPNAME=mwd_lab_rollback_20261016 "${PSQL[@]}" > "$TMP_DIR/worker.log" 2>&1 <<'SQL' &
BEGIN;
SELECT mwd_inbox_research.record_mock_event(
 'future_regulated_provider_alpha','forced-rollback-hn-001',
 'forced-rollback-event-001','funding_settled_mock',repeat('f',64),'HN',10000);
SELECT pg_sleep(25);
COMMIT;
SQL
worker_pid=$!
backend_pid=""
for i in $(seq 1 50); do
 backend_pid=$("${PSQL[@]}" -c "
  SELECT pid FROM pg_stat_activity
  WHERE datname='ledger_test' AND application_name='mwd_lab_rollback_20261016'
    AND state='active' AND query LIKE '%pg_sleep(25)%'
  LIMIT 1;")
 [[ "$backend_pid" =~ ^[0-9]+$ ]] && break
 sleep 0.15
done
if ! [[ "$backend_pid" =~ ^[0-9]+$ ]];then
  echo "No se encontró sesión transaccional exclusiva CI" >&2
  cat "$TMP_DIR/worker.log"
  exit 1
fi
TERMINATED=$("${PSQL[@]}" -c "SELECT pg_terminate_backend($backend_pid,2000);")
[[ "$TERMINATED" == t ]] || { echo "No pudo terminar sesión CI" >&2;exit 1; }
set +e
wait "$worker_pid" 2>/dev/null
worker_status=$?
set -e
worker_pid=""
[[ "$worker_status" -ne 0 ]] || {
 echo "ERROR: el cliente sobrevivió y pudo confirmar" >&2;exit 1;
}
# Verificación en conexión NUEVA: estado y evento del BEGIN no persistieron.
STAGE=$("${PSQL[@]}" -c "SELECT stage FROM mwd_inbox_research.orders
 WHERE provider_id='$PROVIDER' AND order_id='$ORDER';")
COUNT=$("${PSQL[@]}" -c "SELECT count(*) FROM mwd_inbox_research.received_events
 WHERE provider_id='$PROVIDER' AND order_id='$ORDER';")
[[ "$STAGE" == registered_mock && "$COUNT" == 0 ]] || {
 echo "ERROR: aborto transaccional no conservó invariantes: $STAGE / $COUNT" >&2; exit 1;
}
# En un proceso distinto se reintenta el MISMO evento, ahora sí con COMMIT.
"${PSQL[@]}" -c "SELECT mwd_inbox_research.record_mock_event(
 '$PROVIDER','$ORDER','$EVENT','funding_settled_mock',repeat('f',64),'HN',10000);" >/dev/null
COUNT=$("${PSQL[@]}" -c "SELECT count(*) FROM mwd_inbox_research.received_events
 WHERE provider_id='$PROVIDER' AND order_id='$ORDER';")
[[ "$COUNT" == 1 ]] || { echo "ERROR: reintento no procesó exactamente una vez" >&2;exit 1; }
echo "OK DEMO: backend de transacción abortado y reintento único tras recuperación"
