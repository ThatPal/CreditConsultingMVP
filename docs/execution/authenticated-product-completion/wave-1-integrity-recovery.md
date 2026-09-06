# APC Wave 1 — Integrity & Recovery Completion Report

## Boundary

- Branch: `rapid/phase17-18-operations-public`
- Accepted Wave 0 base: `a7b704b635ee8b5a2bdd224cafa42fecfca7b443`
- Wave 1 implementation boundary: `9e636fac25f20e25ff6454e3c957c643c3b59c49`
- Report boundary: the commit containing this file
- Merge disposition: not merged into `ai-enabled`
- Later work: Wave 2, Phase 18, deployment, and public-site work were not started

## Outcome

Wave 1 closes the bounded integrity and recovery findings without changing the authority model or creating a second source of truth. PostgreSQL remains authoritative for business state, idempotency, outbox ownership, Review artifacts, Work Items, and Post-Round facts. Realtime signals only trigger authoritative refetches.

## Finding disposition

| Finding | Disposition | Evidence |
| --- | --- | --- |
| CAPC-002 | Closed | Live application release serializes on the owning session row. OPEN/SKIP and result recording use version-and-status compare-and-set updates; stale concurrent commands fail with typed 409 responses before events are written. |
| CAPC-012 | Closed | The demo seed now creates a separate submitted Review whose accepted document, durable AI job/output, and current `credit_report.extract` artifact form a real consultant workspace path. Published history remains separate and immutable. Missing and incomplete workspaces now have distinct typed errors. |
| CAPC-022 | Closed | Outbox rows now carry `PROCESSING`, a per-claim UUID token, and an expiring lease. Success/failure terminal writes require the current token. Polls cannot overlap in one runtime; expired claims recover after crashes. |
| APC-019 | Closed for Wave 1 surfaces | Zod request failures are mapped centrally to `400 VALIDATION_ERROR`. Web errors retain status and code. Review UI distinguishes expired auth, access denial, MFA/step-up, not found, incomplete processing, stale conflict, temporary failure, and unexpected failure. |
| APC-023 | Closed | Live screens consume domain-targeted realtime refresh signals, reconnect performs an authoritative catch-up invalidation, and Redis/Socket.IO events are bridged to authenticated SSE consumers. Revocation remains reauthorized server-side for every delivery. |
| APC-025 | Closed | Post-Round result and approved-limit drafts are keyed by follow-up ID. Editing one application no longer mutates another application's pending form state. Original application events and analysis history remain append-only. |
| APC-038 | Closed | Realtime domain values use the canonical shared names and map to bounded React Query families; ordinary events no longer invalidate the whole authenticated product. |
| CAPC-021 | Closed at the Wave 1 producer/consumer boundary | `HELP` creates or reopens one urgent, duplicate-safe `ApplicationSession` Work Item. The canonical Work Queue includes it, enforces `client.read` scope for live-session work independently from `support.manage`, permits governed claim, and links to the owning live session. Rich multi-family queue presentation remains deferred to Wave 4. |

## Independent adjacent audit findings

| Finding | Severity | Disposition | Evidence |
| --- | --- | --- | --- |
| CAPC-W1-001 | P1 | Closed | Several live outbox payloads used noncanonical `live-session`, `round`, or `attention` domain strings. They now use `live-sessions`, `application-cycles`, and `work-queue`, with focused mapping tests. |
| CAPC-W1-002 | P1 | Closed | The queued demo Review used a legacy storage-key-only intake and could produce a conceptual CRM route. It now uses a complete, deterministic, idempotent document/job/output/artifact fixture and survives double seed. |
| CAPC-W1-003 | P2 | Recorded; environment-only | The long-lived local `credit_strategy` volume had migration-history/schema drift from an earlier checkout. No migration-chain defect reproduced on a zero-state database. Verification moved to the dedicated `credit_strategy_wave1` database; all 66 migrations applied cleanly. The old volume was not used or modified for acceptance evidence. |

No additional P0 security, authority, payment, credit, entitlement, or support-authority defect was discovered. CAPC-008 containment and CAPC-009, CAPC-010, CAPC-017, and CAPC-019 repairs remain present in branch history and were not reverted.

## Integrity design

### Live execution

- Release locks the owning `ApplicationSession` row before checking the unresolved-card invariant and writing the next `CreditApplication`.
- OPEN versus SKIP and competing result commands claim the expected status/version with `updateMany`; only one can succeed.
- The existing consequential-command transaction keeps business state, audit, outbox, and idempotency atomic. Lost-response retries replay from the idempotency record; different stale keys cannot overwrite the winner.
- Live Help locks the session row before reconciling its stable Work Item key, preventing duplicate producers without imposing an unsafe global uniqueness rule on historical Work Items.

### Outbox ownership and recovery

- Claim state: `PENDING → PROCESSING → PUBLISHED|PENDING|FAILED`.
- Ownership: UUID `claimToken`; lease: `claimExpiresAt` (60 seconds).
- A stale worker cannot acknowledge or retry a row after another worker owns it because every terminal update matches ID, `PROCESSING`, and claim token.
- Expired `PROCESSING` leases are reclaimable after crash/restart and increment the durable attempt.
- Unsafe payloads and an unavailable required notification processor fail terminally; transport failures retry with bounded attempts and then dead-letter as `FAILED`.
- Bull transport IDs include durable outbox ID and durable attempt. Client envelopes retain the stable outbox event ID so duplicate delivery pressure remains deduplicable and only causes authoritative refetch.

### Realtime and reconnect

- Server-side subscription and event delivery reauthorize client scope; revocation removes the socket from the room and emits `access.revoked`.
- Redis worker events are forwarded to authenticated SSE consumers as well as Socket.IO rooms.
- Browser events invalidate only affected query roots and dispatch a typed live-session signal. A reconnect performs a catch-up refetch because realtime is not authoritative state.

### Review and Post-Round

- Submitted Review demo data now reaches queue → workspace → accepted report → durable extraction artifact → deterministic draft materialization. Incomplete historical records remain explicitly incomplete.
- Each Post-Round follow-up owns its own typed draft. Server compare-and-set completion and immutable `CreditApplicationEvent` history remain unchanged.

## Verification evidence

### Fresh persistence and seed gate

- Dedicated database: `credit_strategy_wave1` (Credit-only guard accepted).
- Fresh migration deploy: 66/66 migrations applied from zero.
- Canonical system seed: passed twice; 16 option templates both runs.
- Demo seed: passed twice with stable client, queued Review, published Review, and volume fixtures.

### Tests and static gates

- Complete web tests: 21 files, 92 tests passed.
- Runtime package: 1 file, 3 tests passed.
- Complete API tests: 68 files, 268 tests passed.
- Complete worker tests: 6 files, 16 tests passed.
- Total: 96 files, 379 tests passed.
- Typecheck: all workspaces passed.
- ESLint: passed.
- Production build: web, API, worker, runtime, and shared passed. Vite retained its existing non-blocking large-chunk advisory.
- Focused additions cover invalid request classification, typed client errors, targeted query invalidation, unsafe terminal failures, transient bounded retry, overlapping poll serialization, expired-lease recovery, stable envelope identity, and restart delivery.

### Browser and review environment

- Web: `http://localhost:5185`
- API health: `http://localhost:3008/health` returned 200.
- Database: dedicated Credit-only `credit_strategy_wave1`; Redis: `localhost:6380`.
- Seed accounts: `client@credit.local`, `consultant@credit.local`, `admin@credit.local` with the established temporary development password.
- Consultant MFA enrollment is intentionally human-controlled. Browser verification reached the correct enrollment boundary on the fresh database; authenticated CRM Review workspace verification is recorded after human enrollment, without bypassing MFA.

## Exact-head CI

Exact-final-head CI is run after the report commit is pushed. The final branch head and GitHub Actions run URL are recorded in the handoff and can be verified against this report commit.

## Deferred boundaries

- Rich multi-family Work Queue filtering, grouping, and presentation remain Wave 4 work.
- Broad content and hierarchy redesign remain Wave 2+ work.
- No Phase 18, deployment, or public-site work was started.
