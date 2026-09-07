# POAR-G — Copy Rebuild Recommendations for D0–D8

This document embeds content UX into the approved POAR-E waves. It is not authorization to begin implementation.

## D0 — Truth, measurement and route safety

- Add typed lifecycle-to-language projections for current stage, owner, blocker, action and consequence.
- Eliminate CPOAR-COPY-001/003 before visual rebuild work.
- Define shell-level loading/timeout/error/permission/reauth copy and test that no route renders an empty document.
- Inventory current strings by route/state and add content snapshot fixtures using canonical data, not brittle whole-page snapshots.

Acceptance: Round overview and every child/notification/queue agree; every authenticated route always names location and recovery.

## D1 — Shared visual, interaction and content foundation

- Implement the terminology, role voice, status, freshness, recovery, quantity/financial, draft/published/advisory and governed-action patterns from `poar-g-content-design-system.md` alongside POAR-D primitives.
- Content is an API of shared components: required fields prevent status chips/dialogs/errors from omitting consequence or action.
- Add lint/static checks for prohibited client enum/code leakage, generic isolated CTAs, `unit(s)`, raw IDs as headings, and unlabeled AI output.

Acceptance: design-system examples prove client/consultant/admin variants, narrow disclosure and screen-reader announcements.

## D2 — Client financial understanding

- Home/Journey: one authoritative “what matters now” sentence and owner.
- Review/Credit Center: meaning → consultant judgment → source/as-of → Plan action.
- Goal/Plan: stable goal formatter; exact blocker/completion/handoff copy.
- Pair every financial visualization with non-predictive explanatory text.

Acceptance: a client can explain current Profile, current Plan action, owner and next state without external help.

## D3 — Client commerce and application lifecycle

- Separate portfolio/catalog/Wishlist/approved Strategy language.
- Humanize service/payment/credit/provider states.
- Use one Round stage vocabulary through Strategy, Scheduling, Live and Post-Round.
- Define concise Live release/result/reconnect copy and Major coordination restrictions.

Acceptance: no approval implication, technical commerce leak, contradictory lifecycle projection or ambiguous Live ownership.

## D4 — Client utilities and continuity

- Documents: requirement, source, validation/use, deletion consequence.
- Notifications: change/meaning/action structure.
- Support: attached-context, visibility, owner and next expectation.
- Account/privacy/security: request/session lifecycle and reauth return path.

Acceptance: productive empty/error/success states and state restoration across 1,000-item fixtures and reauth.

## D5 — Consultant workbenches

- Persistent client/job orientation on every deep route.
- Work Queue reason/urgency/owner/action grammar.
- Persistent draft save, client visibility, source version and publish state.
- Approval/finalization copy names client-visible and downstream consequences.
- Support retains permanent Reply/Internal/AI draft distinctions.

Acceptance: consultant never needs route memory to know client, object, state, owner, unsaved/publication status or next action.

## D6 — Admin identity, security and commerce

- Effective access summaries; revoke/session/step-up consequences.
- Human audit/security event summaries with technical evidence secondary.
- Payment/refund/dispute/reconciliation copy names amount, provider route, entitlement effect, idempotent result.
- Gateway/service changes distinguish configured/effective/new/in-flight work.

Acceptance: operator can state blast radius and reversal before confirmation; result names audit evidence.

## D7 — Admin platform operations

- AI/source/rule/job copy distinguishes configured, queued, running, failed, AI-produced, reviewed and effective.
- Retention preview/execution names scope, exclusions, irreversibility and audit preservation.
- Settings/kill switches name new vs in-flight behavior and restoration.
- Health/report metrics name timeframe, source, last checked and user impact.

Acceptance: no vague `Run/Enable/Disable` action without object/effect; no invented historical meaning.

## D8 — Cross-product content acceptance

- Reconcile every POAR-F and CPOAR-COPY finding against actual populated UI.
- Run all 29 journey handoffs across roles and interruption states.
- Review desktop, narrow, 200% zoom, keyboard/screen reader announcements and reduced-motion states for content priority.
- Product-owner physical read-through: no external explanation permitted.

## Shared versus domain-specific ownership

| Central/shared | Domain/screen-specific |
|---|---|
| glossary and display formatters | page purpose and why-now |
| status/freshness/quantity/money grammar | meaning of domain facts |
| recovery and reauth skeletons | exact safe alternate path |
| draft/published/advisory labels | approval/publication consequence |
| governed-action required fields | blast radius and in-flight behavior |
| notification structure | subject, meaning and destination |
| role voice and casing rules | helper/why-we-ask text |

## Tests and static checks

- Contract tests: canonical lifecycle state produces identical overview, nav, notification and queue language keys.
- Component tests: errors state unchanged data and recovery; dialogs include effect/scope/reversibility; success includes next owner.
- Prohibited-string checks in client bundles/UI fixtures for raw enums, UUID-first labels, `SANDBOX`, `unit(s)`, event codes and internal AI terms.
- Terminology tests for qualified `Review`, `Round`, `Strategy`, and Major application coordination.
- Plural/financial/date/timezone formatter tests.
- Browser tests for blank/loading/error/stale/reconnecting/reauth/revocation at desktop and narrow width.
- Accessibility tests for status announcements, helper association, expanded details and destructive confirmation focus.
- Content QA fixtures for long names, zero/one/many, unknown source/model, stale data, partial failure and no-action waiting.

## Dependency changes to the final plan

Content projection joins engineering truth in D0; the reusable content system ships with D1; domain copy is authored and tested inside D2–D7; D8 is validation rather than a late rewrite. Visual components may not be marked complete with placeholder/generic copy, and copy may not claim a state the canonical projection cannot prove.

## Stop disposition

POAR-G is complete. D0/D1, broad implementation, Phase 18, public/deployment work and merge into `ai-enabled` remain unstarted.
