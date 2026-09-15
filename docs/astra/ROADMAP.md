# Development roadmap: Astra to production

This roadmap retains the full planned product. It is a delivery sequence, not a reduced MVP. **A0 is complete for audit isolation; A1/A2 development is underway, with part of A5's Plan revision contract implemented.** The user authorized development. See [pass 1](IMPLEMENTATION-01.md) and [pass 2](IMPLEMENTATION-02.md) for delivered behavior, evidence, and remaining work. No production wave has been declared complete.

Plan work through [pass 6](IMPLEMENTATION-06.md) includes typed responses, correction/resubmission, evidence-bound verification, private attachments, help resolution, and paginated response history. A5 remains open for durable drafts, response-aware preview, multi-Plan/path lifecycle, and operational proof.

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

**Done when:** an authorized operator can perform each planned workflow without editing source/DB, except explicitly deployment-owned secrets. Approval/diff/test/activation/rollback and error recovery are meaningful. Report metrics have definitions and reconcile to source records. Admin role browser coverage, keyboard/density and consequential-action tests are complete. The initial MFA access limitation is resolved; the completed browser audit adds F21–F24. Close incorrect conflict counts, inappropriate client/staff controls, missing catalog evidence/resolution, and gateway discoverability in A2/A6/A9/A10 as applicable.

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

## First implementation package, underway

The user authorized development. [Implementation pass 1](IMPLEMENTATION-01.md) records the implemented Home/Credit Center/Plan changes and verification. A1/A2 remain in progress; the remaining source, graph-authoring, interaction and state requirements below are not waived.

1. Verify Astra path/branch/runtime boundary using WORKSPACE.md; capture baseline and start A1.
2. Finalize the source conflict decisions and next-action/state matrix, with exact primary-goal/currency/source-date terminology.
3. Implement the Home → Credit Center → Plan reference compositions with realistic fixture states, reusing client-safe DTOs and establishing copy/type/density rules.
4. Correct the Plan action count and common next-action projection, and add the regression that would have caught the observed contradiction.
5. Repair published Credit Center invalidation and Plan dependency/source-version round-tripping before expanding authoring.
6. Present the concrete slice and evidence; then carry the accepted standard into subsequent waves. Do not stop at a static mockup or claim the slice makes the whole platform production ready.

No branches are merged into Sol or non-AI. Any future reuse between versions must be an explicitly requested selective transfer; Astra remains the sole version advanced by this task.

## Latest checkpoint: pass 4

[Plan documents and evidence snapshots](IMPLEMENTATION-04.md) adds private attachment selection/upload, immutable submission metadata/question labels, protected downloads, and unavailable-evidence correction handling. A5 is still in progress: prioritize full history/review access, help resolution, response-aware preview, durable drafts, and remaining lifecycle states. Document scanning, retention, storage integrity, and access qualification remain explicit production gates.

## Latest checkpoint: pass 5

[Help resolution and ongoing review access](IMPLEMENTATION-05.md) closes the client-help reply/reopen loop and keeps completed responses accessible in the selected published Plan. A5 remains in progress. Next: full history pagination, durable drafts, response-aware preview, multi-Plan/path lifecycle, and independent-session realtime verification.

## Latest checkpoint: pass 6

[Paginated Plan history](IMPLEMENTATION-06.md) removes the 20-event access limit for visible steps in the current published Plan, with scoped cursor pagination, retained evidence on retry, and a bounded history region. Next: durable draft recovery, response-aware preview, path lifecycle and independent-session realtime verification.

## Latest checkpoint: pass 7

[Private client response drafts](IMPLEMENTATION-07.md) adds explicit server save/restore, revision/context conflicts, and atomic removal on submission. Autosave, unsaved in-app navigation, consultant authoring recovery, replacement-version draft review and retention/discard controls remain open. A1/A2/A5 are still in progress.

## Latest checkpoint: pass 8

[Client response autosave](IMPLEMENTATION-08.md) saves private edits after a short pause, preserves typing during a pending save, and pauses retries after failure. Saved responses survive reload and can be submitted normally. Next: protect unsaved in-app navigation, consultant authoring recovery, response-aware preview, path/multi-Plan lifecycle and independent-session verification. A1/A2/A5 remain in progress; the full production roadmap is unchanged.

## Latest checkpoint: pass 9

[Plan response navigation protection](IMPLEMENTATION-09.md) guards router navigation while response edits, uploads or writes are pending. Clients can stay, wait for saving, or explicitly leave without unsaved changes when no write is active. Next: consultant authoring recovery, offline/upload recovery, response-aware preview and path/multi-Plan lifecycle. A1/A2/A5 remain in progress.

## Latest checkpoint: pass 10

[Consultant tab recovery](IMPLEMENTATION-10.md) retains unfinished authoring edits within the current browser tab, with explicit restore/discard and original revision conflict protection. Consultant navigation now participates in the shared guard. Cross-device/server authoring autosave, conflict comparison/merge, browser MFA verification and offline/upload qualification remain open, along with preview/lifecycle work. A1/A2/A5 remain in progress.

## Latest checkpoint: pass 11

[Consultant draft comparison](IMPLEMENTATION-11.md) expands the saved-version review into field-level comparison of unfinished and loaded server content. It preserves local edits while comparing. Selective conflict resolution/merge, authenticated browser review and response-aware publication preview remain open. A1/A2/A5 remain in progress.

## Latest checkpoint: pass 12

[Selective wording resolution](IMPLEMENTATION-12.md) lets consultants carry selected title/instruction/rationale changes into a working copy based on the newer saved revision. Structural merging, authenticated browser review and response-aware publication preview remain open. A1/A2/A5 remain in progress.

## Latest checkpoint: pass 13

[Response-form publication preview](IMPLEMENTATION-13.md) shows client fields, required answers, constraints and verification guidance using the server's existing schema interpreter. Full interactive/lifecycle preview, consultant browser verification and remaining Plan path/version work remain open. A1/A2/A5 remain in progress.

## Latest checkpoint: pass 14

[Plan readiness scenarios](IMPLEMENTATION-14.md) adds path visibility counts, prerequisite explanations and a non-mutating completion scenario to publication preview. Full path/version lifecycle editing, current-source/readiness qualification and authenticated browser review remain open. A1/A2/A5 remain in progress.

## Latest checkpoint: pass 15

[Paths and version lifecycle batch](IMPLEMENTATION-15.md) adds path authoring, visibility/progress safeguards at save and approval, paginated version inspection/comparison, explicit client-publication context and a separately loaded consultant workbench. Continue in related batches. Multi-Plan selection/lifecycle, full graph conflict resolution, operational proof and consultant browser qualification remain open alongside the full roadmap. A1/A2/A5 remain in progress.


## Pass 16: Plan discovery and resumption

[Multi-Plan discovery](IMPLEMENTATION-16.md) adds scoped paginated browsing, direct selection, guarded switching, Plan-specific recovery, closed-Plan history and selected-Plan MFA return links. Cancellation/replacement policy and client multi-Plan navigation remain open. A1/A2/A5 are still in progress.


Latest: [Pass 17: Publication identity and Plan-specific follow-through](IMPLEMENTATION-17.md). Private edits no longer change the selected publication; selected-Plan response review and new work-item links stay scoped. Cancellation/replacement commands remain open; A1/A2/A5 remain in progress.


[Pass 18: Start a separate Plan](IMPLEMENTATION-18.md) adds blank draft context, guarded entry, independent recovery and first-save identity handoff. Next: creation request replay protection, cancellation/replacement policy and remaining A5 qualification.


[Pass 19: First-save replay protection](IMPLEMENTATION-19.md) adds consultant/client-scoped creation keys, atomic replay, tab recovery and confirmed-rejection handling. Next: source-grounded lifecycle commands and remaining operational/visual qualification. A1/A2/A5 remain in progress.


[Pass 20: Grouped private-Plan lifecycle](IMPLEMENTATION-20.md) delivers cancellation controls, scoped replay-safe cancellation, retained history/reasons and related reminder closure together. API/web each built once at the batch boundary. Published-Plan replacement and A5 qualification remain open.


[Pass 21: Queue-to-Plan navigation](IMPLEMENTATION-21.md) resolves legacy source links at read time, focuses stable response steps, handles unavailable sources and protects unsent review notes. Published-Plan replacement and operational/browser qualification remain open.


[Pass 22: Approval-context concurrency](IMPLEMENTATION-22.md) guards the reviewed client publication, serializes competing approvals and provides explicit refresh/re-review. Formal published-Plan replacement and operational/browser qualification remain open.


[Pass 23: Consultant message recovery](IMPLEMENTATION-23.md) adds isolated tab copies, orphan-message handling, changed-evidence review, cleanup and focused MFA returns. Server-backed drafts, published-Plan handoff and visual/operational qualification remain open.


[Pass 24: Source pauses and response recovery](IMPLEMENTATION-24.md) enforces source-review pauses on client/consultant writes and adds explicit response refresh and tab-storage retry. Grouped API/web builds passed. Published-Plan handoff and visual/operational qualification remain open.


[Pass 25: Approved revision follow-up handoff](IMPLEMENTATION-25.md) carries pending response reminders into approved revisions, preserves assignment and timing, scopes decision resolution, and refreshes response/Journey views. Separate-Plan replacement policy and broader qualification remain open.


[Pass 26: Client response boundaries and paused draft inspection](IMPLEMENTATION-26.md) blocks direct hidden-step submissions, prevents paused draft overwrites, and exposes saved answers read-only during pauses. Runtime transition/recovery qualification and separate-Plan replacement remain open.


[Pass 27: Earlier response draft access](IMPLEMENTATION-27.md) exposes the most recent earlier draft with original instructions/labels and authorized attachments, preserving independent current answers. Orphan/retention controls, unsaved transition recovery and broader qualification remain open.


[Pass 28: Explicit private draft discard](IMPLEMENTATION-28.md) adds confirmation, draft identity/revision protection, deletion replay, earlier/current isolation and conflict refresh. Removed-step recovery and unsaved-edit transitions remain open.


[Pass 29: Saved response library](IMPLEMENTATION-29.md) adds paginated client-owned draft inspection/discard across Plan history, including removed steps and no-current-Plan states. Unsaved live-transition recovery and browser/operational qualification remain open.


[Pass 30: Guarded live Plan updates](IMPLEMENTATION-30.md) retains displayed answers during dirty/busy response work, pauses writes when an update arrives, and requires explicit loading. Independent draft-query/session transitions and broader qualification remain open.


[Pass 31: Reviewed draft context and refresh guard](IMPLEMENTATION-31.md) binds edits to reviewed draft state, preserves text across cached changes and requires explicit reload. Rejected-lookup transport qualification, server draft identity and session-loss recovery remain open.


[Pass 32: Transport recovery and server draft identity](IMPLEMENTATION-32.md) verifies real API-wrapper failure/retry behavior and protects updated-client saves/submissions from recreated draft identities. Session-loss, legacy-caller migration and browser qualification remain open.


[Pass 33: Session expiry and return navigation](IMPLEMENTATION-33.md) adds explicit recovery copy, protects the sign-in return path and verifies real-provider recovery with controlled 401 responses. Full-browser dirty/busy expiry and broader production qualification remain open.


[Pass 34: Expiry during pending Plan work](IMPLEMENTATION-34.md) fixes blocked sign-in navigation, late private draft cache restoration, and upload callbacks after unmount. Controlled integration coverage passes; an editable synthetic browser scenario and broader qualification remain open.


[Pass 35: Real-browser expiry and upload authentication](IMPLEMENTATION-35.md) verifies editing/upload sign-out recovery against the real API, fixes anonymous upload 403 versus 401, and compacts the mobile action bar with keyboard focus transfer. Cross-tab/accepted-write behavior and broader production qualification remain open.


[Pass 36: Cross-tab sign-out and accepted draft recovery](IMPLEMENTATION-36.md) propagates confirmed logout without private payloads and verifies accepted-save recovery in two real browser tabs with storage fallback. Account switching, missed notifications, accepted-upload recovery and broader qualification remain open.


[Pass 37: Identity refresh and uncertain uploads](IMPLEMENTATION-37.md) clears old private state on detected account/authority changes and exposes existing-document recovery after uncertain upload confirmation. Real-browser recovery found one accepted file without re-uploading; per-request identity fencing, MFA transitions and broader qualification remain open.


[Pass 38: Request account expectation](IMPLEMENTATION-38.md) rejects updated-client requests from stale account tabs before protected v1 operations, covers JSON/files/downloads, and propagates successful MFA verification. Real-browser wrong-account upload rejection passed; legacy/direct callers and broader qualification remain open.


[Pass 39: Legacy request coverage and MFA handoff](IMPLEMENTATION-39.md) extends the account check beyond v1 and verifies a real synthetic Admin authenticator challenge, cross-tab cleanup and exact staff return path. Enrollment/recovery, event-stream revocation and broader production qualification remain open.

[Pass 40: Live-session revocation](IMPLEMENTATION-40.md) revalidates open update streams and clears idle private editors after server revocation. Real-browser heartbeat recovery passed in 4.3 seconds; staff recovery, stream load and broader production qualification remain open.

[Pass 41: On-demand feature loading and mobile foundation](IMPLEMENTATION-41.md) defers 42 authenticated page exports, verifies failed/slow chunk recovery, and adds the missing mobile viewport and document metadata. Home requested approximately 23% less uncompressed JavaScript in the controlled comparison; broader performance and workflow qualification remain open.

[Pass 42: Live collection refresh and document search recovery](IMPLEMENTATION-42.md) connects events to the actual Plan/document/Review collections, validates incoming hints, and keeps empty-search controls usable. Real API upload/deletion updated two open screens; private draft notification delivery remains open.

[Pass 43: Owner-targeted private draft notifications](IMPLEMENTATION-43.md) records save/discard hints transactionally and routes them only to the owning client account. Separate-session browser recovery and recipient tests passed; ordering, staff/multi-node evidence and coordinated rollout remain open.

[Pass 44: Draft acknowledgment ordering](IMPLEMENTATION-44.md) prevents delayed save responses and obsolete reads from hiding newer draft state. Four controlled races and a real committed-write browser scenario passed; broader delivery and workflow qualification remain open.

[Pass 45: Accepted-save confirmation recovery](IMPLEMENTATION-45.md) distinguishes a successful save from a failed follow-up check, preserves local work and retries without repeating the save. Controlled network/server failures and a real accepted-save browser scenario passed.

[Pass 46: Consultant Plan discovery and lifecycle clarity](IMPLEMENTATION-46.md) adds server-backed title/status search, retained empty-result controls and a sticky library header. Filtered pagination and guarded navigation passed; consultant browser/visual qualification remains open.

[Pass 47: Consultant access and Plan drawer accessibility](IMPLEMENTATION-47.md) verifies authorized synthetic consultant MFA recovery/enrollment, desktop/mobile discovery and version inspection; adds named dialogs and focus handling. Broader staff and production qualification remain open.

[Pass 48: Consultant decision recovery](IMPLEMENTATION-48.md) requires history refresh after an unconfirmed decision, distinguishes accepted decisions from failed follow-up reads, and improves unsent-message recovery. Sixteen component tests and a controlled authenticated browser failure scenario passed; approval/publication qualification remains open.

[Pass 49: Approval confirmation and real staff recovery](IMPLEMENTATION-49.md) separates accepted approval from failed follow-up reads and gates further changes on publication recovery. Thirty-five tests and real API/browser approval plus completion recovery passed with one write each; broader lifecycle qualification remains open.

[Pass 50: Client follow-up clarity and correction roundtrip](IMPLEMENTATION-50.md) consolidates correction/help feedback above the response form and verifies real browser submission, correction, resubmission and verification. Forty tests passed, including database competing-approval coverage; separate-consultant browser contention remains open.

[Pass 51: Attachment replacement and competing previews](IMPLEMENTATION-51.md) names excluded prior evidence, verifies real upload/replacement correction history, and checks stale approval recovery in two tabs. Twenty-seven web tests and both builds passed; distinct-consultant browser qualification remains open.

[Pass 52: Evidence availability and distinct consultant access](IMPLEMENTATION-52.md) refreshes open evidence views after document changes, blocks verification of unavailable files, and verifies correction recovery plus distinct-consultant approval/access behavior. Thirty-four web tests passed; source reconciliation and broader operational qualification remain open.

[Pass 53: Source reconciliation recovery and comparison usability](IMPLEMENTATION-53.md) distinguishes accepted source updates from failed reads, gates further changes until recovery, and improves the comparison drawer. Thirty tests and real reconciliation/republication browser checks passed with retained completion dates.

[Pass 54: Reviewed source snapshots](IMPLEMENTATION-54.md) keeps an open comparison fixed until the consultant explicitly loads changed sources, preserves reasoning, and binds updates to reviewed references. Real browser reconciliation and republishing passed; Goals continuity and Review publication content are the next originating-workflow priorities.

[Pass 55: Goals editor continuity and valid saves](IMPLEMENTATION-55.md) preserves unsaved edits across refreshes, requires explicit loading of changed goals, guards navigation and fixes the rejected update payload. Thirteen tests, both builds and an isolated real browser save passed; accepted-save and cycle-confirmation recovery remain next.
