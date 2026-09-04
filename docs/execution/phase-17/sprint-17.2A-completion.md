# Sprint 17.2A — Identity, Access & Session Administration

Status: complete

Implementation boundary: `1e134ea20f6849605c934a3fbaf006e51cc968b6`

## Delivered

- Admin-only, capability-protected user/staff directory and identity detail with bounded deterministic pagination.
- Governed role changes with optimistic concurrency, self/last-Admin lockout protection, explicit capability-impact warning, transactional session invalidation, audit, security event, outbox event, and idempotency.
- Step-up-protected session revocation and staff MFA reset. MFA reset cannot target the acting Admin and revokes all target sessions.
- Canonical staff assignment activation/deactivation and scoped, expiring access-grant creation/revocation through the existing authorization administration service.
- Admin UI for user discovery, role/capability state, sessions, MFA, assignments, and grant history. Admin remains operational authority only; no Consultant professional capability is introduced.

## Verification

- `@credit/api` focused Admin identity tests: 3 passed.
- `@credit/api` typecheck: passed.
- `@credit/web` typecheck: passed.
- repository lint: passed.
- Unintended full API run: 62 files / 245 tests passed; 3 Redis-dependent suites failed because `REDIS_URL` was omitted from that ad-hoc command, not because of a product assertion. The required environment-aware CI follows on the report head.

## Risk controls

- Every mutation requires Admin role, canonical `settings.manage`, recent step-up MFA, and an idempotency key.
- Security and audit history are append-only; role/session/MFA effects commit atomically with their outbox records.
- Directory and related collections are bounded and deterministically ordered.
- No schema change and no migration were required.
