# Development roadmap: Astra to production

This roadmap retains the full planned product. It is a delivery sequence, not a reduced MVP. **A0 is complete for audit isolation; A1–A13 have not started.** Product development begins only when the user asks to start after reviewing this audit.

Avoid calendar promises before A1/A3 expose extraction, provider and migration effort. Track accepted workflow outcomes, remaining defects and evidence—not a percentage derived from screens or test counts. Re-estimate each wave after its contracts and dependencies are known.

## Dependency sequence

`A0 → A1 → A2 → A3 → A4 → A5 → A6 → A7 → A8 → A9 → A10 → A11 → A12 → A13`

Some bounded work can overlap without declaring a dependent workflow complete: provider research/configuration from A3 while A2 runs; catalog source preparation from A6 after A1; public copy recovery before A11; performance/security verification throughout. A4 needs real report/AI/email capability. A7 needs complete Review, Plan and Catalog context. A8 needs frozen Strategy/rules. A9 needs actual application outcomes. A12 cannot close while any planned screen/feature is silently deferred.

## Wave plan

| Wave | Deliverable | Primary blockers addressed | Exit evidence |
|---|---|---|---|
| A0 | Independent Astra baseline and audit | Version/runtime collision | Separate branch/worktree/DB/Redis/files/ports; source manifest; audit and roadmap; old branch heads unchanged |
| A1 | Recovered product contracts and premium reference design | R01–R27, F08/F09/F20 | Exact next-action rules/glossary; state-specific screen contracts; distinctive reference compositions reviewed at desktop/mobile |
| A2 | Consistent workflow truth and domain/frontend boundaries | F04–F07/F10/F18 | Same client facts/next action across surfaces; proper Plan counts; explicit versions/dependencies; typed events/query keys; saved-view foundation |
| A3 | Real runtime adapters and operational foundation | F01–F03/F19 | Real report corpus processing, real AI transport, both email paths; payment/calendar capability contract; safe production assembly |
| A4 | Complete onboarding and Credit Review service | W01–W03, F01/F05/F14 | New client → paid/credit Review → real report → verification → useful published Credit Center; rejection/correction/retry/history |
| A5 | Mature shared Plan and Nurture | F06, R10/R18 | Branching Plan with typed outcomes/verification/reconciliation, accurate client preview and cross-surface propagation |
| A6 | Complete portfolio and governed catalog | F14/F15, R08/R12 | Real maintained product/offer sources, rich research, persistent portfolio, conflict/dedupe/freshness and insight approval |
| A7 | Assisted Strategy workbench | F02/F12, R11/R13/R14 | Client-specific AI candidates/comparison/execution proposals; manual fallback; validated frozen Strategy and client-safe handoff |
| A8 | Scheduling and full supervised execution | F11/F12, R15–R17 | Real calendar behavior; two-role live session, persistent dock, one-card release and all normal/exception/reconnect paths |
| A9 | Outcomes, Major Readiness and complete commerce | W09/W10, R07/R18/R20 | Actual outcome revisions/totals/Analysis/Nurture; Major restrictions through every command; full service/payment lifecycle |
| A10 | Mature CRM/Admin/support operations | F10/F16/F17 | Complete configuration authoring→activation→runtime effect, workload/reporting, support/delivery/governance and role coverage |
| A11 | Premium public experience and final product copy | F09/F13 | Business-value website, coherent pricing/intake/auth, reviewed trust/legal content; full client/CRM/Admin copy sweep |
| A12 | Production qualification | All release obligations | Real integration evidence, accessible/performance/security checks, upgrade/restore/rollback, monitoring/runbooks, zero unresolved release blockers |
| A13 | Controlled launch and operating verification | Unknown real-use gaps | Complete full-scope pilot journeys, resolve defects, verify operations and business acceptance, then launch |

## A1 · Recover the contract and establish the design standard

**Work:** turn REQUIREMENTS and the 110-screen register into exact business/state contracts. Resolve source-date eligibility, desired amount/amount reached, Plan types, source freshness, authority levels and service access. Produce a product glossary and copy inventory. For each screen identify its primary question, data/source/date, owner, action and relevant states.

Design six distinct compositions: client current-focus overview; Credit Profile/Analysis; consultant source/decision workbench; Strategy research/compare/sequence; live mobile card plus persistent CRM dock; Admin operations table/detail. Define tokens for type scale, readable measure, spacing, surface/radius, restrained gradient/glow, charts, focus and motion. Do not redesign everything by replacing one common card style.

**Reference slice:** Home → Credit Center → Plan, with new client, published/actionable, consultant waiting, stale/material change and completed/Nurture states. Include 390px mobile and 1440px desktop plus a narrow desktop/tablet breakpoint. Demonstrate one genuinely useful chart/timeline where evidence supports it, not a decorative meter.

**Done when:** each reference screen answers “where am I, what matters, who acts next, what do I do?” without explanation; amounts/dates/labels are source-correct; no internal jargon; no accidental overflow/focus trap; user can review the concrete design direction before broad implementation. Exact unresolved business choices are recorded, not guessed.

## A2 · Repair truth before spreading the design

**Work:** implement the shared next-action/read projection and the same milestone/Plan facts in Home, Journey, Client 360 and Round. Replace Plan-count-as-action-count. Define freshness/version authority. Preserve legacy cycle data but stop using it alone to choose next actions. Inventory and retire duplicated old screens through tested routing.

Separate Plan dependencies from display order, eliminate hardcoded source revisions from authoring payloads, and make reconciliation reference actual source versions. Add shared typed DTOs/query keys and review all live invalidation roots, especially published Credit Center. Add per-user server saved views with schema migration and URL restoration. Extract oversized page modules along domain boundaries and add appropriate route loading boundaries.

**Done when:** one fixture transitioning through stale/restricted/actionable/waiting states shows consistent next action everywhere; two browser sessions see committed updates; role changes/revocation remove access; named view survives a new device/session; display reorder cannot alter dependencies; migration/backfill preserves historical publications and amounts. F04/F05/F06/F07/F10 have concrete regression evidence.

## A3 · Make integrations real

**Work:** replace fixture-only report/provider selection with configurable real transports. Implement supported report extraction, normalized schemas and field/page evidence. Introduce production startup checks preventing fixture/demo execution. Add AI instructions/versioning, eval fixtures, redaction, budget/latency/timeout/retry and invalid-output handling. Assemble SMTP/external email in API and worker and prove verification/reset delivery.

Map actual capabilities of each payment merchant configuration. Bank of America hosted adapter explicitly cannot perform status retrieval/refund: implement the contracted alternative or a documented authorized reconciliation/refund operating flow supported by the merchant product. Do not imply PayPal/Stripe/BofA are interchangeable in unsupported operations. Complete real external calendar transport and clarify outage semantics. Wire storage configuration while keeping approved private local launch storage.

Make API/worker/outbox/scheduler responsibilities explicit; readiness includes dependencies and configured critical adapters. Maintain separate sandbox/test credentials and Astra resource identifiers.

**Done when:** a real/redacted supported report goes through extraction/validation; malformed/partial/incorrect-date reports produce actionable recovery; two different client contexts produce meaningfully different evidence-grounded AI proposals; actual test email arrives; deployed process entrypoints use the adapters; restart/retry does not duplicate outcomes. No actual production purchase or deployment is performed without the later authorized launch step.

**Inputs needed during this wave:** permitted report examples, intended model/provider configuration, separately scoped email/calendar/merchant test accounts, deployment access when appropriate. Complete code and reviewable setup before asking for credentials/approval; never copy another version's secrets.

## A4 · Deliver the real Credit Review experience

**Work:** goal intake/account continuity, Review eligibility/access, upload/date validation, complete portfolio intake and changes since report, durable submission/status, consultant source/exception workbench, verified Profile/Analysis/recommendation and shared Plan publication. Create actual field-level UI; source JSON must not dictate information hierarchy.

Build the premium Credit Center: clear overview; bureau/model/date-aware Profile, utilization/accounts/inquiries details; protected source preview; readable analysis and recommendations; shared Plan entry; openable immutable history and material-change comparison. Distinguish report date, publish date, latest client update, and current advisory freshness.

**Done when:** W01–W03 are performed end-to-end with real supported/redacted reports and both direct credit and payment paths; client-safe publication excludes all drafts/internal notes; invalid report/reupload/retry and concurrent publication preserve access/history; repeat Review asks for appropriate changes and does not duplicate portfolio records. First-time, ongoing, stale and historical views all look finished.

## A5 · Complete Plans, verification and Nurture

**Work:** Action/Guidance/Milestone authoring, independent dependency graph/path conditions, completion schema/outcome mapping, manual and AI-assisted draft preparation, autosave/conflict handling, exact client preview, explicit approval. Build verification queue and reconciliation diff showing keep/change/supersede/new proposals while retaining consultant edits.

Client executes the current relevant work with the right form and explanation. Completed history collapses usefully. Unable-to-complete routes to the appropriate owner rather than faking completion. Embed the same Plan projection in Review, Home, Major, post-Round and Nurture.

**Done when:** branching plans survive reorder/save/reload without semantic changes; no hardcoded source versions; structured outcomes update the canonical entity atomically; stale source prompts a genuine reconciliation; client sees only approved relevant content; Nurture remains useful with Guidance and a next Milestone. Verify two-editor conflict and offline draft recovery.

## A6 · Make Cards a professional research foundation

**Work:** persistent My Cards Add/Edit/Identify/Close, personal/business/non-reporting/secured/current-v-report distinction, duplicate matching and meaningful totals. Complete Explore/Detail/Wishlist with normalized offer fields, purposeful images, rich factual filters, status/freshness and notes where approved.

Implement controlled catalog source discovery/retrieval → candidate normalization/deduplication → evidence/conflict review → immutable approved offer → internal AI insight preparation/approval. Admin queue prioritizes material/stale/unmatched/asset issues. Consultant research provides source/offer/insight history, comparison and contextual Add to Strategy. Freshness changes propagate impact to relevant drafts/approved strategies without silently rewriting them.

**Done when:** actual approved sources populate useful current products and images; conflicting/stale/discontinued records are handled; source licenses/usage and evidence are recorded; no mock issuer facts ship as live catalog; portfolio changes reconcile correctly and invalidate affected strategy context. Consultant can compare a meaningful set without manually opening many disconnected pages.

## A7 · Build the assisted Strategy workbench

**Work:** compact client/source context, real AI brief/candidates, research and shortlist, side-by-side comparison, visual sequence with keyboard reorder, alternatives/conditional cards and typed execution branches, per-card client-safe Why, validation and final preview/approval. Preserve the consultant's edits when regenerated suggestions arrive.

Validate source sufficiency/currentness, Plan completion, Major check/restrictions, entitlement, offer/insight versions, no duplicate conflicts, all required result branches and reachable sequence. Show blockers separately from acknowledgeable warnings. Freeze exact source/offer/sequence versions and handle material changes with a new approval path.

**Done when:** consultant can prepare a real client-specific strategy with materially less manual research; AI outage retains full manual authoring; approved strategy is reconstructable; stale source cannot be approved/released; client preparation view exposes only intended information. Compare/sequence/approval is a coherent workbench, not one long form stack.

## A8 · Finish calendar and live operations

**Work:** editable weekly availability/exceptions/buffers/timezones; calendar day/week/list, real busy/mirror integration; book/reschedule/cancel/no-show/reminders with collisions/DST covered. Build a persistent authorized CRM session dock with current client/card, attention and return action.

Live client: final material-change confirmation → wait/join/presence → one released card → Why/Apply/Skip/Help → structured result. Live consultant: client/source/readiness, approved sequence, current result/branch, attention/chat, safe pause/revision/end. Approved rules handle normal progression; unresolved changes, unknown outcomes and supervision loss require intervention.

**Done when:** simultaneous client and consultant sessions complete approved/declined/pending/skip/help/technical-failure branches; external issuer handoff does not expose hidden future cards; duplicates/races cannot release or count twice; navigation preserves the dock; disconnect/reconnect/permission loss behaves safely. Real calendar outage cannot silently advertise unknown busy time as certain availability.

## A9 · Close the service lifecycle

**Work:** complete structured pending/reconsideration/credit-limit-increase updates; consultant verification; totals separating original approved limit and incremental changes; Preliminary/Final/updated Analysis and publish; finalization rules; Nurture/next-cycle handoff.

Complete Major intake/access, approved guidance/preparation/coordination/timeline and reassessment. Restrictions affect scheduling/strategy/live as defined. Clarify what prior published guidance remains valid during new draft assessment.

Finish full service catalog, credits/entitlements, purchases/receipts, refunds/disputes, reconciliation and history. Three gateway configurations and one default for new purchases; every historical payment remains tied to its original provider. Verify exact service access for Review/Round/Major from approved commercial policy.

**Done when:** pending becomes approved after live, reconsideration changes outcome, CLI updates amount, all totals/Plan/Analysis/portfolio views agree, no generic checkbox substitutes for a fact, and a subsequent season uses the same Journey. Refund/duplicate/late callback scenarios leave consistent access and financial history. Major changes halt/reassess affected activity and resume only via valid decisions.

## A10 · Complete the operating product

**Work:** mature CRM Dashboard/Work Queue/Clients/Client 360 and contextual support, saved views and efficient scan/detail patterns. Support offers scoped threaded work, drafts, useful AI assistance under approval, resolution and notification deep links. Documents/notifications/account utilities are complete and consistent.

Complete all 27 Admin contracts: user/role/session/grants; service/payment/provider operations; catalog/insight/source operations; AI jobs/process definitions; workflow/template/integration authoring and actual activation; scheduler; audit/security/retention; operational reports and settings. Replace fixed values/reasons or disabled-draft-only screens with usable bounded workflows. Show effective runtime state separately from intended configuration.

**Done when:** an authorized operator can perform each planned workflow without editing source/DB, except explicitly deployment-owned secrets. Approval/diff/test/activation/rollback and error recovery are meaningful. Report metrics have definitions and reconcile to source records. Admin role browser coverage, keyboard/density and consequential-action tests are complete. The audit's Admin MFA coverage limitation must be resolved through authorized test access.

## A11 · Finish the public brand and all written content

**Work:** premium public landing, Services/How it works, Pricing, FAQ/trust/disclosures and goal-first entry. Show the value of coordinated strategy and ongoing advisory support through clear content and useful visuals. Carry one brand and terminology into authentication/client/CRM/Admin, with role-appropriate density and detail.

Perform a complete copy inventory: headings, descriptions, labels, helper text, errors, empty/waiting/stale states, confirmations, notifications and emails. Remove internal project phases, “canonical/governed/deterministic” boilerplate from ordinary user flows; keep precise internal detail where operators genuinely need it. Verify links, price consistency, agreement versions and business-approved policies.

**Done when:** public messaging accurately explains offer/fit/next action; no invented claims/testimonials/guarantees; all product states use understandable wording; accessibility/readability and mobile entry are verified. Business/legal policy approval is recorded as its own launch evidence.

## A12 · Production qualification

**Work and gates:**

- Functional: all 110 contracts accounted for; W01–W12 end-to-end including material error/recovery/permission states; no fixture adapters or manual DB edits needed for normal work.
- Data: fresh install and upgrade/backfill, reconciliation of money/credits/results, immutable source/version preservation, restore test using representative private files plus DB.
- Reliability: worker restart/replay/leases, outbox and idempotency, provider timeouts/late events, two-instance realtime/refetch, deploy/drain and rollback.
- Security/privacy: role/resource/grant/MFA matrix, session/recovery, document access and upload protections, secret/redaction checks, consent/retention/hold/fulfillment review; resolve findings rather than assert absolute security.
- UX/accessibility: desktop/tablet/mobile critical flows, keyboard, focus/dialog/scroll, screen-reader names/status, contrast, reduced motion; long names/text/records, no-data and partial-data scenarios.
- Performance: route bundle budgets and measured loading/interaction under representative device/network/data volumes; large collections and server queries profiled; no arbitrary test-count proxy for speed.
- Operations: monitoring/alerts for delivery failure, job lag, payment mismatch, stale sources and health; on-call/incident/support/refund procedures; deploy/backup/restore runbooks and separately scoped production resources.

**Done when:** every release blocker has evidence-backed closure, unresolved lower-priority items are explicitly accepted without removing required functionality, external provider/business inputs are complete, and a release candidate can be restored/rolled back and operated by its intended staff.

## A13 · Controlled launch, then production acceptance

Run a limited real-use pilot with the **completed feature set**, approved client participation and operating procedures. Follow complete journeys from intake to verified Review, Plan, Strategy, live execution, follow-up and next cycle; include Major and support. Record friction and defects by screen/workflow, fix them and rerun affected paths. Confirm monitoring, response ownership, financial reconciliation and retention operations.

Production acceptance is a recorded business and technical decision, not an automatic promotion after deployment. The user authorizes publishing/deployment when the concrete release candidate and evidence are ready.

## First implementation package, ready to start next

1. Verify Astra path/branch/runtime boundary using WORKSPACE.md; capture baseline and start A1.
2. Finalize the source conflict decisions and next-action/state matrix, with exact primary-goal/currency/source-date terminology.
3. Implement the Home → Credit Center → Plan reference compositions with realistic fixture states, reusing client-safe DTOs and establishing copy/type/density rules.
4. Correct the Plan action count and common next-action projection, and add the regression that would have caught the observed contradiction.
5. Repair published Credit Center invalidation and Plan dependency/source-version round-tripping before expanding authoring.
6. Present the concrete slice and evidence; then carry the accepted standard into subsequent waves. Do not stop at a static mockup or claim the slice makes the whole platform production ready.

No branches are merged into Sol or non-AI. Any future reuse between versions must be an explicitly requested selective transfer; Astra remains the sole version advanced by this task.
