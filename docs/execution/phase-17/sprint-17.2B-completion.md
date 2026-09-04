# Sprint 17.2B — Audit & Security Event Operations

Status: complete

Implementation boundary: `e9db3101e01fb798941e945e1864aee9de3e420b`

## Delivered

- Admin-only audit and security event discovery with action/type, severity, actor, client, and text filters.
- Bounded cursor pagination ordered by `createdAt` and unique `id` for stable traversal.
- Immutable event detail views; no update/delete routes exist.
- Recursive server-side redaction of password, token, secret, authorization, cookie, card-number, and file-content metadata keys.
- Safe deep links to client, user, and payment records where the event has a known canonical target.
- Operational UI with explicit empty/error states and incremental older-history loading.

## Verification

- Focused Admin tests: 4 passed, including nested redaction proof.
- API and Web typechecks: passed.
- Repository lint and diff whitespace check: passed.
- No schema or migration changes.

## Authority and safety

Read access requires Admin role plus canonical `settings.manage`; navigation additionally requires `audit.read_platform`. Event history remains append-only and raw sensitive metadata is never returned by detail endpoints.
