# DEMO release acceptance

## Verified evidence
- [Android CI run 45736122605](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/45736122605): 31 + 16 automated tests passed; APK build and Android 35 install/launch smoke test passed.
- Supabase migration 20261126024008, mwd_demo_contribution_ledger_closure: 28 posted transactions, 56 entries, zero unbalanced transactions at verification.
- 38 owner RPCs rejected simulated ordinary authenticated users; parameterized tests used typed nulls.

## Release gates still open
- Real Android interruption: submit a small DEMO transfer, interrupt connectivity, reopen, restore connectivity, reconcile original request, verify exactly one operation and expected balances. Repeat for conversion and pickup as applicable.
- Authorized isolated concurrent new-request test: same request ID and same payload in independent sessions; verify one operation and one debit; reject changed payload. Verify actual overlap. Previous tool execution blocked; do not bypass controls.
- Final security review, including leaked-password protection and privileged RPC warnings.
- Verify final APK corresponds to approved source and record device results.

No real-money activation, production approval, or regulatory readiness is implied. Do not merge main until release gates are reviewed.
