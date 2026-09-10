# Findings and diagnosis

Severity: **P0** blocks use of a central production service; **P1** materially breaks business intent or a core workflow; **P2** reduces usability, maintainability, or operational confidence. Evidence is explicitly **code-confirmed**, **browser-observed**, or **unverified**. None of these labels means an exploit or regulatory violation has been established.

## F01 · P0 · Real credit reports cannot complete the extraction path

**Code-confirmed.** `apps/api/src/ai/creditReportProcessing.ts` parses the marker `CREDIT_SYNTHETIC_3_BUREAU_V1` and JSON fixture content; unsupported documents cannot become the expected normalized report. `apps/api/src/server.ts` constructs the durable runtime with `Phase7DeterministicProvider`; `ai/durableCreditReportPipeline.ts` supplies fixture processing. The active entrypoint is not merely a test helper.

**Impact:** the paid Credit Review service has no demonstrated real Experian three-bureau PDF ingestion. A successful seeded review does not prove a real client's report can be processed.

**Complete it:** approved real/redacted report corpus; document safety and format/date/bureau validation; extraction with page/field provenance and confidence; missing/ambiguous account resolution; analyst verification; rejection/reupload and resumable processing; no entitlement double-consumption. Fixture providers must be test/development-only and refused by production startup. Gates A3/A4.

## F02 · P0 · The strategy AI is a fixture, not client-specific assistance

**Code-confirmed.** `apps/api/src/strategies/ai.ts:14` returns the same themes, opportunities, cautions, and research for different clients; the only input use is `Boolean(input.context)`. Metadata says `deterministic-phase7` / `fixture-v1`. The running server selects that provider. Other registered AI processes need equivalent adapter-by-adapter verification.

**Impact:** the approved goal of reducing consultant research and preparation is not delivered. Manual fallback is valuable during outages but cannot be the normal implementation of the promised assisted workflow.

**Complete it:** real provider transport, typed input/output, client-specific retrieval and evidence, candidate/sequence proposals, confidence and exception handling, evaluation corpus, cost/latency limits, cancellation, retries, replay, and explicit consultant approval. Never let model text bypass domain commands. Gates A3/A6/A7.

## F03 · P0 · No production email path is assembled

**Code-confirmed.** `notifications/emailProvider.ts` requires injected SMTP/external adapters. `server.ts:40` calls it without adapters; `apps/worker/src/server.ts` rejects non-console delivery. Environment validation disallows console email in production. Consequently, selecting any supported production email option does not yield a working assembled server/worker delivery path.

**Impact:** account verification, password recovery, and service notifications are not deployable as configured. The console provider records acceptance without delivering mail.

**Complete it:** assemble both approved SMTP and external delivery paths, secret references, domain configuration, preview/templates, bounce/failure handling, idempotent delivery and retry, end-to-end verification/reset links. Prove provider delivery from the deployed worker, not only an injected unit-test transport. Gates A3/A10/A12.

## F04 · P1 · Home reports Plan count as unfinished actions

**Code-confirmed and browser-observed.** `apps/api/src/journey/routes.ts:52` calls `prisma.plan.count(...)`; line 122 exposes that as `openActionCount`. In the same isolated fixture, Home/Client 360 showed one Plan action while the Plan screen showed 3/3 completed.

**Complete it:** derive relevant actionable/awaiting-verification counts from the shared Plan projection, with explicit filtering rules and version. Verify the same answer on Home, Journey, Plan, CRM, and embedded service views after changes. Gate A2.

## F05 · P1 · Current focus and progress are disconnected from active restrictions

**Code-confirmed and browser-observed.** `journey/projection.ts` maps legacy `ApplicationCycleStage` directly to focus. The seeded Home says “Review your application sequence,” owner You; the active Round says source context must be reviewed by the consultant and Strategy is stale. The Round path nevertheless marks Strategy/Scheduling complete and Live active. Four foundation milestones all show completed with “Canonical milestone available.”

**Impact:** the interface assigns the wrong next step and overstates progress. Source staleness is detected elsewhere, which is worth preserving; no unsafe command execution was demonstrated.

**Complete it:** one authoritative next-action projection consuming Round/Review/Plan/restriction state, permission, owner, blocked reason and deep link; milestone state must be factual, not record-existence. Do not use cycle-start time as a “confirmed” freshness signal. Gate A2.

## F06 · P1 · Plan authoring can reconstruct dependencies from display order

**Code-confirmed; authoring UI inspected.** `apps/web/src/pages/PlanPages.tsx:156` builds the save payload with source Review/Profile version hardcoded to 1, no source Goal revision, and a dependency chain derived from the current `items` array. Yet the UI says reordering does not change prerequisite truth. The reconcile button increments the current source Profile version rather than selecting an actual source revision.

**Impact:** the UI contract and submitted authoring payload disagree. Arbitrary existing branching dependencies and source provenance cannot safely round-trip through this editor. Backend rejection could prevent some invalid saves; this audit did not mutate a published Plan to prove data loss.

**Complete it:** independently modeled display order/dependency graph, source revisions from the server, bounded condition authoring, completion-mode schemas, outcome mapping, draft autosave/conflict recovery, exact client preview and verification queue. Gate A5.

## F07 · P1 · Live invalidation misses the published Credit Center

**Code-confirmed.** `apps/web/src/LiveUpdates.tsx:32` maps review/profile events to `credit-center`, `reviews`, `review-workspace`, `credit-profile`; `pages/PublishedCreditCenterPages.tsx:76,89` queries `published-credit-center` and `consultant-published-credit-center`. Those roots are not included.

**Impact:** publication updates can leave an already-open published view stale until another refresh/refetch trigger. Review every query root, not just this one.

**Complete it:** typed shared query-key factories and event contracts; tests with two authenticated clients and an actual commit; reconnect reconciliation and access-revocation verification. The Redis-to-SSE bridge exists in `realtime/runtime.ts`; this is **not** a claim that all multi-instance fan-out is absent. Gate A2/A8.

## F08 · P1 · Visual archetypes are labels over essentially one container

**Code-confirmed and browser-observed.** `components/common/ProductFoundation.tsx:39` renders the same rounded gradient box across named archetypes. Desktop and 390px mobile inspection showed oversized metric typography used for text/statuses, repeated dark rounded cards, and long stacks. Shared components include useful visuals, but using them does not establish useful hierarchy.

**Complete it:** genuinely distinct compositions: a focused client overview; source/decision workbench; compact operations table; research comparison; time-based calendar; single-application live console. Establish density/spacing/radius/type by role and purpose. Use charts only for questions supported by data, not decoration. Gate A1 and every subsequent screen gate.

## F09 · P1 · Copy describes the implementation instead of helping the user

**Browser-observed across client/CRM and code-confirmed.** Examples: “Your verified current focus and the next honest step”; “Continue Review your application sequence”; “factual target”; “Canonical milestone available”; “Deterministic totals stay separate…”; “append-only ledger”; “governed request”; “without fabricated client summaries.” These are not isolated typos.

**Complete it:** product glossary and state-specific copy inventory. Every primary surface answers where I am, what changed, what it means, who acts next, and what to do. Internal policy/architecture prose belongs in operational documentation or contextual staff detail. See REQUIREMENTS.md. Gate A1, applied across all waves.

## F10 · P1 · Saved views are not the approved cross-device feature

**Code-confirmed.** `components/common/EaseOfUse.tsx:5` stores view state in `sessionStorage`. No server Saved View model/API was found in the inspected schema and route inventory. POAR decision PD4 explicitly requires per-user server-backed views across devices.

**Complete it:** per-user view records, resource/role scope, filters/sort/columns, named save/update/delete/default, optimistic concurrency, URL deep links and device/session restoration. Keep ephemeral scroll separate. Gate A2/A10.

## F11 · P1 · Calendar configuration is a preset button, not an operating tool

**Code-confirmed and browser-observed.** `pages/LivePages.tsx` offers “Set Monday–Friday, 9 AM–5 PM ET” and a list of appointments. It does not present the planned complete availability/calendar workspace.

**Complete it:** editable weekly availability, timezone, exceptions/leave, buffers and booking windows, calendar day/week/list views, reschedule/cancel/no-show, collision prevention, provider connection/sync diagnostics, client time conversion and reminders. Preserve the internal appointment as authority. Gate A8.

## F12 · P1 · Strategy and live supervision lack the planned operating experience

**Browser-observed; source-reviewed.** Strategy is a long sequence of form sections, stock AI context, product rows, shortlist fields and move-up/down controls. The live console has presence chips, Evaluate/Pause/End buttons and messages, but does not provide a persistent cross-CRM supervision panel in the inspected shell. The global urgent-work badge is not the planned active-session dock. A stale Round can still display “Ready for supervised work”; domain release rejection was not exercised.

**Complete it:** contextual evidence/brief, research candidates, compare tray, visual sequence/rules editor, final client preview; persistent live session dock with current step, client identity, attention state and return action. Client sees one released card with Apply/Skip/Help; approved rules advance normal cases and surface exceptions. Gate A7/A8.

## F13 · P1 · Public acquisition and trust experience is absent

**Code-confirmed.** `App.tsx:110` redirects `/` to Goal Intake. There are no actual public Home, service-methodology, pricing, FAQ/trust/disclosure pages in the route tree. Register has a terms/privacy acceptance label without linked public policy pages in the inspected component.

**Complete it:** public business-value narrative, service fit/deliverables, pricing linked to configured products, coherent goal-first entry, editable finalized disclosures and agreement versions. No invented testimonials, outcome guarantees, or unsupported business claims. Legal/business approval is a release dependency, not something this technical audit certifies. Gate A11.

## F14 · P2 · Credit Center and portfolio presentation do not explain provenance

**Browser-observed and source-reviewed.** Profile uses `Object.entries(profile)` for part of its display (`PublishedCreditCenterPages.tsx:259,309`), giving data-shape-driven order. Cards reported “Not yet reviewed” despite a published Profile. Card totals and report totals differed without sufficiently clear scope/current-vs-report explanation. A difference is not itself an arithmetic error.

**Complete it:** typed information architecture: bureau/model/date, utilization and balance/limit, accounts, inquiries and notable factors, explicit source date versus current user updates, business/non-reporting scopes, accessible charts and detail drawers. Historical versions must be inspectable and explain meaningful changes. Gate A4/A6.

## F15 · P2 · Catalog research is too thin for comparison and decisions

**Browser-observed.** Explore showed basic filters/search and four synthetic products, no client compare control, field names such as `annual Fee`/`purchase Apr` with weak unit formatting, repeated warning text and generic artwork. Wishlist was a plain list disconnected from a rich research flow. Synthetic names are intentional fixtures; this is not a finding of invented live issuer data.

**Complete it:** governed real product/offer ingestion, source freshness, useful filter facets, normalized costs/benefits, imagery with provenance, consistent details, consultant comparison and persistent Wishlist context. Client comparison is a possible enhancement, not a missing requirement of the original Explore contract. Consultant decisions reference exact offer/insight versions. Gate A6.

## F16 · P1 · Several Admin workflows stop at creating disabled records

**Code-confirmed and subsequently browser-observed.** `AdminWorkflowPage.tsx` creates disabled rules with an `ALWAYS` condition and fixed reason; it offers history but no complete review/test/activate lifecycle. `AdminNotificationsPage.tsx` similarly creates disabled templates without a complete preview/test/activate authoring flow. `AdminIntegrationsPage.tsx` presents status/toggle, not a full non-payment setup/test workbench. Backend capabilities must be mapped before new work is added.

**Complete it:** bounded configuration forms, diff/preview, validation, effective version, connection tests, safe activation/rollback, error visibility, and proof the runtime consumes the activated configuration. Existing reviewed-action dialogs and optimistic updates are useful foundations. Gate A10.

## F17 · P2 · Reporting presents record-group counts rather than decision metrics

**Code-confirmed.** `AdminReportsPage.tsx` renders generic section/status rows and an “Operational record groups” hero. This does not answer the planned questions about revenue, delivery throughput, bottlenecks, processing failures, service utilization and support load.

**Complete it:** metric dictionary with definitions, time windows, denominators, drill-down and permission scope; trends and distributions where informative; no unsupported derived approval predictions. Reconcile commerce totals with the ledger. Gate A10.

## F18 · P2 · Frontend boundaries and performance need deliberate repair

**Build-confirmed and source-reviewed.** Production build succeeded but the main web bundle is approximately 1,321 kB minified /342 kB gzip, with an additional shared chunk approximately 336/101 kB. Most client and CRM pages are eagerly imported; Admin pages are lazy. ReviewPages is roughly 217 kB of source. A large bundle is not by itself a production outage, but it is a measurable performance risk.

**Complete it:** route/domain boundaries, typed projection/command clients, focused components, removal of obsolete duplicated screens, purposeful lazy loading and performance budgets measured on representative devices. Preserve the accepted stack. Gate A2/A12.

## F19 · P2 · Local setup and runtime instructions are inconsistent

**Runtime-confirmed.** The inherited `.env.example` contains empty optional SMTP variables that failed environment validation when copied verbatim. Some README/runtime instructions describe earlier phases. Generic Compose/runtime scripts point to shared defaults and must not be used for Astra.

**Complete it:** fail-safe Astra tooling and workspace instructions now; later reproducible environment validation, deployment manifests, separate workers, secret management and disaster recovery. An S3-capable abstraction does not mean S3 is wired: `createDocumentStorageRegistry()` has no injected client in the entrypoint. Local private storage is the approved initial deployment choice, so future S3 completion is a migration requirement rather than grounds to replace launch storage now. Gate A0/A12.

## F20 · P1 · The acceptance method allowed superficial completion

**Evidence-reviewed.** Existing visual-maturity tests include text/link assertions and prior acceptance matrices label many screens PASS across broad dimensions. Those checks cannot establish composition, interaction quality, factual consistency, real integrations, or failure recovery. The new local frontend baseline run and its actual outcome are recorded in EVIDENCE.md; prior completion claims are not inherited as certification.

**Complete it:** every screen and workflow has a state/role/device matrix and explicit evidence, including incorrect/empty/long data, concurrent changes, stale/revoked access, provider outage, recovery, and realistic tasks performed without developer explanation. Gate all waves.

## Important unverified items

These are launch obligations, **not newly proven defects**: real PayPal/Stripe/Bank of America production credentials and hosted checkout/capture/refund/dispute reconciliation; external calendar consent and sync; deployed backup/restore; load/security/accessibility assessment; malware scanning effectiveness; email deliverability; legal policies/agreements; live simultaneous client/consultant command races; report preview behavior behind the final reverse proxy. A report content link is relative while local web/API origins differ; verify preview routing in A3/A4 before declaring it broken everywhere.

The initial Admin MFA approval limitation was resolved by explicit user authorization. The [completed Admin browser pass](ADMIN-BROWSER-AUDIT.md) adds F21–F24 and representative coverage of all 31 implemented Admin paths. Full transactional/state acceptance remains unverified. No production credentials, real reports, real payments, external mail, or deployment were used.

## Additional Admin findings F21–F24

See [Admin browser audit](ADMIN-BROWSER-AUDIT.md) for reproduction evidence and completion requirements:

- **F21 · P1:** Catalog conflict counts exclude candidates already in CONFLICT state; three visible conflicts produce zero in Dashboard/System Health.
- **F22 · P2:** Client user details display staff-only role/MFA controls and misleading enrollment text.
- **F23 · P1:** Catalog approval offers no actual field/evidence review or conflict-resolution workbench and posts a fixed review reason.
- **F24 · P2:** Gateway detail routes exist but are not discoverable from the Payments navigation/screen.
