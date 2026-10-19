#!/usr/bin/env bash
set -euo pipefail
# Dos sesiones SQL separadas lanzan la MISMA solicitud ficticia a la vez.
# Base creada solo para este GitHub runner; no se utiliza Supabase.
db=mwd_concurrency_demo_ci
sudo -u postgres createdb "$db"
sudo -u postgres psql -d "$db" -X -v ON_ERROR_STOP=1 -f tests/mwd-concurrent-setup-isolated.sql >/dev/null
sql="set role authenticated; set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111'; select public.mwd_transfer_demo('MWD-BBBBBBBBBBBBBBBB',1000,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid);"
sudo -u postgres psql -d "$db" -X -A -t -v ON_ERROR_STOP=1 -c "$sql" > /tmp/mwd-ci-first.txt &
pid_a=$!
sudo -u postgres psql -d "$db" -X -A -t -v ON_ERROR_STOP=1 -c "$sql" > /tmp/mwd-ci-second.txt &
pid_b=$!
wait "$pid_a"
wait "$pid_b"
grep -q '"status": "ok"' /tmp/mwd-ci-first.txt /tmp/mwd-ci-second.txt
grep -q '"status": "already_processed"' /tmp/mwd-ci-first.txt /tmp/mwd-ci-second.txt
sudo -u postgres psql -d "$db" -X -A -t -v ON_ERROR_STOP=1 -c "
do \$test\$ begin
 if (select count(*) from public.mwd_operations where actor_id='11111111-1111-4111-8111-111111111111')<>1
  or (select balance_cents from public.mwd_wallets where account_code='MWD-AAAAAAAAAAAAAAAA')<>99000
  or (select balance_cents from public.mwd_wallets where account_code='MWD-BBBBBBBBBBBBBBBB')<>201000
 then raise exception 'Concurrencia DEMO: saldos o movimientos duplicados'; end if;
end \$test\$;" >/dev/null
echo "PASS: dos sesiones concurrentes, 1 cargo ficticio y 1 abono ficticio."
