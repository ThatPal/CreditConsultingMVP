# POAR-D — Archetype, Visual System & Ease-of-Use Contract

## Art direction

The target is **calm, luminous, evidence-led fintech**: deep ink/navy workspace chrome, selective light focal surfaces, cyan-to-violet signal gradients, warm risk accents, editorial typography, real card/product imagery, and data visuals that explain rather than decorate. Dark theme remains a foundation, not the entire identity.

## Screen archetypes

| Archetype | Roles / examples | Spatial contract | Signature visual |
|---|---|---|---|
| Guided decision | Client Home, Review, Goal, Major Check | one focal decision, supporting evidence, sticky next action | luminous focus surface + progress arc |
| Financial dashboard | Credit Center, Cards, Services | metric hero, comparison/trend, explanatory list | score band, utilization ring, balance/limit bar |
| Lifecycle timeline | Journey, Round, Major Readiness, Post-Round | current stage, completed history, future prerequisites | horizontal desktop / vertical mobile timeline |
| Research gallery | Card Explore/Wishlist, consultant catalog | visual cards, sticky filters, compare tray | issuer/card imagery + terms comparison |
| Client workbench | Client 360, Review, Plan, Strategy | persistent context rail + resizable work panes + action rail | stable dossier header and live save state |
| Live command workspace | Live Session, Calendar/appointment | agenda/presence rail + shared truth + local inputs | realtime pulse, reconnect/freshness state |
| Operations grid | Users, grants, payments, jobs, events | sticky query bar, dense virtual grid, preview drawer | sortable table with status/risk glyphs |
| Configuration studio | Rules, settings, sources, integrations, retention | typed editor + validation + effective diff + impact | before/after diff and dependency map |
| Observability cockpit | Admin home, System Health, AI/notification ops | topology, SLO/trend, exception queue | service graph + incident timeline |
| Conversation workspace | Support | bounded case list + conversation + context/actions | split view with SLA and ownership rail |

## Visual primitives

- `MetricHero`: value, unit, as-of time, comparison, confidence/source and accessible explanation.
- `ScoreBand`: bureau score on named scale; never imply approval probability.
- `UtilizationGauge`: balance/limit, threshold bands and exact text.
- `LifecycleRail`: canonical stages, blockers, owner and deep links.
- `ComparisonMatrix`: sticky labels, differences emphasized, keyboard navigable.
- `EventTimeline`: actor, action, target, time, correlation and immutable evidence link.
- `DependencyMap`: system/provider nodes with accessible list fallback.
- `MoneyFlow`: authorization/capture/refund/dispute/reconciliation chronology.
- `DomainGlyph`: stable icons for Review, Plan, Card, Round, Strategy, Appointment, Live, Major, Support and Security.
- `FocusCanvas`: accessible light surface reserved for the primary decision, not every card.

## Depth, color, imagery and motion

- Use gradients to show focal priority or lifecycle movement, never as arbitrary panel fill.
- Use three elevation bands: chrome, workspace, focal overlay. Eliminate nested equal-radius panel stacks.
- Card products receive governed image assets with graceful issuer/product fallback art.
- Use illustration sparingly for onboarding/empty success moments; operational screens favor data.
- Motion durations: 120–180ms local feedback, 200–280ms pane transitions, subtle realtime pulse. No layout-blocking animation.
- Animate only state change, continuity, or spatial origin. Honor reduced motion and announce semantic changes.

## Collection contracts

| Collection | Pattern |
|---|---|
| Client notifications | bounded virtual inbox + detail pane; sticky category/unread controls |
| Client documents | table/gallery toggle + preview drawer; sticky upload/search/type |
| Client cards | visual gallery and wallet; compare tray; preserved wishlist/search |
| CRM queue/reviews/clients | virtual grid + saved views + keyboard row navigation + preview pane |
| CRM support | three-pane cases/conversation/context; stable selection and SLA filters |
| Admin users/events/payments/jobs | dense server-paged grid; column controls; related-record drawer |
| Admin configuration histories | version timeline + effective diff, not repeated full cards |

Every collection must define maximum viewport use, sticky elements, server paging/cursor, deterministic order, selection model, URL state, restoration, empty/loading/error/stale states and narrow-screen transformation.

## Shared interaction contracts

- Autosave shows `Saving`, `Saved at`, conflict, offline and retry; publish remains explicit.
- Sticky action bars summarize unsaved state and disappear when irrelevant.
- Drawers preserve the collection behind them and restore focus to the invoking row.
- Split panes remember user sizing within safe bounds; narrow view becomes ordered sheets/routes.
- Command palette is role-scoped and capability-filtered; shortcuts never bypass governance.
- Governed actions always show effective change, impact, authority/step-up reason and audit result.
- Smart defaults are explainable, reversible, server-validated and never infer lender eligibility.
- Live state uses one vocabulary: `Live`, `Reconnecting`, `Stale as of …`, `Restored`; color is never the only cue.

## Accessibility and responsive contract

- WCAG 2.2 AA contrast, visible single focus indicator, 44px primary targets on touch.
- Every visualization has title, units, accessible description and equivalent data table/text.
- Logical heading order and landmarks; skip links to navigation, context and workspace.
- Keyboard traversal follows visible pane order; dialogs/drawers trap and restore focus.
- At narrow width: retain current object and primary action; collapse secondary context; never force horizontal page scrolling.
- At 200% zoom: no action loss or overlapping sticky regions.

## Role differentiation

- Client: spacious, reassuring, one primary next action, plain language, visual progress.
- Consultant: dense, context-preserving, multi-pane, keyboard-efficient, draft/publish separation.
- Admin: densest, evidence-forward, inspectable diffs, impact preview and immutable histories.
