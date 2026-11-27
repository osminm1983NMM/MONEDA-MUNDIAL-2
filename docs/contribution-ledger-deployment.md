# Contribution ledger deployment — DEMO only

Applied to the existing demo database with owner authorization. Source: [reviewed SQL](contribution-ledger-closure.sql), blob 109519fa23a3d550ebf1953d033c4ad2390fcfc9. The deployed transaction replaced the final rollback with reconciliation assertions and commit. The source file intentionally retains rollback for rehearsal.

Verified after deployment: 28 posted transactions, 56 entries, 6 historical contributions totaling 2400 minor MWD units, zero unbalanced transactions, zero missing transfer/contribution postings. Both contribution helpers deny direct execution to anon and authenticated roles. Both posting triggers enabled.

Formal Supabase migration history remains pending; do not blindly rerun the candidate or alter migration history. No real funds enabled. Remaining validation: simultaneous new requests and Android network interruption.
