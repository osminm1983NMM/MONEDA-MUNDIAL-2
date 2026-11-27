#!/usr/bin/env bash
# Disposable CI only: local socket identity test, not remote password/TLS authentication.
set -euo pipefail
container=${LAB_CONTAINER:?missing disposable cluster}
[[ "$container" =~ ^[a-f0-9]{12,64}$ ]]
db=mwd_financial_sandbox_test
role=mwd_lab_status_service
admin() { docker exec -i "$container" psql -X -qAt -v ON_ERROR_STOP=1 -U lab -d "$db" "$@"; }
direct() { docker exec -i "$container" psql -X -qAt -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -U "$role" -d "$db" "$@"; }
[[ "$(admin -c 'SELECT current_database()')" == "$db" ]]
[[ "$(admin -c "SELECT rolcanlogin FROM pg_roles WHERE rolname='$role'")" == f ]]
tmp=$(mktemp -d)
cleanup() {
  admin -c "ALTER ROLE $role NOLOGIN;" >/dev/null || return 1
  rm -rf "$tmp"
}
trap cleanup EXIT
# No password is added. The ephemeral official CI image has trusted local
# Unix socket authentication. This must never run on a shared cluster.
admin -c "ALTER ROLE $role LOGIN;"
[[ "$(direct -c "BEGIN READ ONLY; SELECT session_user,current_user,current_database(),current_setting('transaction_read_only'); COMMIT;")" == "$role|$role|$db|on" ]]
[[ "$(direct -c "SELECT count(*) FROM mwd_financial_lab.resolve_status_binding('00000000-0000-4000-8000-000000000099');")" == 0 ]]
[[ "$(direct -c "SELECT count(*) FROM mwd_financial_lab.read_bound_order_status('00000000-0000-4000-8000-000000000099','00000000-0000-4000-8000-000000000098');")" == 0 ]]
deny() {
  if direct -c "$1" >"$tmp/denied" 2>&1; then
    echo 'Unexpected privilege in restricted direct login' >&2; exit 1
  fi
  grep -q '42501' "$tmp/denied"
}
deny 'SELECT count(*) FROM mwd_financial_lab.status_bindings;'
deny 'SELECT count(*) FROM mwd_financial_lab.orders;'
deny "UPDATE mwd_financial_lab.status_bindings SET active=true;"
deny "SELECT mwd_financial_lab.issue_quote('forbidden','forbidden',10000);"
deny 'SET ROLE lab;'
deny 'SET ROLE mwd_lab_order_service;'
deny 'CREATE TEMP TABLE forbidden(id integer);'
admin -c "ALTER ROLE $role NOLOGIN;"
[[ "$(admin -c "SELECT rolcanlogin FROM pg_roles WHERE rolname='$role'")" == f ]]
echo 'Direct restricted local login, allowed status functions, denied privilege escalation and NOLOGIN restoration verified'
