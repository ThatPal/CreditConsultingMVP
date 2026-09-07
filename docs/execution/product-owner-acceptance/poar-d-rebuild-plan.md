# POAR-D — Consolidated Rebuild Plan

This plan is deliberately not an implementation authorization. It orders the approved future correction work by dependency and risk.

## Wave D0 — Truth, measurement and route safety

Close CPOAR-001 and CPOAR-002 first. Define canonical lifecycle projection DTOs, route-ready loading/recovery contracts, UX telemetry without sensitive data, screenshot/interaction baselines and seeded review scenarios. Add contract tests proving overview, navigation, CTA and deep links agree.

Exit: no blank authenticated route; Round/Strategy/Schedule/Live state is consistent; visual baselines cover three roles and narrow view.

## Wave D1 — Shared visual and interaction foundation

Implement the archetypes and primitives in `poar-d-archetype-design-system.md`: typography/spacing/elevation, FocusCanvas, domain glyphs, visualization accessibility, collection shell, drawers/split panes, autosave, sticky actions, freshness and motion.

Exit: design-system showcase and tests prove every primitive in light/dark, keyboard, reduced-motion and narrow states.

## Wave D2 — Client financial understanding

Rebuild Home, Journey, Review, Credit Center, Goals and Plan. Prioritize score/utilization/goal interpretation, lifecycle progress, evidence and the singular next action.

Dependencies: D0–D1. Exit: populated Review → Profile → Plan golden path understood without consultant explanation.

## Wave D3 — Client commerce and application lifecycle

Rebuild Cards/Explore/Wishlist/detail, Services/Checkout/Credits, Cycle/Round, Strategy, Scheduling, Live, Results/Follow-up/Analysis and Major Readiness. Add image-led discovery, comparison, visual sequencing and persistent restrictions.

Dependencies: D0–D2. Treat Live and payment changes as high-risk with immediate CI.

## Wave D4 — Client utilities and continuity

Rebuild Documents, Notifications, Support, Account/Privacy and Security using bounded collections, preview/conversation panes and clear request/device timelines.

Dependencies: D1. Exit: 1,000-item fixtures remain usable; selection/filter/scroll restore across deep links and reauth.

## Wave D5 — Consultant daily-work workbenches

Rebuild Dashboard, Queue, directory, Client 360, Review, Plan, Cards research, Strategy, Calendar/Live, Post-Round, Major Readiness and Support. Introduce persistent client context, saved views, keyboard flow, resizable workspaces and explicit draft/publish state.

Dependencies: D0–D4. Preserve capability/scope enforcement and Wave 1 concurrency/realtime behavior.

## Wave D6 — Admin identity, security and commerce

Rebuild Home, Users, Grants, Audit/Security, Services, Payments and gateway operations. Add risk/expiry visualizations, correlated timelines, money flow, exception queues and typed governed diffs.

Dependencies: D1. High risk: step-up, immutable history, secrets, payment idempotency and original-provider routing.

## Wave D7 — Admin platform operations

Rebuild AI jobs/processes, Sources, Workflow Rules, Notifications, Integrations, Scheduled Jobs, Retention, Reports, Settings/Kill Switches and System Health as real operational/configuration/observability archetypes.

Dependencies: D1, D6. High risk: SSRF, retention safety, kill switches, source integrity, human approval.

## Wave D8 — Cross-product acceptance

Run complete Client/Consultant/Admin golden paths with realistic and high-volume fixtures; desktop, narrow, zoom and keyboard; loading/error/empty/stale/realtime/reconnect; permission revocation and reauth; visual regression; fresh migration and double seeds; exact-head CI. Perform moderated physical product-owner review.

## Traceability

| Findings | Primary wave |
|---|---|
| CPOAR-001–002 | D0 |
| POAR-C-001–015, CPOAR-014–016 | D1 |
| CPOAR-004, 007 | D2 |
| CPOAR-005–006, 011, 013 | D3 |
| CPOAR-003, 012 | D4 |
| CPOAR-010, 015 | D5 |
| CPOAR-008, 016 | D6 |
| CPOAR-009, 016 | D7 |
| POAR-C-J01–J26 and J27–J29 | D8, with owning wave |

## Risk and CI cadence

- Immediate exact-head CI: state projection, auth/session/MFA, Live/realtime, payments, retention, sources, kill switches.
- Focused local iteration then affected gate: composition and collection work.
- Every wave: typecheck, changed-workspace lint/build/tests, accessibility checks and seeded browser proof.
- D8: full accumulated suite, migrations, double system/demo seed and exact-final-head CI.

## Product decisions required before implementation

1. Select the final art-direction reference set (restrained premium vs more expressive luminous fintech) without changing the safety/clarity contract.
2. Approve licensed/owned card-product imagery policy and fallback artwork.
3. Choose whether client score visuals use bureau-specific published ranges only or a normalized explanatory scale; no predictive scoring is permitted.
4. Define operator-configurable saved-view persistence scope (device, user account, or organization).
5. Decide which Admin operational metrics have authoritative historical series today; do not fabricate charts from point-in-time data.

These are bounded decisions; D0 truth and route-safety work can proceed independently once authorized.

## Stop disposition

POAR-D audit and rebuild planning are complete. Broad rebuild, Phase 18, public site, deployment, and merge into `ai-enabled` remain explicitly out of scope.
