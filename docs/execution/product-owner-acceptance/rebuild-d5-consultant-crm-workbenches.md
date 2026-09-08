# POAR Rebuild D5 — Consultant CRM Workbenches

## Boundary

- Branch: `rebuild/authenticated-product-poar`
- Accepted start: `7a554aae9f789221b8a21ad06cea49f0a8692619`
- Implementation boundary: `0600bc2`
- Scope: Consultant Dashboard, Work Queue, Clients/Client 360, Review, Plan, Strategy, Calendar/Live, Post-Round, Major Readiness, Support, Cards Research, and cross-workbench continuity.
- Guardrails: Consultant scope and capability checks remain canonical; Admin catalog authority is not exposed; client-visible publication remains a governed server command; AI remains draft/advisory; immutable results and histories are not edited; optimistic-version and realtime recovery contracts remain intact.

## Independent findings and dispositions

| Finding | Severity | Audit evidence | Disposition |
| --- | --- | --- | --- |
| CPOAR-D5-001 | P1 | Client identity and lifecycle orientation disappeared when a consultant left Client 360 for a client-specific Review, Plan, Strategy, Cards, Round or Major workbench. | Closed centrally in the Consultant shell with an authority-scoped persistent client rail. It presents identity, relationship status, active-work count, and seven-domain/workbench navigation on every `/crm/clients/:clientId/**` route. |
| CPOAR-D5-002 | P1 | Work Queue used normal document flow, so filters and pagination could leave the viewport during a sustained high-volume session. Rows did not participate in the D1 keyboard collection contract. | Closed with a bounded inbox/detail collection, sticky collection heading/footer, preserved URL filters/page, restored collection scroll, and Arrow Up/Down focus traversal. |
| CPOAR-D5-003 | P2 | The 25-client deterministic directory used the document as its scrolling container and lacked keyboard row traversal. | Closed with a bounded desktop directory, sticky result/pagination frame, URL-restorable server search/filter/sort/page, keyboard rows, and normal-flow narrow behavior. |
| CPOAR-D5-004 | P1 | Plan Builder remained one long stack of editable cards even though canonical Plan structure, authoring, rationale, preview and publication state were distinct jobs. | Closed with a responsive three-zone workbench: structure/dependency orientation, central typed authoring, and sticky context/client-safe preview. Draft versus published visibility and consultant-only rationale are explicit. |
| CPOAR-D5-005 | P2 | The shell’s existing authorized client search and urgent-work affordance did not carry visible client context into downstream workbenches. | Closed by composing the new client rail with the existing authorized global search and urgent Work Queue controls; the rail is loaded through the same scoped Client Context endpoint and fails closed when access changes. |
| CPOAR-D5-006 | P2 | A server-backed personal Saved View primitive does not exist in the current canonical model. Implementing device-local “saved views” would contradict PD-4. | Refined: URL-backed filters, pagination and D1 ephemeral scroll restoration provide safe continuity. A canonical Saved View domain remains a separately governed enhancement; D5 does not mislabel local state as a saved view. |
| CPOAR-D5-007 | P2 | Deep Review, Strategy, Live, Support, Post-Round, Major Readiness and Cards workbenches already carried substantial Wave 4/Wave 6 domain behavior; rebuilding their command logic in D5 risked duplicating or weakening authority. | Reconciled and preserved. D5 applies the new shell/collection/Plan composition centrally and retains those accepted domain commands, typed conflicts, immutable histories, AI boundaries and publication rules. |

No new P0 security, authorization, financial, publication or immutable-history defect was found.

## Workbench acceptance matrix

| Surface | Professional job and composition | Daily-work continuity | Authority / state truth |
| --- | --- | --- | --- |
| Dashboard | Luminous consultant Metric Hero and factual workload metrics answer what needs attention and route to the owning queue. | Global client search, urgent-work affordance and direct Work Queue/Review/Support entry remain always available. | Metrics remain scoped by active assignment/grant; Work Queue is explicitly named as the authoritative action source. |
| Work Queue | Bounded Operations Grid/inbox surface with work-family, assignment, priority, lifecycle and search controls. Each item states object, client, why now, owner and needed-since time. | URL-restored filters/page, scroll restoration, keyboard next/previous focus, highest-priority entry and canonical claim/open commands. | Claim uses expected version. Search remains composed with source authorization. Conflicts require refresh instead of overwriting. |
| Clients / Client 360 | Bounded directory leads to seven-domain Client 360 with overview, journey, Credit Center, Cards, Services, Timeline and Support. | Search/filter/sort/page stay in the URL; the new shell rail persists the selected client through every client-specific workbench. | Directory/detail queries enforce `client.read` and client scope; unavailable context fails closed. |
| Credit Review | Existing three-zone Source / professional Review / Attention-AI workspace with typed financial controls, provenance, validation and preview/publication. | Persistent client rail now prevents identity/context loss; accepted open-next Review behavior and draft recovery remain. | Reported, client-updated, consultant-interpreted and calculated facts stay distinct; AI cannot publish. |
| Plan Builder | Three-zone structure / typed item authoring / client-preview workspace. | Canonical saved draft hydration, structure overview, sticky preview at desktop, intentional single-column sequence at narrow width. | Optimistic update and approval commands remain server-owned; draft is not client-visible; recent MFA remains required for approval. |
| Strategy | Existing staged Context → Candidates → Compare → Sequence/Rules → Validation → Approval flow. | Governed search, comparison and shortlist state remain inside the owning Strategy; persistent client rail provides safe domain switching. | Wishlist remains preference only; approval is consultant output; no approval probability or issuer URL is invented. |
| Calendar / Live | Existing calendar/availability and three-zone live command surface provide date/appointment context, sequence, command, client presence/help and realtime status. | Calendar-to-appointment-to-Live links and Live Help-to-Work Queue handoff remain canonical. | “Live” is shown only for connected transport; reconnect restores committed server truth and one-card release integrity. |
| Post-Round | Existing Summary → Follow-Up → Analysis → Finalize surfaces preserve results separately from interpretation. | Populated lifecycle fixture connects historical results, follow-up versions, final analysis and explicit finalization. | Application results remain immutable; per-item follow-up drafts and analysis versions remain isolated and auditable. |
| Major Readiness | Existing assessment/reassessment workspace distinguishes draft, approved and coordinated restrictions. | Persistent client rail retains Goal/Profile/Plan/Round context while moving across affected domains. | Draft work cannot leak to the client; CoordinationDecision restrictions remain server-enforced across Cycle/Strategy/Scheduling/Live. |
| Support | Existing bounded inbox/detail conversation workspace distinguishes Reply, Internal Note and AI assistance. | Server search/filter/status/priority/assignment, preserved case URL, sticky composer, canonical Documents and open-next work remain. | Internal notes are never client-visible; reply idempotency, attachment authorization and support-only authority are retained. |
| Cards Research | Existing research gallery presents governed catalog facts, offer freshness, compare behavior and client-aware research entry. | Client rail and Client 360 Cards entry preserve context; shortlist decisions hand off only inside Strategy. | Consultants cannot approve catalog candidates or use Admin configuration controls. |

## Visual, interaction and written-experience decisions

- Consultant teal/cyan focus is concentrated on active context and urgent work rather than indiscriminate decoration.
- The persistent client rail makes “who am I working for?” visible without leaving the workbench and offers compact access to the seven Client 360 domains.
- Work Queue and Clients explicitly use bounded desktop collections with sticky controls/footer and normal-flow narrow composition, avoiding nested-scroll traps.
- Arrow Up/Down row traversal uses the shared D1 collection contract; all row actions remain ordinary keyboard-reachable links/buttons.
- Plan Builder now separates structure, authoring and client-facing consequence. Consultant-only rationale is visibly excluded from preview.
- Human labels continue to replace raw queue codes; realtime, draft, approved, published and stale language remains sourced from canonical state.
- Saved views were not faked in browser storage. URL view state and ephemeral scroll restoration are honest; cross-device Saved Views require a canonical server model.

## Populated fixtures and browser paths

The deterministic Credit-only demo seed provides:

- 25 authorized clients, 25 documents, 14 Support cases and 31 Notifications;
- an active and a published Credit Review plus current published Profile;
- a populated preparation Plan with dependencies and immutable versions;
- governed personal/business/secured/non-reporting card catalog and portfolio state;
- current and historical Rounds, an approved Strategy version, Appointment, Live Session, application outcomes, final Analysis and Major Readiness case;
- deterministic non-production authority provenance for lifecycle review fixtures.

Browser review uses `http://localhost:5185` with the temporary Consultant review account. The acceptance sweep covers Dashboard → Work Queue → Review, global search → Client 360 domains, Plan, Strategy, Calendar → Live, Live Help → Work Queue, Post-Round/Analysis/finalization, Major Readiness, Support and Cards Research. Desktop is primary; the bounded collections and Plan/client context rail collapse to normal-flow/intentional sequential composition at narrow width. Keyboard collection behavior is backed by focused regression tests.

## Verification

- Focused D5 Web: 8 files / 21 tests passed across Dashboard, Work Queue, Client 360, Plan, Strategy, Support, visual maturity and client/consultant continuity.
- Full Web: 29 files / 117 tests passed.
- Affected API: 10 files / 48 tests passed across source-scoped operations, Client Context, Review, Plan, Live, Post-Round, Major Readiness, Support and Attention; the separately configured realtime gate added 3 files / 7 passing tests.
- Fresh isolated Credit-only database `credit_strategy_d5_ci_0908`: all 66 migrations applied; system seed passed twice; deterministic demo seed passed twice with stable lifecycle identifiers. No Behfar resource was used.
- Repository lint, typecheck and all production builds passed. The existing Vite entry-chunk advisory remains informational.
- Exact-final-head GitHub CI: immutable result supplied at handoff after the report boundary is pushed.

## Remaining non-blocking items

- Canonical cross-device Saved Views need a server-backed per-user model, capability filtering and lifecycle policy. Owner: future product/platform planning. D5 preserves URL-restorable views without violating PD-4.
- Resizable pane dimensions are not persisted because the existing three-zone domain workspaces are operable without them; adding resize state is an optional post-acceptance refinement, not an authority or workflow blocker.

## Acceptance

D5 completes the shared consultant operating context and the highest-friction high-volume/Plan composition gaps while preserving the accepted professional domain implementations and all authority, concurrency, realtime, immutable-history and publication boundaries. D6, Phase 18, public-site and deployment work were not started; `ai-enabled` was not modified.
