#!/usr/bin/env bash
# Respaldo/restauración ÚNICAMENTE CI Postgres desechable.
set -Eeuo pipefail
[[ "${PGDATABASE:-}" == ledger_test && "${PGHOST:-}" == localhost && "${PGPORT:-}" == 5432 ]] || {
 echo "Prohibido salir de CI ledger_test localhost" >&2; exit 90;
}
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT
PSQL=(psql -X -qAt -v ON_ERROR_STOP=1)
RESTORE=ledger_restore_test
"${PSQL[@]}" -c "SELECT mwd_inbox_research.register_mock_order(
 'future_regulated_provider_beta','backup-order-ni-001','NI',10000);" >/dev/null
"${PSQL[@]}" -c "SELECT mwd_inbox_research.record_mock_event(
 'future_regulated_provider_beta','backup-order-ni-001','backup-event-ni-001',
 'funding_settled_mock',repeat('b',64),'NI',10000);" >/dev/null
BEFORE=$("${PSQL[@]}" -c "SELECT count(*) FROM mwd_inbox_research.received_events;")
pg_dump --format=custom --no-owner --no-privileges --schema=mwd_inbox_research --file="$TMP_DIR/backup.dump" ledger_test
# No eliminar ni tocar base de origen; usar un destino desechable nuevo.
if "${PSQL[@]}" -d postgres -c "SELECT 1 FROM pg_database WHERE datname='$RESTORE';" | grep -q 1;then
 echo "DB de restauración existe: no sobrescribir" >&2;exit 1
fi
createdb "$RESTORE"
pg_restore --no-owner --no-privileges --exit-on-error --dbname="$RESTORE" "$TMP_DIR/backup.dump"
AFTER=$("${PSQL[@]}" -d "$RESTORE" -c "SELECT count(*) FROM mwd_inbox_research.received_events;")
[[ "$BEFORE" == "$AFTER" ]] || { echo "Restauración perdió eventos" >&2;exit 1; }
STAGE=$("${PSQL[@]}" -d "$RESTORE" -c "SELECT stage FROM mwd_inbox_research.orders WHERE
 provider_id='future_regulated_provider_beta' AND order_id='backup-order-ni-001';")
[[ "$STAGE" == funding_settled_mock ]] || { echo "Restauración perdió estados" >&2;exit 1; }
# La restauración preserva los IDs: un replay no puede generar un segundo evento.
AGAIN=$("${PSQL[@]}" -d "$RESTORE" -c "SELECT mwd_inbox_research.record_mock_event(
 'future_regulated_provider_beta','backup-order-ni-001','backup-event-ni-001',
 'funding_settled_mock',repeat('b',64),'NI',10000);")
[[ "$AGAIN" == *'"already_processed": true'* ]] || { echo "Idempotencia perdida" >&2; exit 1; }
echo "OK DEMO: backup/restauración de inbox y reintento recuperado en DB aislada"
