#!/usr/bin/env bash
# Dos conexiones simultáneas sobre el mismo requestId sintético.
# Sólo PostgreSQL desechable 'ledger_test'; no clientes ni dinero real.
set -Eeuo pipefail
: "${PGDATABASE:?PGDATABASE requerido}"
if [[ "$PGDATABASE" != ledger_test ]]; then
  echo 'BLOQUEADO fuera de ledger_test' >&2
  exit 90
fi
TEMP_MWD=$(mktemp -d)
export TEMP_MWD
trap 'rm -rf "$TEMP_MWD"' EXIT
PSQL=(psql -X -qAt -v ON_ERROR_STOP=1)

"${PSQL[@]}" >"$TEMP_MWD/first.log" 2>&1 <<'SQL' &
BEGIN;
SELECT mwd_recovery_research.reserve_mock_request(
 'SIM-US-RACE001','checkpoint-race-request-001',
 '00000000-0000-4000-8000-000000000011','SIM-HN-RECIP01','HN',10000);
\! touch "$TEMP_MWD/first_ready"
SELECT pg_sleep(3);
COMMIT;
SQL
FIRST_PID=$!
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if [[ -f "$TEMP_MWD/first_ready" ]]; then break; fi
  sleep 0.2
done
if [[ ! -f "$TEMP_MWD/first_ready" ]]; then
  echo 'No se estableció la primera reserva' >&2
  wait "$FIRST_PID" || true
  exit 1
fi

"${PSQL[@]}" >"$TEMP_MWD/second.log" 2>&1 <<'SQL' &
SELECT mwd_recovery_research.reserve_mock_request(
 'SIM-US-RACE001','checkpoint-race-request-001',
 '00000000-0000-4000-8000-000000000011','SIM-HN-RECIP01','HN',10000);
SQL
SECOND_PID=$!
wait "$FIRST_PID" || { echo 'Falló primera conexión' >&2; exit 1; }
wait "$SECOND_PID" || { echo 'Falló segunda conexión' >&2; exit 1; }
grep -q '"already_processed": true' "$TEMP_MWD/second.log" || {
  echo 'La segunda conexión no detectó idempotencia' >&2
  exit 1
}

ROWS=$("${PSQL[@]}" -c "SELECT count(*) FROM mwd_recovery_research.requests
 WHERE actor_alias='SIM-US-RACE001';")
[[ "$ROWS" == 1 ]] || { echo "Reserva duplicada: $ROWS" >&2; exit 1; }

set +e
"${PSQL[@]}" >"$TEMP_MWD/third.log" 2>&1 <<'SQL'
SELECT mwd_recovery_research.reserve_mock_request(
 'SIM-US-RACE001','checkpoint-race-request-002',
 '00000000-0000-4000-8000-000000000012','SIM-HN-RECIP01','HN',10000);
SQL
THIRD_CODE=$?
set -e
[[ "$THIRD_CODE" -ne 0 ]] || { echo 'Aceptó dos pendientes en una cuenta' >&2; exit 1; }
echo 'OK: dos sesiones competidoras, una reserva DEMO, cero reenvíos autorizados'
