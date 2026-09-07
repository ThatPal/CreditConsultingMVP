# POAR Rebuild D3 — Client Commerce & Application Lifecycle

## Boundary

- Branch: `rebuild/authenticated-product-poar`
- Accepted start: `f72564efc1071950b5400aaa3b8c03d5bc88ca50`
- Implementation boundary: `eb30096`
- Scope: client Cards research and portfolio, Services and checkout status, Card Application Round, approved Strategy, scheduling, guided Live Session, results/follow-up/analysis/finalization, and Major application coordination.
- Guardrails: catalog and offer displays remain factual; Wishlist is research-only; Strategy remains consultant-approved; no issuer application URL was invented; realtime is described as live only while the transport is connected.

## Independent audit findings

| Finding | Severity | Evidence before correction | Disposition |
| --- | --- | --- | --- |
| CPOAR-D3-001 | P1 | Round detail presented its canonical stages as a long status-card stack and repeated its primary action in the page flow. | Corrected with the D1 lifecycle rail, a dominant factual current-state composition, review links only for unlocked stages, and one sticky authoritative action. |
| CPOAR-D3-002 | P1 | Live Session described supervision state but did not expose the actual realtime transport state, so a reconnect could appear healthy. | Corrected with a shared connection event, explicit Live/Reconnecting indicator, retained last-confirmed-state language, and regression proof. |
| CPOAR-D3-003 | P1 | Live rendered frozen offer data as raw JSON and labeled an action “Apply on issuer site” even though no verified issuer URL is provided by the canonical model. | Corrected with readable scalar fact rows and the truthful action “Confirm issuer application opened.” No outbound URL was invented. |
| CPOAR-D3-004 | P2 | Explore used an unbounded grid, hid active query state, and represented every product with the same small icon. | Corrected with the bounded gallery/compare collection, visible active-filter chips/reset, and deterministic issuer/product fallback artwork explicitly labeled as fallback art. |
| CPOAR-D3-005 | P2 | Catalog range facts displayed internal JSON objects and the research action was labeled only “Save.” | Corrected with human-readable ranges and “Save for research,” preserving the distinction from approved Strategy selection. |
| CPOAR-D3-006 | P1 | The retained review environment served hot-reloaded UI against an older compiled API process, causing the populated Round route to hit D0 recovery instead of rendering lifecycle truth. | Corrected operationally by rebuilding/restarting the existing Credit-only review environment on ports 5185/3008 and verifying the populated Round route against synchronized code. No product data was reset. |

No new P0 issue was discovered. The independent audit found the underlying Services/payment, Strategy, scheduling, post-round, analysis/finalization, and Major Readiness domain contracts already mature from the accepted Phase/APC work; D3 preserved those authorities rather than replacing them with client-side shadow state.

## Screen and journey acceptance

| Surface | D3 acceptance evidence |
| --- | --- |
| Cards / Explore / Wishlist | Portfolio metrics remain sourced from the latest Review. Explore now provides bounded governed catalog browsing, explicit filters/reset, factual offer freshness, fallback art, detail and Save for research. Wishlist remains preference-only with detail/remove controls and productive empty guidance. |
| Services / checkout / payment / entitlement | Governed catalog terms, eligibility, price and included access remain separate from checkout creation. Human payment state and append-only entitlement/credit history remain canonical. Unavailable checkout cannot imply purchase or entitlement. |
| Round overview | One D0 lifecycle projection drives state, owner, meaning, freshness, seven-stage rail, unlocked history links, blockers and the sole authoritative next action. Entitlement and readiness remain separate facts. |
| Approved Strategy / scheduling | The approved version and ordered consultant sequence remain distinct from Wishlist. Scheduling remains available only from valid approved Strategy context and explains timezone, prerequisites and the guided session handoff. |
| Guided Live Session | Client sees actual transport state, committed server truth, supervision presence, pre-live revalidation, frozen readable facts, help/skip/open recording, results capture and reconnect-safe wording. No unsupported issuer link is exposed. |
| Results / follow-up / analysis / finalization | Reported results remain separate from consultant interpretation. Typed follow-up ownership and waiting states lead to approved analysis/finalization without rewriting immutable application history. |
| Major application coordination | Existing server-enforced restrictions continue to govern Round, Strategy, Scheduling and Live. Client language presents timing/coordination and reassessment without approval probability or professional-outcome claims. |

## Populated browser proof

- Portfolio/Explore: `/app/cards/explore` rendered four deterministic governed products spanning personal, business, secured and non-reporting types, including one stale offer warning, truthful fallback artwork, details and Save for research.
- Services: `/app/services` rendered the governed Credit Profile Review service, price, included Review Credit, eligibility and an honestly disabled checkout state with no entitlement claim.
- Round/Strategy: populated Round `5676773c-bba9-4ac1-897d-57c8a49de725` rendered all seven lifecycle stages, current Goal-confirmation ownership and exactly one `Review current goal` action; its approved Strategy rendered version 1, sequence meaning and the scheduling handoff.
- Live: the populated guided session rendered `Live`, both participants present, pre-live change confirmation and committed-state copy. The connection indicator was sourced from the actual EventSource open state.
- Context preservation: Cards, Services and every Round-family route retained shared shell context and direct return paths. The synchronized review environment remains at `http://localhost:5185` with API `http://localhost:3008` and the persistent Credit-only database `credit_strategy_phase1316_checkpoint`.

## Verification

- Focused Web: 4 files / 10 tests passed, covering realtime language, readable offer facts, Round lifecycle, Strategy and checkout.
- Full Web: 29 files / 116 tests passed.
- Affected API: 15 files / 48 tests passed across cards/catalog, commerce, lifecycle, Strategy, scheduling/Live, post-round/finalization and Major Readiness.
- Fresh isolated Credit-only database: all 66 migrations applied and canonical system seed completed on `credit_strategy_d3_ci_0907`; no Behfar resource was used.
- Repository lint, typecheck and all production builds passed. Vite’s existing large-entry warning remains informational.
- Exact-final-head GitHub CI: immutable run supplied at handoff after the report boundary is pushed.

## Acceptance

D3 now reads as one continuous factual client journey: research and saved preferences lead to governed commerce/access, a canonical Round and approved Strategy, scheduling and truthful Live execution, then recorded results, owned follow-up, analysis and finalization/nurture. D4, Phase 18, public-site and deployment work were not started; `ai-enabled` was not modified.
