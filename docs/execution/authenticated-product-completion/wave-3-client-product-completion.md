# APC Wave 3 — Client Product Completion

## Boundary

- Accepted base: `3c3a1601a4a455fcfe6f85125ce36d044a83c221`
- Implementation: `085d1f7` (`feat(apc): complete client product workflows`)
- Branch: `rapid/phase17-18-operations-public`
- Scope stopped at Wave 3. Wave 4, Phase 18, public/deployment work, and `ai-enabled` integration were not started.

## Independent re-audit and findings

| Finding | Severity | Disposition and evidence |
| --- | --- | --- |
| APC-008 | P2 | Closed. Each Plan item now owns its typed evidence input; completing or asking for help on one item cannot leak another item's value. Current Focus and path progress precede the dependency-ordered guidance/actions/milestones. |
| APC-012 / APC-051 | P2/P1 | Closed for the client surface. The published-only Credit Center hierarchy remains intact and now links Review, Profile, Report, Analysis, Plan, History, and contextual help without exposing draft/AI workspace data. Wave 1's real submitted Review fixture remains preserved. |
| APC-013 | P2 | Closed for current-state continuity. Home/Journey and Round use the same authoritative goal/profile/plan/cycle state and link to owning workflows without inventing future progress. |
| APC-014 / CAPC-005 / CAPC-019 | P1/P2 | Closed. Explore exposes server-owned audience/portfolio facets, keeps stale-offer suppression and research-only Wishlist semantics, and card detail uses a canonical ID-scoped endpoint rather than searching a bounded collection response. |
| APC-029 | P2 | Closed. The Round hub presents preparation, major check, approved Strategy, scheduling, live/results, and follow-up with truthful available/locked state plus one authoritative next action. |
| APC-030 | P2 | Closed. Approved Strategy retains client-safe ordered reasons, explains conditional/ordered execution, and hands off to scheduling while preserving separate live release authority. |
| APC-043 | P2 | Closed with an honest governed foundation. Account starts a prefilled, tracked Data & Privacy request through canonical Support and explicitly avoids instant-export/deletion promises. |
| APC-044 | P2 | Closed. Notification history retains unread/read grouping, deep links, recovery and paging and adds Documents and Security categories to All/Unread/Support. |
| CAPC-001 | P1 | Preserved as a non-Wave-3 live-execution dependency. No issuer URL or provider capability was invented; Strategy routes only to the canonical scheduling/live boundary. |
| CAPC-003 | P1 | Not broadened into consultant authoring in this client-only wave. Client Plan execution no longer has the shared-input data-integrity defect. |
| CAPC-W3-001 | P1 | Newly found and closed. Prisma decimals serialized as strings caused portfolio totals to concatenate (`$2,200,018,000`). Values are normalized before totals/utilization; browser proof is `$40,000`, `$5,200`, `13.0%`. |
| CAPC-W3-002 | P2 | Newly found and closed. The demo fixture left Cards/Wishlist empty despite mature catalog/review data. The idempotent demo seed now supplies open/closed personal/business cards and one research-only Wishlist preference. |
| CAPC-W3-003 | P2 | Newly found and closed. Round copy still claimed Strategy through follow-up were absent future phases. It now reflects completed platform capabilities and canonical route availability. |

## Product completion delivered

- Credit Center: published-only Overview/Profile/Report/Analysis/History plus direct Plan and contextual Review Support.
- Plan/Nurture: current focus, progress, stale warning, human status vocabulary, prerequisite explanations, per-item typed evidence, help and verification states.
- Cards: realistic portfolio, accurate financial totals, Explore search/facets, stale offer warnings, governed ID detail, offer history and preference-only Wishlist.
- Round/Strategy/scheduling: complete lifecycle map, authoritative next action, ordered approved guidance and scheduling handoff.
- Major Readiness: shared recovery/status vocabulary, approved/pending separation, preparation/coordination/timeline views and case-bound Support entry.
- Journey/Home: authoritative seeded goal/profile/Plan/current-cycle continuity.
- Notifications: readable category filters, grouped history, paging, safe deep links and retry behavior.
- Account/Data & Privacy: honest request-and-track workflow through canonical Support.
- Contextual Support: prefilled, bounded context can open the existing governed case workflow; no separate support authority was introduced.

## Verification

- Browser, desktop/narrow in-app viewport: client Home, Credit Center/Review, Plan, Cards/Explore/detail/Wishlist, Application Round, Notifications, Account/Data & Privacy and Major Readiness rendered with the seeded client session.
- Real browser Round proof: created/resumed the seeded Fall 2026 cycle and opened its paid Round; the hub showed consumed entitlement, current Profile, dependency-locked Plan, full lifecycle and canonical next action.
- Real browser portfolio proof: 2 open + 1 closed cards; `$40,000` total limit; `$5,200` balance; `13.0%` utilization.
- Focused web: `ClientProductCompletion` 4/4; `Phase11Pages` 3/3; `NotificationsPage` 2/2; `StrategyPages` 2/2; `PublishedCreditCenterPages` 2/2; `SupportPages` 8/8.
- Focused API: `cards/catalog.integration` 3/3.
- Complete web: 23 files / 100 tests passed.
- Complete API: 68 files / 269 tests; one BullMQ test timed out against the shared Redis database after a retained queue consumer, then passed 9/9 using isolated Redis database `/7`. This is test-environment queue contention, not a product failure; exact-head CI supplies an isolated runner.
- System/reference + demo seed: passed twice against `credit_strategy_phase1316_checkpoint`, preserving stable IDs/counts and adding the realistic portfolio/Wishlist fixture.
- Typecheck: passed all workspaces.
- Lint: passed.
- Build: passed all workspaces; Vite emitted the existing non-blocking bundle-size advisory.

## CI and handoff

- Exact final head: recorded after this report commit.
- Exact-head CI: recorded after the pushed workflow completes.
- Review environment: `http://localhost:5185`
- Client: `client@credit.local` / established temporary development password.
- Credit-only database: `credit_strategy_phase1316_checkpoint` on the existing review Postgres service.

No P0 blocker was found. No schema migration, authority expansion, payment/entitlement mutation, issuer capability invention, or Support authority expansion was introduced.
