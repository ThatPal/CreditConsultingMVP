# POAR-D — Independent Product Design, Beauty & UX Audit

Date: 2026-09-06  
Branch: `rapid/phase17-18-operations-public`  
Accepted baseline: `271f5f9a0014ec2459b44c1f3a51e04a61c9361e`  
Mode: audit and rebuild planning only; no product code changed

## Recommendation

**BROAD REBUILD REQUIRED BEFORE PRODUCT-OWNER DESIGN ACCEPTANCE.**

The authenticated product is unusually broad and its authority, history, and recovery foundations are materially stronger than its presentation. Most routes are real, populated, and connected to canonical APIs. It is not a shell or a mock. It is nevertheless not yet a premium fintech product: most screens express the same dark page + heading + stacked rounded panels grammar, collections often grow the document instead of becoming usable work surfaces, financial and lifecycle data rarely becomes a visual story, and important cross-screen state is not always composed consistently.

## Method and evidence

- Read POAR-A, POAR-B, POAR-C, and the controlling POAR-D package in full from canonical Drive.
- Reconciled the React route registry and page implementations at the accepted head.
- Audited the running Credit-only product at `http://localhost:5185` using the seeded client lifecycle, including every registered client route and populated Review/Profile/Plan/Cards/Round/Strategy/Scheduling/Live/Major Readiness/Services/Documents/Notifications/Account paths.
- Reconciled Consultant and Admin behavior against the accepted APC Wave 4–6 browser evidence and the current source/API contracts. No prior screenshot was treated as proof where the current source contradicted it.
- Tested the live client experience at a 440×629 narrow viewport as well as the established desktop review viewport.
- Static composition count: 63 page files, 197 `SectionCard` uses, no chart-library/canvas/SVG visualization layer, and no shared motion system. This supports—but did not substitute for—the browser judgment.

## POAR-C disposition matrix

| Finding | Disposition | Independent evidence / refinement |
|---|---|---|
| POAR-C-001 generic composition | CONFIRMED AND EXPANDED | All three roles rely on the same title/panel cadence; even lifecycle and operational screens lack distinct spatial models. |
| POAR-C-002 visual tokens underused | CONFIRMED | Gradients and focus surfaces exist but rarely encode hierarchy or domain meaning. |
| POAR-C-003 stacked-card monoculture | CONFIRMED AND EXPANDED | 197 `SectionCard` instances; Review and Documents become especially long vertical documents. |
| POAR-C-004 no data-visualization layer | CONFIRMED | No chart-library, canvas, or shared SVG visualization layer; scores, utilization, balances and operational health remain numerals/text. |
| POAR-C-005 collections not surface-specific | CONFIRMED | Cards, notifications, documents, jobs and logs reuse generic lists instead of gallery/inbox/table/workbench patterns. |
| POAR-C-006 bounded viewport missing | CONFIRMED AND EXPANDED | Documents reached 4,812px and Notifications 4,369px at 629px viewport height. |
| POAR-C-007 restoration missing | CONFIRMED | Search/filter/page state is URL-backed inconsistently; expanded item and scroll position are not a product contract. |
| POAR-C-008 ease discovery missing | CONFIRMED | Power actions, keyboard help, saved views, previews and bulk operations are not discoverable. |
| POAR-C-009 visual delight discovery missing | CONFIRMED | There is no reusable visual storytelling palette beyond cards, chips and icons. |
| POAR-C-010 motion unchoreographed | CONFIRMED | No shared motion layer; realtime/state transitions generally snap. |
| POAR-C-011 generic async states | PARTIALLY CONFIRMED / REFINED | Recovery components are materially better after APC Wave 2, but many populated-to-empty transitions still collapse to plain text. |
| POAR-C-012 role density too similar | CONFIRMED | Client needs breathing room; CRM needs persistent multi-pane context; Admin needs dense inspectable operations. |
| POAR-C-013 weak financial hierarchy | CONFIRMED | Credit scores, utilization, target credit and payment totals lack scales, trends, comparisons and explanatory anchors. |
| POAR-C-014 icon system incoherent | CONFIRMED | MUI icons decorate navigation but do not form a stable domain language. |
| POAR-C-015 light focus surface underused | CONFIRMED | The component exists and is accessible, but it is not the canonical focal treatment for decisions and progress. |
| POAR-C-J01–J26 | CONFIRMED AND EXPANDED | The journey matrix retains all 26 journeys and adds explicit projection consistency, return-path, and interruption criteria. |

## New independent findings

| ID | Sev | Finding | Evidence | Required outcome |
|---|---:|---|---|---|
| CPOAR-001 | P1 | Round composition contradicts canonical child state. | For seeded Round `5676773c-…`, overview says approved Strategy, scheduling and Live are unavailable and tells the client to wait; the populated Strategy, booked appointment and Live routes work for the same Round. | One server-composed lifecycle projection; impossible contradictory next actions; regression covering overview/deep links. |
| CPOAR-002 | P1 | Route readiness is not an explicit UX contract. | Wishlist and Support produced an empty document during the rapid route sweep while sibling routes rendered shells; whether caused by chunk/load/auth recovery, blank content is an unacceptable failure mode. | Every lazy route must show bounded loading, recovery, and timeout states; never an empty body. |
| CPOAR-003 | P2 | Long client collections are page-length documents. | Documents 4,812px, Notifications 4,369px, Cards 1,855px at 629px viewport; controls scroll away. | Bounded collection region, sticky query controls, virtualized/paginated body, stable selection and return state. |
| CPOAR-004 | P2 | Financial/profile facts are legible but not interpretable at a glance. | Credit Center shows bureau scores, $40,000 limit, $15,200 balance and 38% utilization as equal facts. | Score bands, utilization gauge, bureau comparison, threshold annotations and accessible text equivalents. |
| CPOAR-005 | P2 | Card discovery lacks a real comparison workspace. | Explore has filters and cards but no compare tray, side-by-side terms, persistent shortlist context, or portfolio-fit visualization. | Image-led catalog, compare drawer/table, saved filter state and governed research disclaimers. |
| CPOAR-006 | P2 | Live session does not sufficiently distinguish shared truth from local form state. | Presence, committed state and material-change inputs occupy one vertical card flow. | Split workspace with shared session rail, sequence, local draft/commit status and reconnect banner. |
| CPOAR-007 | P2 | Goal and plan progress use prose where a trajectory is needed. | Journey and Plan report stages/counts but no goal trajectory, time horizon or dependency map. | Accessible milestone map, progress/forecast visualization and explicit blockers. |
| CPOAR-008 | P2 | Operational audit and security views lack relationship visualization. | Admin event surfaces are record lists/details without actor→action→resource correlation or incident timeline. | Correlated timeline, filters, related-object drawer and immutable raw evidence secondary view. |
| CPOAR-009 | P2 | Admin system health lacks a topology/impact model. | Status is expressed as panels and labels; operators cannot scan dependency impact. | Service topology, SLO trend, dependency state, recent incident ribbon, safe actions. |
| CPOAR-010 | P2 | Consultant work context is not persistent enough. | Client 360 links to owning workflows; moving among Review/Plan/Strategy/Support repeatedly reconstructs context. | Persistent client context rail, recent record stack, split-pane deep work, preserved filters/selection. |
| CPOAR-011 | P2 | Lifecycle empty states describe absence but rarely create the next valid object. | Follow-up and Analysis correctly say none exists, but creation/handoff is separated and ownership is unclear. | Role-aware actionable empty states with owner, prerequisite, ETA and safe deep link. |
| CPOAR-012 | P2 | Narrow layouts remain long rather than purposefully mobile. | Client pages avoid horizontal overflow, but 4–8 viewport lengths and repeated shell chrome increase navigation cost. | Mobile summary, sticky primary action, collapsible secondary context, bottom-sheet details. |
| CPOAR-013 | P3 | Technical vocabulary leaks into client commerce. | `BOFA_MERCHANT SANDBOX`, `Terms version legacy`, and `1 service unit(s)` appear in Purchase History. | Human terms first; technical provenance available in an optional details disclosure. |
| CPOAR-014 | P2 | Realtime freshness is not visually standardized. | Live, notifications, Work Queue and health use different or implicit freshness cues. | Shared live/stale/reconnecting language, timestamp treatment and animation with reduced-motion support. |
| CPOAR-015 | P2 | Product-wide keyboard efficiency is incomplete. | Native tab navigation exists, but CRM/Admin lack command palette, shortcut help and stable focus return after drawers/dialogs. | Role-scoped command palette, documented shortcuts and tested focus restoration. |
| CPOAR-016 | P2 | Dense Admin configuration lacks change preview. | Governed actions protect commits, but operators cannot consistently compare effective-before/effective-after configuration. | Typed diff preview, dependency/impact summary, validation and rollback/reference link. |

No P0 safety defect was discovered; therefore POAR-D made no implementation exception.

## Product-level judgment by dimension

### Content and function completeness

The breadth is real and most canonical objects have usable routes. Weakness concentrates in composition: some pages expose data without converting it into decisions; several empty states lack ownership; and CPOAR-001 demonstrates that child records and overview projection can diverge.

### Workflow and journey completeness

Deep links exist for the long Credit Review → Plan → Round → Strategy → Scheduling → Live → Post-Round path. Continuity is weakened by insufficient persistent context, generic return behavior, and incomplete lifecycle composition. Admin and CRM workflows need richer multi-record working memory.

### Visual delight / premium fintech beauty

The product is coherent but restrained to the point of sameness. Dark color is the backdrop, not an art direction. A premium result requires purposeful light focal zones, gradients tied to status, card imagery, score and utilization visuals, lifecycle timelines, comparison charts, depth, and subtle state motion—not indiscriminate ornament.

### Experience enhancement / ease of use

The highest-value enhancements are bounded collections with sticky controls, persistent client/record context, compare trays, preview drawers, autosave and draft status, command/keyboard access, smart defaults, resilient return paths, and consistent live/stale semantics.

## Guardrails for the rebuild

- Never turn advisory data into lender prediction or hide canonical uncertainty.
- Preserve server authorization, step-up, audit, idempotency, immutable history and AI human-approval boundaries.
- Visualization must derive from real domain facts and have an accessible text/table equivalent.
- Motion must communicate change, respect `prefers-reduced-motion`, and never delay action.
- Do not solve volume with taller pages.
