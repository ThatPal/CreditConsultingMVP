# POAR Rebuild D0 — Truth, Measurement & Route Safety

## Boundary

- Branch: `rapid/phase17-18-operations-public`
- Accepted starting head: `4e7ecb0a38a79e84ebfa9f0ffc4d7a289f100ee4`
- Scope: D0 only. No D1 visual/content redesign, Phase 18, public-site, deployment, or `ai-enabled` merge work is included.
- Governing context: updated POAR-E and D0 package, POAR-A through POAR-G, and the retained POAR-D/G repository reports.

## Delivered truth contract

The Round endpoint now composes one lifecycle projection from the authoritative Review/Profile, preparation Plan, Major application check and restrictions, approved Strategy, appointment, Live session, follow-up, approved analysis, and finalization records. It does not infer downstream truth from the parent Round status alone.

The projection exposes a stable content contract:

- current state and plain-language meaning;
- accountable owner and whether the client must act now;
- blocker and one canonical next action, or a truthful waiting sentence;
- freshness timestamp;
- Strategy, appointment, Live, follow-up, analysis and finalization summaries;
- compatible stage states and destinations across Overview → Strategy → Scheduling → Live → Follow-up → Analysis.

Finalized history wins over subsequently stale prerequisites, active Major coordination restrictions fail closed, and a prepared Round waiting on a consultant does not fabricate a client action.

## Route-ready and recovery contract

Every authenticated Client, CRM and Admin outlet is wrapped by the shared route boundary. Route loading immediately supplies a named, announced state; slow loading explains that no state changed and offers a safe home; render failure supplies retry and safe-home recovery instead of a blank document. Failure evidence is deliberately bounded to route family and error name—never URL/query data, props, response bodies, headers, or credentials.

The Card detail missing-response path and Client Home journey-error path were also corrected so they cannot collapse to a blank document. Client Home no longer displays three equal generic `Open` actions while lifecycle truth is unavailable.

## Deterministic review scenarios

The following semantic states are the stable review baseline. Tests construct them from fixed timestamps and stable Round keys; the application endpoint resolves the equivalent persisted records by canonical relationships rather than fragile display text.

| Scenario | Expected owner / action | Required evidence |
| --- | --- | --- |
| Prepared, no Strategy | Consultant / no client action | Explicit waiting sentence |
| Approved Strategy | Client / Review approved Strategy | Strategy complete; Scheduling available |
| Booked appointment | Client / Review scheduled session | Scheduling complete; Live available |
| Active Live session | Client / Return to live session | Live active regardless of parent Round status |
| Completed Live, follow-up outstanding | Client / Complete Round follow-up | Follow-up active |
| Completed Live, analysis pending | Consultant / no client action | Explicit analysis waiting state |
| Approved analysis | Client / Review Round Analysis | Analysis complete |
| Active Major restriction | Consultant / Major coordination context | Downstream activity remains restricted |
| Finalized Round | None / View Journey | Historical completion remains authoritative |

Screenshot comparisons must use the same role, semantic scenario, viewport, route and populated-data precondition. Loading, error, waiting, blocked, action-ready and finalized copy states are separate baselines and must not be compared as if interchangeable. D0 captures behavioral truth and safe measurement; visual redesign begins in D1.

## Finding dispositions

| Finding | D0 disposition | Evidence |
| --- | --- | --- |
| CPOAR-001 | Closed | Round Overview now derives downstream state from canonical child records and exposes compatible stage destinations. |
| CPOAR-002 | Closed | Shared authenticated route loading, slow-load and render-failure recovery prevents blank route documents. |
| CPOAR-COPY-001 | Closed | Lifecycle projection supplies state meaning, owner, blocker, must-act flag, one next action or waiting copy, and freshness. |
| CPOAR-COPY-003 | Closed | Waiting and blocked states now identify the responsible party and avoid invented client actions. |
| CPOAR-COPY-002 | Foundation established | Typed lifecycle vocabulary and stable action labels are centralized for D1 adoption across remaining surfaces. |

### New adjacent findings

- `CPOAR-D0-001` — Confirmed and closed: Client Home showed three equally weighted generic `Open` shortcuts whenever journey truth was still loading or failed. The fallback is removed and failure now gives a truthful retry.
- `CPOAR-D0-002` — Confirmed and closed: the Card detail route returned `null` if a successful query produced no body, creating a blank authenticated document outside ordinary error handling. It now renders shared recovery.
- `CPOAR-D0-003` — Confirmed and closed: finalized Round history could be visually displaced by a newly stale prerequisite. Finalization now has projection priority.
- `CPOAR-D0-004` — Recorded for D1, non-blocking: the production bundle warning identifies a large eager route bundle. Authenticated production routes are currently eager (only development showcases are lazy), so D0 adds route safety without introducing a risky broad code-splitting rewrite. D1 may split route families behind the new boundary and measure the result.

No additional P0 or P1 truth, route-safety, or credential exposure was found in the adjacent D0 inspection.

## Verification

- Lifecycle projection focused tests: 4 passed.
- Route-ready boundary and affected Round UI tests: 5 passed.
- Client shell loading-state characterization: updated to reject equal generic `Open` actions and require an explicit progress state.
- API typecheck: passed.
- Web typecheck: passed.
- Repository lint: passed.
- API production build: passed.
- Web production build: passed (existing bundle-size advisory retained as `CPOAR-D0-004`).
- Fresh isolated Credit-only database: all 66 migrations applied; system seed passed twice.
- Complete accumulated suite on that database: Web 104, Runtime 3, API 278 and Worker 16 tests passed (401 total; Shared intentionally has no test files).
- First exact-head CI (`aa88ffefdc94983ee28f59c90578f346495bd228`) correctly exposed one stale Client Home characterization expecting the removed generic actions. The characterization was corrected to require an explicit loading state and reject generic `Open` links; the complete local gate then passed.
- Exact-final-head GitHub CI: required on the synchronized final commit; the immutable run result is reported at handoff.

## Completion recommendation

`D0 COMPLETE — READY FOR PRODUCT-OWNER REVIEW`

D1 has not started.
