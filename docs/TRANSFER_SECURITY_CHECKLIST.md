# Moneda Mundial 2.0 — Transfer security acceptance criteria

Scope: DEMO credits only. This document does not authorize real-money operations.

## Required invariants

1. Amounts are positive integers in minor units (never binary floating-point balances).
2. The sender cannot spend more than the available balance.
3. Debit and credit must be posted atomically in one database transaction.
4. A client-supplied idempotency key is unique per initiating user and operation; retry returns the original result, never another debit.
5. Transfer authorization is determined server-side from the authenticated user, never from an arbitrary sender ID provided by the client.
6. A user may only read their own balances and transactions; administrative actions require server-validated privileges.
7. Concurrent transfers cannot overspend the same wallet; use row locking or equivalent serializable guarantees.
8. Every posted transfer has balanced ledger entries, an immutable reference, currency, timestamps and an auditable status.
9. Failed operations leave no partial debit or credit. Network timeouts must be reconciled by idempotency key before any retry.
10. Never expose Supabase service-role keys or privileged credentials in the Android bundle.

## Integration tests required before release

- Normal A-to-B transfer and balance conservation.
- Insufficient funds; zero, negative, malformed and excessive amounts.
- Same idempotency key submitted twice and concurrently.
- Two distinct concurrent transfers exceeding available funds together.
- Timeout after server commit, then retry with same key.
- Unauthorized transfer from a wallet belonging to another user.
- Read attempts against another user's ledger under RLS.
- Injected database failure during posting rolls back both entries.
- History refresh after transfer shows exactly one matching transaction.
- Reconciliation detects orphaned, duplicate or unbalanced ledger postings.

## Release gate

Do not mark these controls as implemented or tested until database functions, RLS policies, application calls and actual test outputs have been reviewed. No production transfers, real funds or token sale before legal/compliance review and independent security validation.
