# APC Wave 2 — Shell, Navigation & Shared Interaction Foundation

## Boundary

- Accepted base: `b77d00d909cfc9324d3fe9db78abbf240dd5f1f7`
- Implementation boundary: `5401f7c93d211e17f6a3ba5df52d8be2d012993b`
- Branch: `rapid/phase17-18-operations-public`
- Final synchronized head: the report commit containing this document; the exact SHA and CI URL are recorded in the handoff.
- Scope stopped at Wave 2. Wave 3, Phase 18, public-site, deployment and `ai-enabled` integration were not started.

## Audit and dispositions

| Finding | Disposition | Evidence |
| --- | --- | --- |
| APC-001–006 shared shell/IA | Closed for the shared foundation | Canonical role-specific registry, deliberate parent ownership, grouped Admin IA and one active owner for nested routes. Owning workspace depth remains for Waves 3–5. |
| APC-016 / CAPC-016 | Preserved/closed | Admin event surfaces do not create Consultant Client 360 links; shell metadata never fabricates a cross-role destination. |
| APC-017 | Preserved | The accepted MFA routing repair was not changed. Real Consultant challenge completed and returned to CRM. |
| APC-039 / APC-040 | Closed centrally | Shared typed recovery, empty/loading-compatible structure, record context and governed-action dialog introduced. |
| APC-047–050 / APC-053 | Closed for shared surfaces | Human role labels, route context, responsive action hierarchy and shared state vocabulary established; exposed screen-ID copy removed from changed shell surfaces. |
| CAPC-007 / CAPC-023 | Closed for shared foundation | Premium dark shell hierarchy retained; collection and sustained-work layout foundations remain compatible with existing server pagination. |

### New findings

| Finding | Severity | Disposition |
| --- | --- | --- |
| CAPC-W2-001 | P1 | Closed. Admin declared Identity/Security and Catalog links but the renderer silently omitted both groups. Renderer now covers every canonical group. |
| CAPC-W2-002 | P1 | Closed. Raw prefix matching could mark a root and child destination active together. Longest explicit route ownership now yields exactly one `aria-current=page`. |
| CAPC-W2-003 | P1 | Closed. CRM had no shell-level authorized client discovery. The shell now reuses canonical paginated `client-context`, requires 2 characters, debounces, caps results at 8 and opens Client 360 by keyboard. |
| CAPC-W2-004 | P1 | Closed. Admin dashboard linked to a dead system-health route. A safe, read-only destination now projects only aggregate outbox health from the existing Admin dashboard endpoint. |
| CAPC-W2-005 | P2 | Closed. Payment gateways competed under generic integrations. PayPal, Stripe and BofA deep routes are owned by Commerce → Payments & gateways; generic Integrations is explicitly non-payment. |
| CAPC-W2-006 | P2 | Closed. Deep UUID routes leaked machine identifiers into shell context. UUID final segments now resolve to human record-context labels. |
| CAPC-W2-007 | P2 | Closed. Existing integration kill switches used browser `confirm()`. The representative shared pattern now requires a reason and supports warning, pending, error, cancellation and focus restoration. |
| CAPC-W2-008 | P2 | Deferred to Waves 3–5. Several mature domain pages still render raw state values inside their owning content. The central vocabulary exists; domain-by-domain adoption belongs to the owning completion waves. |

## Final information architecture

### Client portal

- Primary: Home; Journey; Credit Center; Cards; Application Rounds; Major Readiness; Services; Support.
- Utilities: Documents; Notifications; Account.
- Credit Center owns Overview/Profile/Report/Analysis/Plan/History; Cards owns Explore/Wishlist/details; Application Rounds owns Round/Strategy/Schedule/Live/Results/Follow-up/Analysis.

### Consultant CRM

- Dashboard and Work Queue remain distinct.
- Primary: Dashboard; Work Queue; Clients; Cards research; Calendar & Live; Support.
- Utility: Account.
- Reviews and Client 360/deep client work are contextually owned by Clients; Catalog Operations and Card Insights share Cards research; sessions share Calendar & Live.
- Top bar adds scoped client search and a canonical urgent Work Queue affordance without a new queue or client registry.

### Admin operations

- Overview.
- Identity & security: Users & staff, Access grants, Security events.
- Commerce: Service products, Payments & gateways.
- Card intelligence: Card catalog, Card insights.
- Automation & AI: AI jobs, AI processes, Workflow rules.
- Communications: Notification operations.
- Integrations: non-payment integrations.
- Data & governance: Source registry, Retention, Audit history.
- Reporting & settings: Reports, Settings.
- Utilities: Scheduled jobs, System health.

## Shared patterns and representative consumers

- Explicit navigation ownership and accessible `aria-current` across desktop sidebar and mobile drawer.
- Persistent page-context strip with parent return target and humanized detail context.
- `RecordContext` for accessible breadcrumbs, record identity, metadata and actions.
- `RecoveryState` maps authentication, authorization, validation, not-found, stale/conflict, unavailable and unexpected errors to truthful recovery.
- `GovernedActionDialog` supports reason policy, consequential warning, pending/error state, Escape/cancel and focus return; Admin non-payment integration enable/disable is the representative consumer.
- Central presentation-only status vocabulary retains canonical API/domain values.
- Existing `DataNavigation` server-backed pagination was preserved; no unbounded client filtering was introduced.

## API/domain impact

No schema, business state, queue or alternate registry was added. CRM search reuses the canonically authorized `/api/v1/consultant/client-context` endpoint. Urgent attention reuses `/api/v1/consultant/work-queue`. System health reuses the safe aggregate `/api/v1/admin/dashboard` projection.

## Browser and accessibility evidence

- Client narrow: Credit Center History and Plan showed a single Credit Center owner and persistent page context; drawer remained available from a labeled button.
- Consultant narrow: real MFA challenge completed successfully; global search for `client` returned only authorized scoped identities and work counts; ArrowDown + Enter opened seeded Jordan Blake Client 360; deep route retained Clients ownership; urgent Work Queue remained available as a labeled badge action.
- Admin narrow: first-time QR MFA enrollment completed and returned to Admin. The drawer exposed every authorized group and destination, including Identity & security and Card intelligence; payment gateways were represented only by Commerce → Payments & gateways; the safe System health route loaded aggregate pending/failed delivery counts without payloads or secrets.
- Desktop behavior is covered by the same responsive shell renderer and route-owner component suite; the available Codex in-app review surface remained narrow-width during this run, so no unsupported claim of a second physical viewport is made.
- Component proofs cover unique nested-route ownership, every Admin group, mobile drawer Escape behavior, account menu focus return, breadcrumbs, typed recovery and governed-action required reason/Escape/confirmation.

## Verification

- Web: 22 files, 96 tests passed.
- Runtime: 1 file, 3 tests passed.
- API: 68 files, 268 tests passed against Credit-only `credit_strategy_wave1` with isolated Redis DB 15.
- Worker: 6 files, 16 tests passed.
- All-workspace typecheck: passed.
- All-workspace ESLint: passed.
- All-workspace production build: passed (existing Vite large-chunk advisory only).
- Root `format:check`: known repository-wide baseline remains red across 340 historical files; changed Wave 2 sources were formatted directly and `git diff --check` passed.
- Exact-final-head CI: pending final report commit/push.

## Remaining boundaries

- Wave 3: complete Client-owned workspace depth and apply shared vocabulary/recovery patterns to its domain screens.
- Wave 4: complete CRM operational workspace richness, including multi-family Work Queue UX.
- Wave 5: complete Admin operational surfaces and migrate remaining domain-specific consequential actions.
- Wave 6: accumulated polish, volume, responsive/accessibility and end-to-end product completion.
