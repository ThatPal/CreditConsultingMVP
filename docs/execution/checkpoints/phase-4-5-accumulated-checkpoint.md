# Phase 4–5 Accumulated Product Maturity, Completeness & Regression Checkpoint

## Boundary and provenance

- Branch: `rapid/phase4-5-client-commerce`
- Accepted starting head: `99592fadee3d1e0a62946777cb9536ba81792d25`
- Scope: accepted Phase 1–5 stack, with consolidated corrections limited to completed-phase behavior
- Excluded: merge to `ai-enabled`, Phase 6 work, speculative provider capabilities, database reset, and historical migration rewrites
- Canonical package: `Phase 4–5 Accumulated Product Maturity, Completeness & Regression Checkpoint — Codex Package`, including `CHATGPT BASELINE AUDIT — PRE-CODEX FINDINGS`

## Review environment restored first

The persistent Credit-only environment was verified before audit work:

- Web: `http://localhost:5184`
- API: `http://localhost:3007`
- PostgreSQL: `localhost:5433`, database `credit_strategy_phase4_5_block`
- Redis: `localhost:6380`
- API health: `GET /health` returned `200`
- PostgreSQL and Redis containers reported healthy
- Worker connected to the Credit PostgreSQL and Redis services

The web watcher initially retained no `VITE_API_URL` binding and therefore called its default API port. It was restarted with the explicit `5184 → 3007` contract. A checked-in Credit-only start command now makes this topology reproducible and refuses a `behfar` database URL.

## B01–B20 disposition register

| ID  | Disposition          | Validation and correction                                                                                                                                                                                                                                                                                                                     |
| --- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B01 | **FIXED**            | Canonical application links now use `/app`, `/crm`, and `/admin`. A stale Documents empty-state link was corrected from `/client/credit-profile` to `/app/credit-center`. Intentional legacy entry routes remain redirect-only compatibility boundaries and cannot render a second product surface.                                           |
| B02 | **FIXED**            | Purchase History now has real server-side search, status filtering, deterministic `createdAt/id` order, bounded page size, total/has-more metadata, reusable pagination, and URL-backed state. The inert “search is not needed” control was removed.                                                                                          |
| B03 | **FIXED**            | Active entitlements and Review Credit ledger rows are independently bounded and paged. Balances use database aggregation across the full append-only ledger rather than loading every transaction. The purchase summary is bounded to the latest record.                                                                                      |
| B04 | **FIXED**            | Admin navigation is grouped into Overview, Commerce, Integrations, and Utilities while preserving capability filtering.                                                                                                                                                                                                                       |
| B05 | **FIXED**            | Admin Payments now has search, provider/state filters, URL-backed state, active filter visibility, an explicit no-results state, total count, and shared deterministic pagination. Existing detail, refund, dispute, reconciliation, and gateway controls remain authoritative.                                                               |
| B06 | **FIXED**            | Shared `DataPagination` now exposes a pagination landmark, numbered direct-page controls, current-page semantics, Previous/Next controls, and exact result ranges.                                                                                                                                                                            |
| B07 | **FIXED**            | Documents upload now requires an explicit visible document category selector and updates file guidance/acceptance rules from the selected governed type. It no longer silently submits the first returned type.                                                                                                                               |
| B08 | **FIXED**            | Product-facing Admin and Consultant dashboard copy no longer discusses owning sprints, development evidence, or future implementation packages. Stale Admin service copy claiming payment operations were unavailable was removed. Honest preview/foundation language remains only where the surface truly has no authoritative workflow.     |
| B09 | **VERIFIED HEALTHY** | Goal intake, goal preferences, Journey, and Application Cycle surfaces use the canonical ClientGoal and goal-snapshot model. `/app/goals` is an authenticated compatibility entry into that governed preference workflow, not a second goal store. Goal preference and intake regression tests remain the authority.                          |
| B10 | **FIXED**            | Client directory is already server-paged. Journey projection now bounds cycles and nurture periods to the 25 most recent deterministic records, reports authoritative totals, and tells the user when older preserved history is outside the current window. Current-focus terminology remains canonical.                                     |
| B11 | **VERIFIED HEALTHY** | The shared commerce summary is currently used only in Consultant Client 360 and explicitly states the consultant’s read-only boundary. Client purchase language remains in client-only surfaces.                                                                                                                                              |
| B12 | **FIXED**            | A shared human-readable code-label contract now drives Work Queue priority/reason/lifecycle and Admin payment status presentation. Urgency labels communicate action priority rather than exposing raw enum tokens.                                                                                                                           |
| B13 | **FIXED**            | High-volume Documents, Work Queue, Purchase History, Active Services, and Admin Payments state is URL-backed, so filter/page state survives refresh and supports reviewable links.                                                                                                                                                            |
| B14 | **VERIFIED HEALTHY** | Staff access redirects an enrolled-but-unverified staff session to MFA step-up and an unenrolled staff session to password-confirmed QR enrollment with a preserved `returnTo`. Auth regression coverage verifies expiration/return-path behavior; manual review confirms no redirect loop before enrollment input.                           |
| B15 | **FIXED**            | The Credit-only environment was restored and a deterministic `review:phase4-5:start` command was added with explicit database, Redis, API, web-origin, Better Auth, and Vite API bindings plus a Behfar fail-closed guard.                                                                                                                    |
| B16 | **VERIFIED HEALTHY** | Notifications already use bounded incremental loading, unread state, read/read-all commands, and regression coverage. No destructive correction was needed.                                                                                                                                                                                   |
| B17 | **FIXED**            | Client and Consultant support deep links now fetch the authorized case detail directly, independent of the current list page/filter. The server continues to enforce client ownership or canonical `support.manage` plus client scope.                                                                                                        |
| B18 | **FIXED**            | Key Documents, Services, Purchase History, Admin Payments, Work Queue, and support failures provide retry/recovery guidance and explicitly state when no mutation occurred, while suppressing server/private storage detail.                                                                                                                  |
| B19 | **VERIFIED HEALTHY** | Production routing imports the canonical Client Context, Review, Journey, Support, commerce, and payment pages. Legacy `/client` and `/consultant` routes are redirect-only compatibility entries; development showcase routes remain guarded by the development/test feature boundary. No stale route renders competing production behavior. |
| B20 | **FIXED**            | Admin landing now provides structured, role-appropriate entry cards for services, payments, and gateway health; grouped navigation, operational filters, result counts, empty states, and consistent status semantics improve the assembled product without decorative fake metrics.                                                          |

## Additional independent findings

### C01 — Legitimate outbox events could poison and dead-letter the worker (**FIXED**, high)

The restored worker exposed repeated `OUTBOX_PAYLOAD_UNSAFE` failures. Global gateway configuration events legitimately have no client recipient, while authorization events were created without the required realtime `domains` routing metadata. Both were retried until dead-lettered.

Correction:

- governed `commerce.gateway.*` global events are acknowledged without publishing a client envelope;
- arbitrary malformed events still fail closed;
- all staff-assignment/access grant/revoke events now include canonical client and domain routing metadata;
- focused worker tests prove global acknowledgement and unsafe-payload rejection.

### C02 — Review runtime silently fell back to the wrong API port (**FIXED**, medium)

The web process could start on `5184` while using the application’s default API port because `VITE_API_URL` was not bound in the watcher environment. This produced a visually running but unusable shell. The deterministic Credit-only start script binds the full topology and records per-process logs.

## Accumulated requirement matrix

| Area                                    | Evidence                                                                                                                                                                   |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local runtime and Credit-only isolation | Runtime assertions, Docker topology, explicit start script, `assertCreditDatabaseUrl`, no Behfar URL accepted                                                              |
| Database/migrations/transactions        | Historical migration chain preserved; clean migration and repeated system-seed gate recorded below; consequential command tests cover state + audit + outbox + idempotency |
| Auth/MFA/authorization                  | Better Auth session/MFA tests, canonical capability/scope integration tests, MFA return-path manual review                                                                 |
| Client/relationship/goal/journey        | Client directory paging, canonical goal tests, bounded Journey projection and deterministic history ordering                                                               |
| Realtime/outbox/worker                  | Business-command pipeline tests, worker retry/dead-letter tests, new global/internal-event correction                                                                      |
| Documents/storage                       | Provider routing/security tests, server paging/filtering, explicit document-type upload acceptance proof                                                                   |
| Notifications/email/support/attention   | Notification paging and delivery tests, support lifecycle/deep-link tests, Work Queue projection/claim tests and URL-backed state                                          |
| Services/purchases/entitlements         | Immutable product version tests, bounded client purchase/entitlement/ledger queries, server search/pagination proof                                                        |
| PayPal/Stripe/BofA                      | Provider-neutral gateway contract and adapter suites; no unsupported BofA capabilities invented                                                                            |
| Refunds/disputes/reconciliation         | Original-provider routing, idempotency, rollback/retry, webhook authenticity, dispute and reconciliation integration suites                                                |
| UI maturity/accessibility               | Shared design system, focus-surface regression, grouped navigation, reusable data navigation, actionable errors and honest empty states                                    |

## Verification ledger

### Clean database proof

- Created disposable Credit-only database `credit_strategy_phase45_checkpoint_clean`.
- `pnpm db:migrate:deploy`: **PASS**, all 35 historical migrations applied from zero in their original order.
- `pnpm db:seed:system` first run: **PASS**, 16 canonical option templates.
- `pnpm db:seed:system` second run: **PASS**, the same 16 canonical option templates with no duplicate/reference failure.
- The persistent `credit_strategy_phase4_5_block` database was not reset.

### Focused correction proof

- Worker outbox contract: **4/4 PASS** (client envelope, unsafe fail-closed, governed global acknowledgement, retry/dead-letter contract).
- Documents UI: **8/8 PASS**, including deliberate document-category selection.
- Support/App shell correction rerun: **29/29 PASS**, including a deep-linked case outside the current page and the matured Admin landing.
- Commerce route tests: **4/4 PASS**, including bounded searched deterministic Purchase History page 2.

### Accumulated workspace gate

- `pnpm test`: **PASS**
  - Web: 13 files, **75 tests**
  - Runtime: 1 file, **3 tests**
  - Shared: no tests, pass-with-no-tests contract
  - API: 33 files, **136 tests**
  - Worker: 4 files, **10 tests**
  - Total: 51 test files, **224 tests passed**
- `pnpm lint`: **PASS**, zero errors/warnings.
- `pnpm typecheck`: **PASS** across Web, Runtime, Shared, Worker, and API.
- `pnpm build`: **PASS** for Web, Runtime, Shared, Worker, and API. Vite reported only its advisory main-chunk size warning.

### Runtime recovery and manual smoke

- The 47 historical events matching the confirmed C01 defect were narrowly repaired and replayed.
- Post-replay result: authorization grant **13 PUBLISHED**, authorization revoke **13 PUBLISHED**, staff-assignment deactivate **13 PUBLISHED**, and gateway-default change **13 PUBLISHED**; no affected event remains failed.
- Worker dependency readiness: PostgreSQL **ready**, Redis **ready**, worker **ready**.
- Web `5184` and API `3007` respond; the staff session reaches password-confirmed QR enrollment with `returnTo=/admin` and no browser console error.

### Repository CI

The branch CI result and final commit are recorded after the checkpoint commit is pushed.

## Review access

- Client: `client@credit.local` / `DemoAccess2026!`
- Consultant: `consultant@credit.local` / `DemoAccess2026!`
- Admin: `admin@credit.local` / `DemoAccess2026!`
- Staff accounts use QR-based authenticator enrollment and MFA step-up; no shared OTP seed is committed or reported.

## Decision

Checkpoint implementation is confined to `rapid/phase4-5-client-commerce`. It is not merged into `ai-enabled`, and Phase 6 has not started.
