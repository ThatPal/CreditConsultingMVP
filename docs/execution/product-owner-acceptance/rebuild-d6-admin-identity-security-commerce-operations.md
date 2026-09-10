# POAR Rebuild D6 — Admin Identity, Security & Commerce Operations

Status: **COMPLETE — READY FOR PRODUCT-OWNER REVIEW**  
Branch: `rebuild/authenticated-product-poar`  
Accepted D5 boundary: `367e6a2663380513817471a656d677b712dc8653`  
Primary implementation boundary: `58a04d1`  
Browser-audit correction boundary: `90bb988`

## Outcome

D6 turns the accepted Admin identity, security, and commerce capabilities into consequence-aware operating workspaces without changing authority. The shared governed-action contract now presents current state, proposed state, exact scope, effective timing, reversibility, and immutable audit evidence. Users, scoped grants, audit/security events, services, and payments use bounded keyboard-navigable collection surfaces with sticky controls/footers and intentional narrow-width document flow. Search/filter/page state is URL-restorable for users, grants, products, and payments.

The Admin dashboard now prioritizes factual current exceptions, identifies the owning module, and labels every signal as a current API snapshot with its as-of time. No trend is inferred where no history exists. Existing secret filtering, immutable histories, provider-neutral payment routing, consultant-only professional CardInsight approval, and D0–D5 route/recovery behavior remain intact.

## Independent findings

| Finding | Severity | Disposition |
| --- | --- | --- |
| CPOAR-D6-001 | P1 | Closed. Consequential D6 actions used effect prose but lacked a complete, consistently structured current/proposed/scope/timing/reversibility/audit preview. The shared `GovernedActionDialog` now owns that contract and D6 role/MFA/session/assignment, grant, refund, gateway, and product availability flows adopt it. |
| CPOAR-D6-002 | P2 | Closed. Identity, grant, payment, product, and immutable-event collections were technically paginated but still composed as page-length stacked cards/rows. They now use the shared bounded CollectionSurface with sticky continuation and keyboard row traversal on desktop and intentional document flow on narrow widths. |
| CPOAR-D6-003 | P2 | Closed. Service-product search, availability, and page context was component-local and could not be restored from the URL. It is now URL-authoritative. Grant pagination is URL-restorable as well. |
| CPOAR-D6-004 | P2 | Closed. The Admin dashboard exposed module counts but not a prioritized exception region or explicit freshness/source context. It now presents current exceptions first and labels the snapshot source/as-of time without inventing trends. |
| CPOAR-D6-005 | P2 | Closed. Raw enum labels remained prominent in the identity and immutable-event collections. Human-readable state/action labels now lead while canonical detail remains available in record detail. |
| CPOAR-D6-006 | P1 | Closed during authenticated browser review. The scoped-grant editor issued access immediately instead of presenting the required pre-issue consequence preview. It now reviews the exact grantee/client, scope, capability, duration, purpose, timing, revocation semantics, and audit evidence before the separate issue action. |

No new P0 security, credential, payment, or authority finding was discovered.

## Screen and workflow acceptance

| Area | Accepted evidence |
| --- | --- |
| Dashboard | Current identity/security/commerce signals, prioritized exception links, factual source/as-of copy, no fabricated history. |
| Users / identity detail | Bounded directory, URL query state, keyboard rows, human role/status, session/MFA/grant/assignment context, structured governed previews. |
| Access grants | Bounded lifecycle history, URL page state, least-privilege create guidance, revoke scope/timing/reversibility/audit preview. Role-derived access remains distinct. |
| Sessions | Selected-session revocation remains scoped; role/MFA actions disclose all-session impact. No token/cookie/raw credential display. |
| Audit / Security | Immutable bounded histories, human action labels, safe metadata detail, actor/target/time evidence and safe related-record links. |
| Products / Services | URL-restorable commercial catalog, immutable versions, future-purchase versus historical-entitlement distinction, governed activation/deactivation preview. |
| Payments | Bounded provider-neutral ledger, URL filters/page, original-provider refund consequence preview, immutable event/refund/dispute/reconciliation detail. |
| Gateways | PayPal, Stripe and Bank of America remain under Commerce → Payments; configured/effective/connected distinctions and capabilities remain factual; secrets remain environment-managed and masked. |
| Card Catalog / Insights | Populated governed candidates and factual current insight remain accepted from Wave 5. Admin inspection/publication authority remains distinct from consultant professional insight approval. |

## Collection and accessibility decisions

- Desktop identity, grants, payments, products, audit, and security collections use bounded internal vertical scroll with sticky headers or controls and sticky pagination/continuation.
- Narrow layouts deliberately return to document flow; primary tasks do not require horizontal page scrolling.
- Collection rows are focusable and support Arrow Up/Arrow Down traversal through the shared contract.
- Existing visible focus, semantic dialogs, screen-reader labels, non-color status text, reduced motion, and 44px target rules remain inherited from D1.
- Operator query context is represented in the URL for the D6 paged/searchable collections changed here.

## Governed-action and secret-handling evidence

The shared preview is definition-list structured and accessible. D6 previews state the exact target and distinguish future effects from retained history. They do not claim provider settlement, downstream effects, or reversibility that the canonical command cannot establish. Gateway credentials, payment credentials, authorization headers, cookies, session tokens, raw user-agent strings, and unsafe provider metadata are not rendered. Existing recursive safe-record filtering remains the only normal Admin metadata renderer.

## Browser proof

The persistent review environment remains available at `http://localhost:5185` with the Credit API at `http://localhost:3008`, Credit PostgreSQL on port `5433`, and Credit Redis on port `6380`. Populated deterministic Admin fixtures include users, grants, audit/security events, services, payments/refunds/disputes, three gateway states, catalog candidates, and factual current CardInsight data. The implementation does not add real secrets or synthetic trend history.

The final authenticated Admin walkthrough covered dashboard attention routing; a 37-result Admin identity view; the signed-in Admin detail with session, MFA and capability context; a complete MFA-reset preview opened and cancelled; 36 populated access-grant history records and the corrected pre-issue grant review path; 50+ immutable audit records; 50+ security events; the active product catalog; the populated three-provider payment ledger; PayPal, Stripe, and BofA configuration/capability details; 16 populated catalog candidates; and the factual current CardInsight. No destructive review action was submitted.

At a 390 × 844 viewport, Users, Payments, and Card Catalog each rendered within the 390px viewport (`documentElement.scrollWidth` 375px) without horizontal page overflow. Keyboard traversal reached the labelled Notifications control; bounded collection rows and governed dialogs expose explicit focus targets.

## Verification

- Web regression: **29 files / 118 tests passed**.
- Shared governed-action regression: complete consequence preview is asserted.
- API regression: **70 files / 278 tests passed** using an isolated Credit Redis database. A first run against the live review Redis had one BullMQ delivery timeout because the persistent review worker consumed from the same queue; the isolated rerun proved all 9 durable-runtime tests and the complete suite.
- Lint: passed.
- Typecheck: all workspace projects passed.
- Production builds: all workspace projects passed; existing Vite chunk advisory only.
- Fresh database: `credit_strategy_poar_d6_gate_20260908`, all **66 migrations** applied cleanly. An initial disposable database name was correctly rejected by the Credit-only database guard before seed; no non-Credit database was used.
- System seed: passed twice with 16 canonical option templates.
- Demo seed: passed twice with identical deterministic IDs and populated review scenarios.
- Exact-final-head CI: recorded in the final handoff after the report commit is pushed.

## Boundaries

D7, Phase 18, public-site/deployment work, and merge into `ai-enabled` were not started. No product decision blocks D6 acceptance.
