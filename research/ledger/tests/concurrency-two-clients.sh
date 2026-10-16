#!/usr/bin/env bash
# CI EXCLUSIVAMENTE: PostgreSQL aislado, operaciones y montos inventados.
# Dos conexiones SQL distintas compiten por el MISMO evento sin doble registro.
set -Eeuo pipefail
: "${PGDATABASE:?Set PGDATABASE to a disposable CI database}"
if [[ "${PGDATABASE}" != ledger_test ]]; then
  echo "PROHIBIDO fuera de ledger_test (Postgres desechable)" >&2
  exit 90
fi
PSQL=(psql -X -qAt -v ON_ERROR_STOP=1)
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT
PROVIDER="future_regulated_provider_alpha"
ORDER="concurrent-hn-order-001"
EVENT="concurrent-hn-event-001"
"${PSQL[@]}" -c "SELECT mwd_inbox_research.register_mock_order('$PROVIDER','$ORDER','HN',10000);" >/dev/null

# El primer cliente toma el bloqueo SQL de la orden y lo retiene;
# el segundo DEBE esperar y reconocer la misma notificación tras el COMMIT.
"${PSQL[@]}" >"$TMP_DIR/a.log" 2>&1 <<'SQL' &
BEGIN;
SELECT 1 FROM mwd_inbox_research.orders WHERE provider_id='future_regulated_provider_alpha'
 AND order_id='concurrent-hn-order-001' FOR UPDATE;
SELECT pg_sleep(2);
SELECT mwd_inbox_research.record_mock_event(
 'future_regulated_provider_alpha','concurrent-hn-order-001','concurrent-hn-event-001',
 'funding_settled_mock',repeat('a',64),'HN',10000);
COMMIT;
SQL
PID_A=$!
sleep 0.4
"${PSQL[@]}" >"$TMP_DIR/b.log" 2>&1 <<'SQL' &
SELECT mwd_inbox_research.record_mock_event(
 'future_regulated_provider_alpha','concurrent-hn-order-001','concurrent-hn-event-001',
 'funding_settled_mock',repeat('a',64),'HN',10000);
SQL
PID_B=$!
wait "$PID_A" || { cat "$TMP_DIR/a.log"; exit 1; }
wait "$PID_B" || { cat "$TMP_DIR/b.log"; exit 1; }
grep -q '"already_processed": true' "$TMP_DIR/b.log" || {
  echo "La segunda conexión no deduplicó el mismo evento"; cat "$TMP_DIR/b.log"; exit 1;
}
ROWS=$("${PSQL[@]}" -c "SELECT count(*) FROM mwd_inbox_research.received_events
 WHERE provider_id='$PROVIDER' AND order_id='$ORDER';")
[[ "$ROWS" == 1 ]] || { echo "Error doble entrada: $ROWS eventos" >&2; exit 1; }

# Carrera DESEMBOLSO contra REEMBOLSO. Sólo una transición puede prosperar.
"${PSQL[@]}" >"$TMP_DIR/c.log" 2>&1 <<'SQL' &
BEGIN;
SELECT 1 FROM mwd_inbox_research.orders WHERE provider_id='future_regulated_provider_alpha'
 AND order_id='concurrent-hn-order-001' FOR UPDATE;
SELECT pg_sleep(2);
SELECT mwd_inbox_research.record_mock_event(
 'future_regulated_provider_alpha','concurrent-hn-order-001','concurrent-payout-001',
 'payout_pending_mock',repeat('b',64),'HN',10000);
COMMIT;
SQL
PID_C=$!
sleep 0.4
set +e
"${PSQL[@]}" >"$TMP_DIR/d.log" 2>&1 <<'SQL'
SELECT mwd_inbox_research.record_mock_event(
 'future_regulated_provider_alpha','concurrent-hn-order-001','concurrent-refund-001',
 'refund_pending_mock',repeat('c',64),'HN',10000);
SQL
STATUS_D=$?
set -e
wait "$PID_C" || { cat "$TMP_DIR/c.log"; exit 1; }
[[ "$STATUS_D" -ne 0 ]] || { echo "ERROR: Se aceptó devolución contradictoria" >&2; exit 1; }
STAGE=$("${PSQL[@]}" -c "SELECT stage FROM mwd_inbox_research.orders WHERE
 provider_id='$PROVIDER' AND order_id='$ORDER';")
[[ "$STAGE" == "payout_pending_mock" ]] || { echo "Fase inconsistente $STAGE"; exit 1; }
ROWS=$("${PSQL[@]}" -c "SELECT count(*) FROM mwd_inbox_research.received_events
 WHERE provider_id='$PROVIDER' AND order_id='$ORDER';")
[[ "$ROWS" == 2 ]] || { echo "Fuga de eventos tras carrera: $ROWS" >&2; exit 1; }
echo "OK: dos clientes concurrentes, deduplicación y exclusión pago/reembolso DEMO"
