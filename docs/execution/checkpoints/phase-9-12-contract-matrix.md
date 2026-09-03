# Phases 9–12 Contract Matrix

Status: audit-first working record. Created before checkpoint product-code changes.

Starting boundary: `0a729d1f9bed15b997df0acf058b1c34443dab7a`

Disposition vocabulary: `IMPLEMENTED + PROVEN`, `IMPLEMENTED + UNPROVEN`, `PARTIAL`, `MISSING`, `DEFERRED BY CANONICAL ROADMAP`, `NOT APPLICABLE`.

Evidence must cover every applicable layer: schema/migration; domain/transaction; API/query/command; worker/AI/provider; authorization/privacy/MFA; audit/outbox/realtime/notification/Attention; frontend state/interaction; responsive/volume behavior; prior-phase integration; automated tests; browser behavior; and failure/retry/concurrency recovery.

## Baseline findings

| ID      | Contract                                                                                                                                                             | Initial disposition    | Layers requiring checkpoint proof                      |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------ |
| C912-01 | Review environment and runtime handoff are Credit-only, healthy, reproducible, and use the persistent Phase 9–12 database.                                           | IMPLEMENTED + UNPROVEN | runtime, DB, browser, restart                          |
| C912-02 | One shared Plan engine supplies preparation, Nurture, post-Round, and major-readiness planning without parallel task truth.                                          | PARTIAL                | schema, domain, API, integration                       |
| C912-03 | Plan authoring, validation, approval, client execution, outcomes, reconciliation, and realtime effects work end to end.                                              | IMPLEMENTED + UNPROVEN | transaction, API, effects, UI, browser, concurrency    |
| C912-04 | Card Catalog and portfolio APIs and screens are materially complete for Client, CRM, and Admin.                                                                      | IMPLEMENTED + UNPROVEN | API, frontend, browser, responsive                     |
| C912-05 | Card facts have immutable offer history, provenance, freshness, stale suppression, and safe projections.                                                             | IMPLEMENTED + UNPROVEN | schema, publication transaction, API, tests            |
| C912-06 | Seasonal Cycle and paid Round entry/resume are stable and browser-usable.                                                                                            | IMPLEMENTED + UNPROVEN | entitlement, API, UI, restart/re-entry                 |
| C912-07 | Entitlement never implies readiness; deterministic readiness gates use Profile, Plan, Review, and source truth.                                                      | IMPLEMENTED + UNPROVEN | domain, API, UI, denial paths                          |
| C912-08 | Pre-Strategy major-credit coordination is authoritative, scoped, auditable, and blocks unsafe progression.                                                           | IMPLEMENTED + UNPROVEN | auth, transaction, UI, effects                         |
| C912-09 | Strategy workspace provides source context, search/compare, roles/rationales, sequence editing, exact blockers, staleness, approval confirmation, and approved read. | PARTIAL                | API, frontend, browser, responsive                     |
| C912-10 | AI is proposal-only through the durable runtime; deterministic/manual fallback remains usable and AI cannot approve.                                                 | PARTIAL                | durable AI job/output/artifact, auth, failure recovery |
| C912-11 | Strategy freezes exact CardProduct, CardOfferVersion, and approved CardInsight facts used at approval.                                                               | PARTIAL                | schema/FKs, transaction, projections                   |
| C912-12 | Material change detection covers every Strategy source and leaves approved history immutable.                                                                        | PARTIAL                | source fingerprints, domain, events, tests             |
| C912-13 | Approval enforces capability, scope, MFA/step-up, source revalidation, atomic rollback, replay safety, concurrency, and exactly-once effects.                        | IMPLEMENTED + UNPROVEN | auth, transaction, concurrency, effects                |
| C912-14 | Client Strategy projection positively selects safe fields and cannot leak consultant/AI/internal metadata.                                                           | IMPLEMENTED + UNPROVEN | DTO, IDOR, browser/API leakage                         |
| C912-15 | Plan, Cards, Cycle/Round, and Strategy are coherently integrated into Navigation, Home, Journey, Credit Center, and CRM.                                             | PARTIAL                | routing, query composition, realtime, browser          |
| C912-16 | Lists, search, filters, selectors, and editors remain usable and deterministic at realistic volume and responsive widths.                                            | IMPLEMENTED + UNPROVEN | pagination, ordering, UI, mobile browser               |

## Sprint 9 requirements

| Sprint | Requirement                                                                                                              | Initial disposition    | Required proof                          |
| ------ | ------------------------------------------------------------------------------------------------------------------------ | ---------------------- | --------------------------------------- |
| 9.1    | Canonical Plan/version/source lifecycle with immutable approved/completed history and optimistic concurrency.            | IMPLEMENTED + UNPROVEN | migration, domain, concurrent edit      |
| 9.1    | Typed ACTION/GUIDANCE/MILESTONE items, completion modes, ownership/timing, safe/internal content separation.             | IMPLEMENTED + UNPROVEN | schema, validation, projection          |
| 9.1    | Explicit dependencies, AND/OR/path semantics, alternate paths, and presentation order independent of prerequisite truth. | IMPLEMENTED + UNPROVEN | graph tests and API                     |
| 9.1    | Reject missing/self/circular/unreachable/cross-path/impossible/duplicate-path/invalid-activation states.                 | IMPLEMENTED + UNPROVEN | focused validation suite                |
| 9.1    | Capability plus client-scope authorization and consequential audit/outbox foundations.                                   | IMPLEMENTED + UNPROVEN | IDOR/effects tests                      |
| 9.2    | CRM Plan Builder composes published Review/Profile, Goal, Journey/Nurture, and Plan context.                             | PARTIAL                | query and browser                       |
| 9.2    | Typed add/edit/remove/reorder, dependency/path controls, validation blockers, conflict/error/empty/loading states.       | IMPLEMENTED + UNPROVEN | UI/API/browser                          |
| 9.2    | Client-safe preview, governed approval/freeze, new draft for later edits, and immutable lineage.                         | IMPLEMENTED + UNPROVEN | DTO/transaction/browser                 |
| 9.2    | AI delta is durable/proposal-only and unavailable AI never blocks manual authoring.                                      | PARTIAL                | durable-runtime and degraded-path proof |
| 9.3    | Client route groups available/blocked/completed and explains dependency blocks safely.                                   | IMPLEMENTED + UNPROVEN | browser/API                             |
| 9.3    | Completion/outcome/unable/verification commands honor typed ownership and canonical domain mutations.                    | IMPLEMENTED + UNPROVEN | owning-domain transaction proof         |
| 9.3    | Exactly-once execution, stale/superseded denial, deterministic unlock, and meaningful non-spam effects.                  | IMPLEMENTED + UNPROVEN | replay/concurrency/effect counts        |
| 9.3    | Hidden paths/internal rationale are inaccessible and client/consultant realtime propagation works.                       | IMPLEMENTED + UNPROVEN | API leakage/two-session proof           |
| 9.4    | Material source changes mark affected Plan state stale while non-material changes avoid churn.                           | IMPLEMENTED + UNPROVEN | Review/Profile/Goal fixtures            |
| 9.4    | Reconciliation preserves outcomes/manual content, creates explicit delta/version lineage, and requires approval.         | IMPLEMENTED + UNPROVEN | domain/API tests                        |
| 9.4    | Nurture/current Plan/stale state composes across Portal, CRM, Home, Journey, Credit Center, realtime and Attention.      | PARTIAL                | application/browser proof               |

## Sprint 10 requirements

| Sprint | Requirement                                                                                                                              | Initial disposition    | Required proof                    |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | --------------------------------- |
| 10.1   | Stable issuer/product identities, aliases, classifications, retirement, and reconstructable historical references.                       | IMPLEMENTED + UNPROVEN | schema/seed/API                   |
| 10.1   | Immutable offer versions with atomic current pointer, provenance, effective/freshness state, and stale promotion policy.                 | IMPLEMENTED + UNPROVEN | transaction/history tests         |
| 10.1   | Deterministic Credit-only reference seed, safe DTOs, governed audit/outbox/realtime publication.                                         | IMPLEMENTED + UNPROVEN | double seed/effect/leakage proof  |
| 10.2   | Existing ClientCard truth supports add/edit/close/identify/unresolved, ownership types, secured/non-reporting, and history preservation. | IMPLEMENTED + UNPROVEN | command/API tests                 |
| 10.2   | Cards, Explore, Wishlist, Card Detail, and CRM Cards are persistent, safe, searchable, responsive, and volume-usable.                    | IMPLEMENTED + UNPROVEN | browser and volume tests          |
| 10.2   | Wishlist is duplicate-safe and never implies recommendation/eligibility; no Apply/Strategy bypass exists.                                | IMPLEMENTED + UNPROVEN | replay/API/UI proof               |
| 10.3   | Governed source registry, mappings, retrieval, candidates, normalization, conflicts, evidence, allowlist, and SSRF defense.              | IMPLEMENTED + UNPROVEN | source/API/security tests         |
| 10.3   | New-product/offer publication is atomic, immutable, conflict-gated, duplicate-safe, retry-safe, and concurrent-safe.                     | IMPLEMENTED + UNPROVEN | rollback/replay/concurrency proof |
| 10.3   | Operational queues are capability-scoped, paginated, searchable, auditable, and emit effects once.                                       | IMPLEMENTED + UNPROVEN | UI/API/effect proof               |
| 10.4   | Versioned CardInsight uses durable AI provenance and remains proposal-only until authorized human approval.                              | IMPLEMENTED + UNPROVEN | durable runtime/auth tests        |
| 10.4   | Approved insight is immutable; offer change stales dependent insight exactly once; manual degraded flow remains available.               | IMPLEMENTED + UNPROVEN | transaction/event/failure proof   |
| 10.4   | Safe insight projection excludes confidence/provider/model/raw reasoning/internal notes.                                                 | IMPLEMENTED + UNPROVEN | positive DTO/leakage tests        |

## Sprint 11 requirements

| Sprint | Requirement                                                                                                               | Initial disposition    | Required proof                |
| ------ | ------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ----------------------------- |
| 11.1   | Start/resume one canonical seasonal Cycle with immutable source snapshot, version checks, and duplicate-safe entry.       | IMPLEMENTED + UNPROVEN | DB/API/replay/concurrency     |
| 11.1   | Cycle status and next action integrate with Journey/Home/Plan/Credit Center and browser re-entry.                         | IMPLEMENTED + UNPROVEN | composition/browser           |
| 11.2   | Paid Round entitlement is created exactly once through Commerce and does not itself grant readiness.                      | IMPLEMENTED + UNPROVEN | payment replay/rollback proof |
| 11.2   | Round preparation gate composes current Profile, Review, Plan, entitlement, and source prerequisites with exact blockers. | IMPLEMENTED + UNPROVEN | domain/API/UI denial proof    |
| 11.2   | Round entry/resume is scoped, auditable, realtime, stable after restart, and does not bypass prerequisites.               | IMPLEMENTED + UNPROVEN | auth/runtime/browser          |
| 11.3   | Major application check is a governed pre-Strategy authority boundary with client/card/plan/source context.               | IMPLEMENTED + UNPROVEN | schema/domain/API             |
| 11.3   | Duplicate/replayed/concurrent submissions converge; stale or cross-client transitions fail closed.                        | IMPLEMENTED + UNPROVEN | replay/concurrency/IDOR       |
| 11.3   | Resolve/verify effects are atomic, exactly once, auditable, and unlock Strategy only when authoritative.                  | IMPLEMENTED + UNPROVEN | rollback/effects/golden path  |

## Sprint 12 requirements

| Sprint | Requirement                                                                                                                | Initial disposition    | Required proof                     |
| ------ | -------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ---------------------------------- |
| 12.1   | Strategy context composes exact Round, Goal, Profile, Review, Plan, Cards, prior applications, and major-check sources.    | PARTIAL                | source DTO/fingerprints            |
| 12.1   | Candidate preparation runs through durable AI job/output/artifact records with structured provenance and manual fallback.  | PARTIAL                | worker/runtime/recovery tests      |
| 12.1   | AI can only propose; permissions/readiness and canonical selection remain deterministic.                                   | IMPLEMENTED + UNPROVEN | authority/failure tests            |
| 12.2   | Search/filter and meaningful side-by-side comparison use current offers and only approved/non-stale insight.               | PARTIAL                | API/UI/browser                     |
| 12.2   | Candidate inclusion/exclusion records consultant decision, role, rationale, exact facts, and source versions.              | PARTIAL                | schema/API/UI                      |
| 12.2   | Wishlist/AI suggestion never silently becomes recommended or selected.                                                     | IMPLEMENTED + UNPROVEN | domain/API tests                   |
| 12.3   | Consultant can author and reorder planned/alternative/conditional sequence with explicit execution rules.                  | PARTIAL                | UI/API/browser                     |
| 12.3   | Deterministic validation rejects duplicates, missing roles/rationales, stale facts, unsafe order, and invalid conditions.  | PARTIAL                | validation tests                   |
| 12.3   | Editing uses optimistic concurrency and cannot mutate approved history.                                                    | IMPLEMENTED + UNPROVEN | concurrent edit/version tests      |
| 12.4   | Approval has explicit confirmation and exact blockers, revalidates all sources, and requires capability/scope/MFA step-up. | PARTIAL                | UI/auth/transaction tests          |
| 12.4   | Approval atomically freezes exact facts and creates audit/outbox/realtime/notification/Attention effects once.             | IMPLEMENTED + UNPROVEN | rollback/replay/concurrency counts |
| 12.4   | Client approved-Strategy route is positively selected, safe, usable, and preserves immutable history/stale semantics.      | IMPLEMENTED + UNPROVEN | API leakage/browser                |

## Cross-cutting proof matrix

| Area                         | Required checkpoint proof                                                                                                                                                                 | Status  |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| Real application golden path | Plan author/approve → client execute → Cards → Cycle/Round entitlement/readiness → major check → Strategy draft/compare/sequence/validate/MFA approve → client safe read → stale fixture. | PENDING |
| Authorization/privacy        | Anonymous, wrong role, missing capability, cross-client, hidden fields, Admin-only professional authority, MFA and stale step-up denials.                                                 | PENDING |
| Transactions/idempotency     | Duplicate command, retry, failure injection, exact-one business/audit/outbox/notification/Attention effects.                                                                              | PENDING |
| Concurrency                  | Plan edit/execution, catalog publication/approval, Cycle/Round entry, major check, Strategy edit/approval.                                                                                | PENDING |
| Durable recovery             | Worker/AI restart, output/artifact recovery, retry/dead-letter semantics, no in-process-only truth.                                                                                       | PENDING |
| Database                     | Fresh isolated database, complete historical migrations unchanged, system seed twice, demo seed twice with stable counts.                                                                 | PENDING |
| Regression                   | Full API/web/worker/runtime/shared tests plus Review and Commerce risk boundaries, typecheck/lint/build.                                                                                  | PENDING |
| Browser                      | Required Client/CRM/Admin routes, SPA navigation, loading/empty/error/conflict/stale states, desktop/mobile, no runtime errors.                                                           | PENDING |
| Exact-head CI                | Final pushed head equals successful GitHub Actions SHA.                                                                                                                                   | PENDING |

## Newly discovered findings

| ID      | Finding                                                                                                                                                                                                                                                                                                       | Evidence                                                                                                                                                      | Disposition                                                     |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| C912-17 | The client Strategy DTO leaks internal execution policy (`timingRule`, `dependencyRule`, `stopRule`, and `reconsiderationRule`) even though Sprint 12.4 explicitly excludes execution-rule internals.                                                                                                         | `strategyProjection(..., clientSafe=true)` returns those four rule objects in `approved.sequence`.                                                            | CONFIRMED — correction required                                 |
| C912-18 | Strategy preparation is not integrated with the durable AI runtime. It writes a hard-coded proposal directly into `StrategyVersion.aiProposal`, with no durable job/output/artifact provenance or restart/recovery path.                                                                                      | `createStrategyDraft` constructs a local literal and immediately persists it; no AI runtime call or durable identifiers exist in the Strategy schema/service. | CONFIRMED — correction required                                 |
| C912-19 | The frozen Strategy source context is incomplete. Wishlist, entitlement identity/state, CardOfferVersion freshness, approved CardInsight dependencies, and an explicit preparation-Plan source version/fingerprint are absent from `strategySource`.                                                          | Static source-context inspection against Sprint 12.1 and 11.2 contracts.                                                                                      | CONFIRMED — correction required                                 |
| C912-20 | Strategy catalog/candidate selection can consume an unapproved or stale `currentInsightVersion`; the query and write path do not gate insight status.                                                                                                                                                         | `strategyCatalog` and `setStrategyCandidate` include/use `currentInsightVersion` without `APPROVED`/freshness validation.                                     | CONFIRMED — correction required                                 |
| C912-21 | The consultant Strategy workspace does not satisfy the sustained CRM-13–17 authoring contract: comparison, editable role/rationale, manual sequence editing/reorder, business-language rule editing, exact validation blockers, source panels, stale recovery, and explicit approval confirmation are absent. | Browser/source audit of `ConsultantStrategyPage`; current controls auto-fill rationale/rules and auto-generate sequence.                                      | CONFIRMED — correction required                                 |
| C912-22 | Approval writes the Round back to `READY_FOR_STRATEGY` after approval, which contradicts the approved/ready transition and can leave downstream projections semantically behind the Strategy state.                                                                                                           | `approveStrategy` updates `CreditCardRound.status` to `READY_FOR_STRATEGY`.                                                                                   | CONFIRMED — correction required                                 |
| C912-23 | The review test command can silently target an unrelated/default database when `DATABASE_URL` is omitted; the first audit run reached a stale Credit database and failed on missing migrations.                                                                                                               | Reproduced locally; explicit Phase 9–12 database binding made the focused 9-file/25-test suite pass.                                                          | CONFIRMED — harden checkpoint commands/reporting; no Behfar use |
| C912-24 | The client Cards endpoint returns consultant-side identity-link evidence because client and staff routes share the same broad include query.                                                                                                                                                                  | `GET /client/cards` called `listClientCards` with `identityLinks.evidence`; this violates positive client-safe DTO selection.                                 | CONFIRMED — correction required                                 |

## Final audit dispositions

This section supersedes the initial audit dispositions above. C912-01 through C912-16 are `IMPLEMENTED + PROVEN` after the consolidated correction and accumulated verification. The initially partial Strategy contracts (C912-09 through C912-12 and their Sprint 12 rows) are now complete through durable AI preparation, complete frozen source context, governed candidate facts, a sustained consultant authoring workspace, deterministic approval revalidation, safe client projection, and stale/supersession behavior.

- C912-17: fixed; the client Strategy DTO excludes all internal execution rules.
- C912-18: fixed; Strategy preparation uses durable PostgreSQL `AIJob` and `AIJobOutput` truth with proposal-only authority and manual fallback.
- C912-19: fixed; the source fingerprint covers Plan/version/item state, entitlement, Profile, Review, Goal, Cards/offers/insights, Wishlist, prior applications, Round, and major check.
- C912-20: fixed; only current approved, non-stale CardInsight truth can enter a candidate or approval.
- C912-21: fixed; the consultant workspace includes source context, AI/manual state, search/filter, 2–5 comparison, roles/rationales, reordering, business rules, blockers, and explicit confirmation.
- C912-22: `NOT APPLICABLE`; the Strategy aggregate owns approval. `READY_FOR_STRATEGY` is the Round's strategy-capable lifecycle state and the enum has no duplicate Strategy-approved state.
- C912-23: fixed operationally; all checkpoint commands bind an explicit Credit-only database and runtime guards reject non-Credit names. No Behfar database was used.
- C912-24: fixed; the client Cards route uses a positive safe selection and excludes identity-link evidence.
- C912-25: fixed; the review launcher now sets `apps/web` as Vite's root. The prior launcher could report a healthy API and listening web port while all browser routes returned 404.

Final cross-cutting result: green Plan-to-Strategy application path; authorization/privacy; rollback/replay/idempotency/exact-effect counts; concurrency; durable AI and worker recovery; fresh 50-migration chain; double system and demo seeds; 87 web, 213 API, 12 worker, and 3 runtime tests; typecheck/lint/build; and Credit-only browser review. Exact-head CI is recorded in the completion report and handoff.
