# POAR Rebuild D1 — Shared Visual, Interaction & Content Foundation

## Boundary and authority

- Branch: `rebuild/authenticated-product-poar`
- Accepted D0 branch point: `830b3ef96375e338ffbc7a299dc2484f057b523b`
- Governing sources: POAR-A–G, POAR-E, retained POAR-D/G repository reports, accepted D0 report, and the D1 Drive implementation package.
- Scope: shared D1 system plus representative proofs only. This report does not claim D2–D7 domain completion.
- Excluded: D2, Phase 18, public-site/deployment work, and merge into `ai-enabled`.

## Shared expressive-fintech grammar

D1 establishes deep-ink chrome, role accents (Client cyan, Consultant teal, Admin violet), selective ambient signal gradients, warm semantic risk accents, and three explicit elevation bands: chrome, workspace and focal overlay. Role density/content-width tokens distinguish comfortable Client guidance from compact CRM and dense Admin operations. The `ArchetypeCanvas` contract supports all ten approved screen archetypes without making `SectionCard` the major-screen architecture.

The stable domain glyph registry covers Review, Profile, Plan, Card, Round, Strategy, Appointment, Live, Major coordination, Support, Payment, Security, AI and System Health. Motion timing remains 120–180ms local and 200–280ms spatial, with the global reduced-motion contract preserved.

## Accessible visualization layer

Reusable primitives now include:

- `MetricHero`;
- `ScoreBand`;
- `UtilizationGauge`;
- `LifecycleRail`;
- `ComparisonMatrix` with a semantic table;
- `EventTimeline`;
- `DependencyMap`;
- `MoneyFlow`;
- `Sparkline`, restricted to supplied historical series;
- `ProgressArc`;
- owner/status/freshness signals.

Each accepts explicit source/as-of context where relevant and provides an accessible text equivalent. No trend, approval likelihood, score or business outcome is invented.

## Collection and ease-of-use contracts

`CollectionSurface` requires an explicit mode: bounded, grid, inbox/detail, gallery/compare, load-more, conversation, history or split-pane. Desktop collections can use a bounded scroll region with sticky controls/footer so pagination remains reachable; narrow layouts return to document flow. It preserves collection scroll, exposes busy/empty semantics and supports keyboard next/previous row movement.

Additional foundations include:

- sticky primary-action and capability-safe bulk-action bars;
- focus-restoring responsive detail drawer/bottom sheet;
- autosave status that keeps publication explicit;
- split workspaces with named primary/detail regions;
- session-bounded view-state restoration;
- role-scoped command palette and shortcut-help contracts;
- compare tray;
- existing governed drag/drop upload retained for owning waves.

These are governed foundations. D2–D7 decide which owning screens justify each interaction.

## Content Design System in code

D1 centralizes product terminology, human state display, quantity/pluralization, currency/date/time, freshness, UUID/provider-safe Client labels, and specific-action validation. Shared grammar components implement:

- page purpose / why-now;
- current state, meaning, owner and freshness;
- waiting/blocker responsibility;
- productive empty, exact success and protected recovery states;
- draft/advisory/published/reported/system-calculated labeling;
- provenance disclosure;
- complete governed-action content validation.

Representative generic CTAs were replaced with object/effect-specific labels. Static unit proofs reject isolated `Open`, safely suppress UUID-first labels, and verify required governed-action fields.

## Representative real-app proofs

### Client

- Client Home current focus now uses the guided-decision composition with one specific next action, owner and evidence-backed freshness.
- `/app/cards` uses real seeded portfolio facts in the financial-dashboard composition: open-card balance, total limits and an accessible utilization gauge.
- The portfolio demonstrates the bounded gallery collection at desktop and document-flow transformation at narrow width.

### Consultant

- `/crm` demonstrates the compact Client Workbench archetype, real canonical Work Queue metric, source ownership, last-confirmed/stale state, and a specific Work Queue action.
- The three prior generic `Open` links now name their objects and effects.

### Admin

- `/admin/reports` demonstrates the dense Operations Grid archetype, canonical aggregate metric, last-confirmed/stale state and bounded report-group collections.
- Existing governed dialogs remain the representative consequence/step-up/audit pattern while the new content schema defines every required field for later owning-wave adoption.

## Route-family performance — CPOAR-D0-004

The D0 production baseline emitted one 1,152.01 kB / 332.66 kB gzip entry bundle. D1 moves Admin domain families behind the accepted shell `Suspense`/render recovery boundary. The resulting build emits Admin family chunks independently and an 869.90 kB / 250.16 kB entry plus a 231.74 kB / 73.31 kB shared chunk. The initial dependency graph is reduced modestly while approximately 61 kB of Admin-only domain code is deferred until an Admin route requests it.

This is intentionally a bounded family split: it avoids a high-risk all-role routing rewrite and excessive micro-chunk waterfalls. No web-vitals claim is made. A focused rejected-lazy-family test proves that chunk failure still produces the D0 named recovery, retry and safe-home contract rather than a blank document.

## Accessibility and responsive evidence

- Visual state always has text; color is not the only signal.
- Comparison uses table semantics; lifecycle uses ordered steps and `aria-current`.
- Freshness changes use polite announcements; realtime pulse is disabled by reduced-motion preference.
- Drawers use MUI focus trap and restore the invoking control; narrow view uses a bottom sheet.
- Collection keyboard order follows visible order and arrow navigation moves between marked rows.
- New layouts use single-column narrow transforms, `minWidth: 0`, bounded internal desktop overflow and no fixed page width.
- Existing single-focus-ring and 44px interactive-target foundations remain in force.

## Independent D1 findings

| Finding | Severity | Disposition |
| --- | --- | --- |
| `CPOAR-D1-001` HTTP polling was initially presented as realtime `Live/Reconnecting` | P1 truth/content | Closed. Polling surfaces now show confirmed/stale timestamps; realtime language is reserved for realtime state. |
| `CPOAR-D1-002` Client current focus could fall back to the browser clock when no authoritative timestamp existed | P1 truth | Closed. Freshness is omitted rather than fabricated when no canonical timestamp exists. |
| `CPOAR-D1-003` A broad per-screen lazy split would create route waterfalls and expand recovery risk | P2 performance | Resolved by bounded Admin domain-family splitting behind D0 recovery; later waves may split other large families based on measured ownership. |
| `CPOAR-D1-004` Collection scroll restoration can be unavailable in privacy-restricted storage contexts | P2 resilience | Closed. Storage is optional and failure-safe; canonical workflow state remains server-owned. |

No open D1 P0/P1 or material shared-foundation P2 remains. Domain-specific POAR findings remain assigned to D2–D7.

## Verification

- D1 visual/content/collection/ease/route focused tests: 33 passed.
- Full Web suite: 112 passed.
- Runtime suite: 3 passed.
- API suite: 278 passed.
- Worker suite: 16 passed.
- Shared package intentionally has no test files.
- Total accumulated tests: 409 passed.
- Repository lint: passed.
- Full workspace typecheck: passed.
- Production build and bundle characterization: passed.
- Exact-final-head GitHub CI: required on the synchronized final D1 commit; immutable result supplied at handoff.

## Recommendation

`D1 COMPLETE — READY FOR PRODUCT-OWNER REVIEW`

D2 has not started.
