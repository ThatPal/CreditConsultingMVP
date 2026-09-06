# APC-2 independent authenticated-product audit

Status: **INDEPENDENT AUDIT COMPLETE — CORRECTION WAVES REQUIRE REVIEW**.

Audit baseline: `c0da7e289b1df3560e37f364fca75861c1e481da` on
`rapid/phase17-18-operations-public`. Date: 2026-09-04.
No broad correction wave, merge, or Phase 18 work. The user separately authorized
bounded access-unblocking repairs and the immediate P0 log-redaction repair during
this audit. They are included on this review branch; the accepted baseline above
remains the audit starting point and `ai-enabled` is unchanged.

## Evidence and access

Read canonical APC-1 and APC-2, Document 13 authenticated screen contracts,
Document 06 UX/navigation, and the Phase 1–17 portion of Document 14 roadmap.
Relevant accepted amendments and Phase1–17 completion/checkpoint evidence were
reconciled as historical evidence, never as proof that the current product passes.

- [APC-1 baseline](https://docs.google.com/document/d/1vvRY9HQwT9P9jbzc3f5uZ34A-ltK4tHxFVzt2jMgmRM/edit)
- [APC-2 package](https://docs.google.com/document/d/1II_KKbgl9b0o6d9Du2Dng7GZZzotNBbWa6d9UbbiOXM/edit)
- [Document 13](https://docs.google.com/document/d/13BhbHPY8FEOFfPC7XEywe04OxLJvJ5RakB9DbPszKUo/edit)
- [Document 06](https://docs.google.com/document/d/1qaP7SFEW48jZ4jPKxOpDJrY7tJ7Ovmfj3iv3XRhp8vw/edit)
- [Document 14](https://docs.google.com/document/d/1O_teMErEUgYSq5ja8N2B3aKfgbQbypWSF1-ir5-evbc/edit)

The review web/API were initially unavailable. Restored the existing compiled API
on 3008 and Vite on 5185 against the existing Credit-only database
`credit_strategy_phase1316_checkpoint` (PostgreSQL 5433; Redis 6380).
Did not run the bootstrap script because it also reseeds/resets staff MFA.
Did not reset accounts, migrate, reseed, or access another project's database.
Worker recovery and end-to-end realtime remain correction acceptance requirements;
the audit found material gaps rather than treating them as completed proofs.

Actual browser evidence: the restored browser redirects the existing Consultant
session to `/mfa?mode=enroll&returnTo=%2Fcrm` and renders password confirmation,
Set up authenticator, and Cancel setup and sign out. Staff enrollment is pending
user completion. This is **not proof of an MFA defect**. Previous Phase 17 claims
of a completed browser gate cannot substitute for successful three-role access
in this audit. No staff MFA bypass or reset performed.

Client, Consultant and Admin were reviewed in the actual authenticated browser.
The screen crosswalk records where absent workflow fixtures prevent a successful
end-to-end proof. Large-volume, responsive/keyboard and workflow continuity gaps
are findings/acceptance requirements, not unreported assumptions.

## Independently inspected baseline evidence (provisional dispositions)

Paths below are relative to this repository. Line references refer to the accepted
head. Static confirmation is distinguished from browser verification.

| Finding | Provisional disposition | Severity | Direct evidence / refinement |
| --- | --- | --- | --- |
| APC-001 | CONFIRMED (code) | P1 | `apps/web/src/layouts/AppShell.tsx:139` renders only Overview, Commerce, Integrations Admin groups; registered groups outside that set are omitted. Browser visibility check pending. |
| APC-007 | CONFIRMED (code) | P1 | `apps/web/src/pages/PlanPages.tsx:54–97`: editor starts from three hardcoded items, fixed PREPARATION/source version values; dependencies are regenerated from display order; reconciliation increments a profile version rather than selecting actual source evidence. This is behavioral integrity, not merely missing fields. |
| APC-008 | CONFIRMED (code) | P2 | `PlanPages.tsx:129` holds one outcome text state for every available item. Client projection renders flat cards, not the specified Current Focus/Path/Guidance organization. Browser editing test pending. |
| APC-014 | PARTIALLY CONFIRMED / REFINED (code) | P1 | `CardCatalogPages.tsx` has current offer freshness warnings and approved insight summaries, so these should be preserved. Product cards use a generic icon; Explore exposes search only. Portfolio report/current comparison still to inspect independently. |
| APC-015 | CONFIRMED (code) | P2 | `CardCatalogPages.tsx` operations render candidate/insight arrays without paging/filter controls. Backend limits and conflict-resolution capabilities still to reconcile. |
| APC-018 | CONFIRMED (code) | P2 | `LivePages.tsx:30–252` uses slot cards, calendar appointment list and a minimal appointment detail. Actual reschedule/availability workflows require further tracing. |
| APC-020 | CONFIRMED (code) | P1 | `AdminReportsPage.tsx` renders each section with JSON.stringify in a pre element and fixes the range to 30 days. |
| APC-023 | CONFIRMED (code) | P1 | `LivePages.tsx:279–325` stores snapshots in local state and reloads after a 30-second HTTP presence heartbeat. `LiveUpdates.tsx` only invalidates React Query caches. No live-session subscription is present in the inspected component. Reconnect timing proof pending. |
| APC-024 | CONFIRMED (code) | P1 | The same `LiveSessionPage` serves Client and Consultant, with consultant controls conditionally inserted. It lacks the specified sustained three-zone consultant execution/context workspace. |
| APC-025 | CONFIRMED (code) | P1 | `PostRoundPages.tsx` shares one outcome and limit across every follow-up and provides the same result form for every kind. Owning domain schemas must drive the correction. |
| APC-026 | CONFIRMED (code) | P1 | `PostRoundPages.tsx` exposes prepare/approve but no analysis edit form; separate summary/follow-up/analysis/finalization routes. Preserve immutable history and finalization validator. |
| APC-032 | CONFIRMED (code) | P1 | `AdminNotificationsPage.tsx` submits enabled:false and has no activation/preview/variable controls. API support still to inspect. |
| APC-035 | CONFIRMED (code) | P1 | `AdminSettingsPage.tsx` supports only four boolean safety switches, not the broader typed settings contract. Do not generalize switches into arbitrary configuration writes. |
| APC-038 | CONFIRMED (code) | P1 | `LiveUpdates.tsx:16` invalidates all queries except current-user on every refresh; local-state pages do not consume it. Needs domain-targeted, authorization-aware invalidation and reconnect proof, not a second source of truth. |
| APC-041 | CONFIRMED (code) | P1 | `AdminIdentityPages.tsx` exposes grant history/revoke and assignment deactivate, not create/change assignment or grant lifecycle. Preserve staff/client authority separation. |
| APC-042 | PARTIALLY CONFIRMED / REFINED (code) | P2 | User list already shows MFA enrollment and session counts; it filters name/email, role and status. Missing advanced filters are not evidence that the MFA status display is absent. |
| APC-049 | CONFIRMED (code) | P1 | Inspected AppShell header contains role label, notification and account controls but no global scoped client search. |

The following tables extend this initial pass. Across all three tables, each
APC-001 through APC-053 has one explicit independent disposition.

### Additional independently reconciled dispositions

| Finding | Disposition | Severity | Evidence / refinement |
| --- | --- | --- | --- |
| APC-002 | CONFIRMED | P2 | Actual Credit Center navigation has Overview/Profile/Report/Analysis/History but no Plan; `/app/plan` is separately registered. Document13 explicitly makes Plan PORTAL-08 within Credit Center. Preserve reusable contextual Plan links. |
| APC-009 | CONFIRMED | P1 | Actual Jordan Client360 is a long stack. `App.tsx` lacks dedicated Journey/Services/Timeline/Support client subroutes and `ClientContextPages.tsx` does not implement the seven-tab persistent context contract. |
| APC-010 | PARTIALLY CONFIRMED / REFINED | P2 | Dashboard loads actual metrics and owning-module links. Its assigned-only OPEN/IN_PROGRESS count differs legitimately from all-accessible OPEN/IN_PROGRESS/WAITING Support queue count, but its wording does not explain that scope. Counts also use legacy assignedConsultantId rather than the canonical assignment/grant discovery used elsewhere. Do not simply force the two counts equal. |
| APC-011 | CONFIRMED | P2 | After routing repair, actual queue shows12 Support-only items. `operations/routes.ts` explicitly constrains sourceType SUPPORT_CASE. Family views/context for other completed-phase work are not surfaced. Reconcile owning-domain event producers before expanding the queue. |
| APC-012 | CONFIRMED | P2 | Actual published Profile renders scores/counts/balances in one dark stacked card; Overview labels recommendation Current decision. Preserve published-only projection and improve semantic grouped financial presentation rather than exposing drafts. |
| APC-016 | CONFIRMED | P2 | Actual Plan overline PORTAL-08 and Live Sessions overline CRM-18 expose internal screen identifiers. |
| APC-027 | CONFIRMED | P1 | `MajorReadinessPages.tsx` consultant workspace exposes recommendation/explanation and coordination buttons, without source/context assessment, embedded preparation authoring, history comparison or surfaced mutation failures. Backend supports more commands than the UI exposes. |
| APC-028 | CONFIRMED | P2 | Client intake in `MajorReadinessPages.tsx` has type, free-text timing and context only, with no update form once a case exists. Owning routes support updateCase. Required richer intent fields need owning-domain contract reconciliation, not arbitrary UI-only state. |
| APC-030 | CONFIRMED | P2 | `ClientStrategyPage` shows version plus sequence role/reason only; no scheduling handoff or preparation actions. It does correctly hide stale guidance and unapproved recommendations. |
| APC-031 | CONFIRMED | P1 | Browser AI Processes exposes two-field disabled-version creation plus eleven existing rows; no activation/preview/profile editing. Phase17.3B requires governed lifecycle. |
| APC-033 | CONFIRMED | P2 | Actual Source Registry has disabled registration and Disable only. No policy test or detail/history workflow. Preserve HTTPS/allowlist security; do not create a permissive URL fetcher. |
| APC-034 | CONFIRMED | P2 | Browser shows three disabled scheduler definitions without lifecycle/detail controls. CAPC-013 separately captures missing actual execution, not just UI thinness. |
| APC-036 | CONFIRMED | P2 | Browser Integrations has a single untested email-provider row and Enable. `AdminIntegrationsPage.tsx` has no health-test/configuration workflow or request error presentation. |
| APC-037 | PARTIALLY CONFIRMED / REFINED | P2 | Security history has real bounded pagination/search/type/severity and detail metadata, verified in-browser. Readable summaries, meaningful permitted response actions and authorized cross-links remain deficient; do not replace immutable event records. |
| APC-046 | PARTIALLY CONFIRMED / REFINED | P2 | Gateway destinations are separate navigation entries, but Phase17.3F explicitly excludes payment-provider implementation and permits links to Phase5 ownership. Consolidate discovery without duplicating payment configuration or interpreting the generic integration page as its owner. |
| APC-050 | CONFIRMED | P2 | Inspected shell has notification/account controls but no persistent live-session panel. Actual Live Sessions shows a separate empty list; this does not prove populated-session behavior. |

### Remaining baseline dispositions (code review; browser gaps remain explicit)

| Finding | Disposition | Severity | Evidence / refinement |
| --- | --- | --- | --- |
| APC-003 | CONFIRMED | P2 | `navigation.tsx` registers Catalog and Insights as separate CRM primary destinations; no single Cards research area. Document06/13 require a coherent Cards destination. |
| APC-004 | CONFIRMED | P2 | Actual Admin drawer and `navigation.tsx` group unrelated AI/rules/retention/settings under Overview; identity/catalog groups are omitted by the renderer. Repair discovery before reorganizing module ownership. |
| APC-005 | PARTIALLY CONFIRMED / REFINED | P2 | Actual role labels are Client portal/Consultant CRM/Admin operations, which are useful. Generic workspace copy and internal overlines remain; preserve clear role identity rather than renaming everything wholesale. |
| APC-006 | PARTIALLY CONFIRMED / REFINED | P2 | Actual Payment detail has Back to payments and Support detail Back to queue. However persistent client context/breadcrumbs and restored filtered-return state are inconsistent across Client360/deep workspaces. Not all back navigation is absent. |
| APC-013 | CONFIRMED | P2 | `JourneyPages.tsx` renders generic current/history stacks, metadata and a bounded-history notice without older-history retrieval. Preserve truthful current focus; improve lifecycle/context navigation rather than inventing future progress. |
| APC-017 | CONFIRMED | P2 | `Phase11Pages.tsx` Round copy says later steps await their owning phase, despite Phases13–16 being complete. Replace development-phase language with actual domain prerequisites. |
| APC-019 | CONFIRMED | P2 | Browser Review404 suggested MFA; catalog errors have no retry action; Calendar/Live promises lack surfaced failure transitions. Invalid claim body produced500 in focused HTTP probe. Preserve correct session-expiry behavior while classifying domain/network/validation failures. |
| APC-021 | CONFIRMED | P2 | Actual Reports JSON, Settings raw keys, AI process identifiers and Notification delivery enum lines expose implementation structure without readable operational interpretation. Raw identifiers may remain secondary diagnostic detail. |
| APC-022 | CONFIRMED | P2 | `AdminIdentityPages.tsx` and `AdminIntegrationsPage.tsx` use browser confirm for role/MFA/integration changes; other surfaces use immediate buttons. Shared governed effect/reason/step-up presentation is incomplete. |
| APC-029 | CONFIRMED | P2 | `RoundPage` composes readiness/preparation/major-check and generic next-step links, not the full Strategy→Appointment→Live→Results→Follow-up lifecycle hub required after completed phases. |
| APC-039 | PARTIALLY CONFIRMED / REFINED | P2 | Shared DataNavigation has bounded numbered pages, aria-current, live counts and narrow-screen wrapping; Documents and picker pagination actually work. Dense operational and history-specific patterns remain missing. Do not replace proven pagination with unbounded client filtering. |
| APC-040 | PARTIALLY CONFIRMED / REFINED | P2 | DocumentPicker, Support composer and Strategy approval dialog exist. Plan outcomes, Major coordination and many Admin consequential actions lack the specified contextual interaction units. Inventory by task, not an assumption that every dialog is absent. |
| APC-043 | CONFIRMED | P2 | `AccountPage.tsx` provides profile/phone/timezone and security link but no communication/privacy-preference surface. Existing timezone selection is richer than a raw text input and should remain. |
| APC-044 | PARTIALLY CONFIRMED / REFINED | P2 | `NotificationsPage.tsx` preserves grouping/read/error/retry/load-more. Filters are only All/Unread/Support; semantic categories/deep-context coverage remain narrower than the product. |
| APC-045 | CONFIRMED | P2 | Actual Payments has provider/state/search and detail, but refund detail is amount-only with plain history lines and no effect/reason preview. CAPC-018 separately captures search cache identity. No refund or reconciliation invoked during audit. |
| APC-047 | CONFIRMED | P2 | Identity/integrations native confirmation versus Strategy's explicit dialog demonstrates inconsistent consequential-action presentation. Reuse interaction plumbing, not a generic bypass of domain-specific authorization. |
| APC-048 | CONFIRMED | P2 | Actual Plan AVAILABLE/LOCKED, Support OTHER, AI identifiers and report states are raw or mechanically humanized. Context-specific vocabulary is needed; state authority remains server-owned. |
| APC-051 | CONFIRMED | P1 | `ReviewPages.tsx` manual override submits fieldPath/effectiveValue; exception resolution supplies a fixed generic reason. Preserve evidence immutability and publication validators while making verification typed and attributable. Actual seeded workspace currently blocked by missing report, not MFA. |
| APC-052 | PARTIALLY CONFIRMED / REFINED | P2 | Legacy workspace and older Administration/ApplicationCycles modules remain; `App.tsx` uses newer alternatives. A complete import/reachability check is required before deletion; some older Readiness routes are still active and cannot be called dead solely by age. |
| APC-053 | CONFIRMED | P2 | Actual Client360/Plan/Profile/Admin configuration plus inspected Round/Major/Live components repeatedly use generic card stacks for different tasks. Shared tokens alone do not satisfy distinct financial, lifecycle, comparison and sustained-workspace contracts. |

All53 baseline IDs now have an independent disposition across the tables above.
This does not close outstanding browser/fixture, complete sprint-contract
crosswalk, concurrency or responsive/keyboard evidence requirements. No baseline
was marked satisfied solely because an earlier completion report said so.

### Recovered canonical amendments

Read the full FQ-1 Documents/Support Upload UX and Auth Routing/Volume-Safe
Lists/Pickers follow-ups. They explicitly authorize generic Documents uploads
and new-file Support-ticket attachments through the canonical Document domain.
Do not remove these based on older workflow-only wording. Reply attachments
remain conditioned on the owning schema; this amendment does not itself authorize
inventing message-level attachment semantics.

Sources: [upload amendment](https://docs.google.com/document/d/1NZIqtVk1_PBtK8HE6BPr_dqR6_cHfSx5SbV8lNx-7IE/edit),
[volume/auth amendment](https://docs.google.com/document/d/1KRGu3MO3ryMZD-edRB-t7KOfYlVbIv4qIAMN_bviJvo/edit).

## New independent findings — provisional CAPC register

| ID | Severity | Finding and evidence | Required acceptance proof |
| --- | --- | --- | --- |
| CAPC-001 | P1 | Issuer handoff is absent from inspected Live path. `LivePages.tsx:354–363,490–491` labels OPEN as “Apply on issuer site” but only POSTs the action and reloads. `apps/api/src/live/applications.ts:183–215,293–312` returns product name/slug, offer facts and status, not an issuer handoff URL. | Trace canonical frozen/allowlisted issuer URL through API and actual browser handoff; preserve one-card release and safe return/result capture. No invented issuer URL. |
| CAPC-002 | P1 candidate; concurrency proof pending | `applyApplicationAction` reads status outside its transaction (`applications.ts:228`), checks that captured status (`:287`), then updates by id only (`:294`). Consequential command helper provides idempotency per operation/key but no resource lock or serializable transaction. Distinct concurrent OPEN/SKIP calls therefore appear able to act on the same RELEASED snapshot. Route-level serialization and real race must be checked before final confirmation. | Competing OPEN/SKIP with distinct keys commits one legal transition; no contradictory history/outbox. Do not claim this proof has run. |
| CAPC-003 | P1 | Existing Plan draft is not hydrated into the authoring form: query response contains plan/version metadata, while title/items initialize to defaults (`PlanPages.tsx:63–66`). Saving an existing plan sends that starter draft. This is distinct from general editor richness. | Reload a nontrivial draft, verify exact items/paths/dependencies/content remain, then edit one field without overwriting unrelated content. |
| CAPC-004 | P2 | Admin settings render “Enabled” when query data is absent (`current?.value !== false`) and expose controls without query loading/error handling. Mutation failure is also not displayed. Failure can masquerade as an authoritative enabled state. | Failed/slow GET and rejected mutation render honest unknown/error state, preserve last confirmed state, and offer recovery. |
| CAPC-005 | P2 | Catalog detail finds a product by fetching the whole catalog and searching locally (`CardCatalogPages.tsx`, CardDetailPage), rather than a scoped detail query. Under a bounded catalog API this risks false not-found; under an unbounded API it is volume-unsafe. | Establish API cap, then open a product outside page one with a large fixture and obtain correct detail without fetching all products. |
| CAPC-006 | P2 | Calendar/appointment loading requests (`LivePages.tsx:161,210`) have no catch/error transition; rejected calls leave a spinner. Several live command promises also lack surfaced error/pending state. | Inject denied/stale/unavailable responses and show actionable recovery instead of indefinite loading or silent rejection. |
| CAPC-007 | P2 | Staff notification popover has no View all destination (client-only at `AppShell.tsx:413`), and absent data is presented as “No notifications yet” (`:422`). Staff history reachability and backend paging must be checked. | Staff can reach complete permitted notification history; network failure is not an empty inbox. |
| CAPC-008 | P1 | Actual Credit HTTP request logs contain Cookie headers, including session credentials. `apps/api/src/app.ts` creates a separate pino-http logger with only level, request ID and custom properties; redaction on another logger does not govern this instance. Do not include raw logs in audit evidence. | Configure/test redaction at the actual HTTP logger boundary for Cookie, Authorization and Set-Cookie; maintain useful request correlation without secrets. The authorized immediate P0 repair is included on the review branch. |
| CAPC-009 | P1 | User reproduced enrollment returning to password confirmation. Read-only DB check found account `twoFactorEnabled=false` with retained authenticator `verified=true`. Better Auth preserves that flag during enable, then skips account activation in verify-totp. A new integration case reproduced the inconsistency. | Bounded repair below passes focused tests; final actual-browser verification awaits the user's retry. |

### Consolidated CAPC disposition matrix

| Finding | Disposition | Severity | Final audit conclusion |
| --- | --- | --- | --- |
| CAPC-001 | CONFIRMED | P1 | Live OPEN records state but has no governed issuer handoff URL/path. |
| CAPC-002 | PARTIALLY CONFIRMED / REFINED | P1 | Stale read/update-by-ID race exists structurally; real competing-action proof is required in the integrity wave. |
| CAPC-003 | CONFIRMED | P1 | Plan editor initializes starter items instead of hydrating the existing draft. |
| CAPC-004 | CONFIRMED | P2 | Settings absence/failure can appear as enabled and mutation failure is not presented honestly. |
| CAPC-005 | CONFIRMED | P2 | Detail searches a whole catalog response instead of using a scoped detail contract. |
| CAPC-006 | CONFIRMED | P2 | Scheduling/live requests can remain indefinitely loading or fail silently. |
| CAPC-007 | CONFIRMED | P2 | Staff notification history is not reachable from the shell and failure can appear empty. |
| CAPC-008 | CONFIRMED, IMMEDIATE P0 REPAIR VERIFIED | P0 | Actual HTTP logger recorded Cookie headers/session credentials. HTTP-boundary redaction is now locally configured and runtime-verified; retained-log handling/credential assessment remains operational follow-up. |
| CAPC-009 | CONFIRMED, BOUNDED REPAIR VERIFIED | P1 | Retained verified factor caused enrollment loop; repaired and verified for both staff roles without bypass. |
| CAPC-010 | CONFIRMED, BOUNDED REPAIR VERIFIED | P1 | Work Queue URLs omitted `/api/v1`; actual12-item browser path now verified. |
| CAPC-011 | CONFIRMED | P2 | Consultant Support filters lifecycle after server pagination, corrupting totals/pages and closed discovery. |
| CAPC-012 | CONFIRMED / REFINED | P1 | Seeded review404 is missing report aggregate, not MFA; UI classification and review fixture are both deficient. |
| CAPC-013 | CONFIRMED | P1 | ScheduledJobRun queue/outbox has no real allowlisted job executor/recurring scheduler. |
| CAPC-014 | CONFIRMED | P1 | WorkflowRule has CRUD/version state but no representative domain evaluator/exactly-once effects. |
| CAPC-015 | CONFIRMED | P1 | Retention covers expired sessions only and execute is not bound to a reviewed preview; document-byte eligibility/holds missing. |
| CAPC-016 | CONFIRMED | P2 | Admin audit event links Admin users into Consultant-only Client360. |
| CAPC-017 | CONFIRMED, BOUNDED REPAIR VERIFIED | P1 | Blanket strategy-router Admin denial shadowed later Admin operations; Dashboard/Payments now browser-verified while strategy denial remains. |
| CAPC-018 | CONFIRMED | P2 | Payment search is omitted from query key; actual search stayed stale until direct navigation. |
| CAPC-019 | CONFIRMED, BOUNDED REPAIR VERIFIED | P1 | Shared catalog reads used client-scoped middleware without a client parameter; all-role allow/deny tests and Client browser verified. |
| CAPC-020 | CONFIRMED | P1 | Major Readiness includeDraft prefers old approved recommendation; UI mislabels returned draft and lacks mutation state. |
| CAPC-021 | CONFIRMED | P1 | Live HELP produces ApplicationSession WorkItem while Work Queue admits SUPPORT_CASE only. |
| CAPC-022 | PARTIALLY CONFIRMED / REFINED | P1 | Overlapping poll/lease/CAS risk is code-confirmed; historical16–349attempt failures support urgency but do not prove sole causation. |
| CAPC-023 | CONFIRMED | P2 | Dashboard links to unregistered `/admin/system-health`. |

CAPC totals: one P0, fourteen P1, eight P2. Four bounded access findings were
authorized during audit; CAPC-009/010/017/019 are repaired, browser-verified,
and included on the review branch. Exact-head CI has not been run.

APC-2 permits immediate P0 safety correction. CAPC-008 therefore adds explicit
HTTP-boundary redaction for request Authorization/Cookie and response Set-Cookie.
Focused test verifies the exact redaction contract. A runtime probe used only
synthetic marker secrets; neither marker appears in the new log and two redaction
markers do. Credit API restarted only on3008 (PID35308); readiness reports both
PostgreSQL and Redis ready. No real credential value was emitted during proof.

Verification after all bounded changes: API app/routing15/15, auth13/13 on the
existing current isolated Credit Phase17 gate database, prior web Work Queue/
dashboard2/2, API and web typecheck/build, changed-file ESLint and diff check.
One initial combined auth invocation inherited an obsolete test DB missing the
current BetterAuthAccount.issuer migration and failed11auth cases; rerunning the
same auth file against the named current gate passed13/13. Do not present the
obsolete-schema run as a product-code regression or hide it as a success.
No CI or exact-head CI was run. The audit, bounded repairs, and evidence are being
committed and pushed to the rapid review branch only; no merge occurred.

## Authorized access-unblocking repair: CAPC-009

The user reported the loop during the requested manual MFA handoff and explicitly
asked for a fix before trying again. This is not permission for broad corrections.

- New regression parameterizes normal enrollment and a retained verified factor
  on an MFA-disabled account. Original code: normal case passed, retained-factor
  case failed (verified remained true).
- Successful `/two-factor/enable` now clears only the factor verification flag
  for the current, MFA-disabled staff user. It does not enable MFA, grant session
  assurance, skip a code, change the password, or alter enabled staff accounts.
- Tests require invalid-code denial and no assurance; valid enrollment must
  persist account MFA and session assurance; subsequent challenge and deliberate
  test-only reset/re-enrollment remain covered.
- API auth suite: 13/13 passed on isolated existing Credit gate database
  `credit_strategy_phase17_gate_20260904`, not the manual review database.
- Web auth/session regression: 5 files, 31/31 passed.
- API typecheck, API build, changed-file ESLint and git diff check passed.
- Restarted only the verified Credit API process on 3008; `/ready` reports
  PostgreSQL and Redis ready. No review account/database reset or seed performed.
- User completed fresh QR enrollment and confirmed completion. Independently
  observed actual `/crm` dashboard, then navigated Work Queue, Clients and
  Client 360 without an MFA redirect. Consultant browser access is now verified.
  CI was not run. Admin login subsequently succeeded too;
  actual security history shows enrollment completion and TOTP challenge success.

## Browser evidence after MFA repair

- CRM dashboard: 6 open work, 4 due today, 1 active client, 1 review, 0 readiness;
  mobile-width stacked metric cards and module links. No global client search or
  persistent live panel observed. This confirms real render, not metric accuracy.
- Clients: 25 authorized seeded clients. Page one contains Jordan Blake and
  Synthetic Client 01–19; Next changes URL to `?page=2` and contains Synthetic
  Client 20–24, with no duplicate across those two observed pages. This is a
  25-row pagination smoke proof, not a realistic high-volume stress proof.
- Client 360 (Jordan): contact/access, workspace buttons, Journey, Services,
  Support, timeline, businesses/relationships appear as a long stack, not the
  canonical persistent-header seven-tab workspace. It still describes completed
  modules as “future Client 360 modules.”
- Plan Builder: seeded Plan status ACTIVE/version1, but form displays the three
  starter items identified in static inspection. No save or approval performed.
- **CAPC-010 — P1, CONFIRMED:** Work Queue cannot load in the actual browser.
  Sanitized API log shows repeated GET `/consultant/work-queue?...` returning404.
  `PlatformPages.tsx:161,166` omit `/api/v1` from both list and claim URLs, while
  `app.ts` mounts `createOperationsRouter` at `/api/v1`. Fix both paths and add
  an actual application-mount regression, not only a mocked component response.
  No Work Queue correction performed during this audit.
- Consultant Support renders 13 active cases but total/pager reports14; detail
  opens with client reply/internal note, macros and advisory AI controls.
  `ConsultantSupportPage.tsx:131–161` sends no active exclusion to the server and
  filters resolved/closed rows after pagination. Resolved filter requests only
  RESOLVED although local predicate includes CLOSED. **CAPC-011 — P2:** correct
  server-side group predicates/counts; prove dense adjacent pages and closed-case
  discovery with a larger fixture. Do not reopen the separate stable-order fix.
- Calendar successfully renders an empty state in this seed (no appointments).
  This does not prove scheduling, rescheduling, presence or realtime behavior.
- Review queue shows a seeded INFORMATION_RECEIVED Review. Its guided Review link
  returns404 from the workspace API, while UI suggests access/MFA step-up.
  **CAPC-012 — P1 candidate:** reconcile seed/aggregate completeness and missing
  workspace response before blaming authorization. Correct error classification
  and prove an actual submitted-review browser path. No mutation performed.

## Additional backend completion findings

- **CAPC-013 — P1, code-confirmed execution gap:** Admin Scheduled Jobs POST creates
  `ScheduledJobRun` QUEUED and an outbox event, but repository search across API,
  Worker and shared packages finds no consumer of `scheduled-job.run-requested`
  or worker implementation advancing `ScheduledJobRun`. No recurring scheduler
  consumes these definitions. This is beyond APC-034's list/detail richness:
  17.3G requires allowlisted real execution, leases, retries/recovery and history.
  Prove a queued run reaches a real terminal result and restart/concurrency safety.
- **CAPC-014 — P1, code-confirmed execution gap:** `WorkflowRule` is only read,
  created/versioned and enabled in Admin routes; no domain/worker evaluator is
  found. 17.3D requires side-effect-free preview and representative exactly-once
  Attention/notification behavior. Complete the canonical typed evaluator and
  wiring, not a decorative activation form or a shadow engine.
- **CAPC-015 — P1, contract gap:** Admin retention supports EXPIRED_SESSIONS only;
  17.4A explicitly includes eligible Document raw-byte purge with retained metadata,
  history/holds and recoverable provider cleanup. Existing storage retention hooks
  require reconciliation before defining the implementation wave. Moreover the
  execute route does not reference a reviewed preview: it recomputes a cutoff.
  Preserve append-only audit/security exclusions; never broaden deletion targets
  without deterministic owning-domain eligibility and approved policy.
- **CAPC-016 — P2, code-confirmed navigation gap:** Admin event detail prefers a
  `/crm/clients/:id` link whenever clientId exists (`AdminAuditPages.tsx`, entityLink),
  but the CRM shell requires CONSULTANT role. This conflicts with the explicit
  Admin-vs-Consultant separation. Link to an authorized operational context or
  omit the link; do not grant Admin professional rights to make it navigable.

The refined Phase17 packages 17.1A/B, 17.2A/B, 17.3A–G and 17.4A–C were read;
their explicit requirements confirm that the execution, retention, typed settings,
preview, lifecycle and Client360 completion gaps are not merely older UX wishes.
Admin browser access requested from the user after successful Consultant access;
no account reset or automatic MFA enrollment attempted.

## Admin browser audit after user enrollment

User completed Admin enrollment. Actual browser enters `/admin` and renders the
Admin shell without an MFA redirect. The operational dashboard, however, returns
403. Reports and Users load through the same authenticated browser. Thus this is
not evidence of another enrollment failure.

- **CAPC-017 — P1, CONFIRMED:** `strategies/routes.ts:197` installs a blanket
  `/admin` denial inside a router mounted at `/api/v1`. Dashboard and payment
  routers are registered later in `app.ts`, so legitimate Admin routes fall into
  that strategy denial. Browser Dashboard and Payments both fail; sanitized HTTP
  logs confirm403. Scope the denial to actual strategy endpoints, preserving
  denial of Admin professional approvals. Add full-app route-composition tests
  for allowed operations and prohibited strategy actions.
- APC-001 independently confirmed in the actual mobile navigation drawer:
  Overview/Commerce/Integrations/Utilities only. Users, access grants, audit and
  security history, and Catalog groups are absent despite direct routes.
- APC-020 browser-confirmed: Reports renders literal JSON arrays with `_count`,
  raw state/status keys and six sections, fixed to the last30days.
- Users direct route loads337 existing users,20 per page, with name/email,
  role/status/MFA/session chips and bounded pagination. This demonstrates the
  hidden navigation is not equivalent to missing implementation.
- **CAPC-018 — P2, code-confirmed:** Payments search is included in queryFn but
  omitted from the React Query key (`AdminPaymentsPages.tsx:44`). Changing only
  search on page1 does not reliably refetch and can show stale results. Prove
  successive distinct searches after the route-composition defect is corrected.

Admin browser audit is still in progress. No operational mutations, role changes,
grants, destructive retention actions or provider configuration changes performed.

### Additional authenticated Admin observations

- User detail for Avery Administrator shows enrolled MFA, current session,
  capability list, role selector, reset/revoke controls, and empty assignment/grant
  sections. No reset, revoke or role change was performed. Existing MFA/session
  visibility refines APC-042; missing grant creation still confirms APC-041.
- Settings renders four raw-key boolean switches only. AI processes renders
  eleven configured processes plus a two-field disabled-version form, with no
  preview or activation controls. Notification operations renders disabled-version
  creation, two template versions and fifty nearly indistinguishable delivery
  lines without a visible filter, recipient, timestamp or detail action. These
  are actual browser confirmations of APC-031/032/035 and volume/usability gaps,
  not inferred from screenshots of an unavailable application.
- Scheduled jobs renders three disabled definitions and disabled manual-run
  buttons. Retention renders only expired sessions, disabled Execute and Preview.
  No job was queued and no retention preview/execution was requested. These
  observations do not prove that queued work executes; CAPC-013 remains grounded
  in the independently inspected missing consumer.
- Integrations renders one untested email-provider row and Enable. Source shows
  only a confirmation/toggle path, not a provider test/configuration workflow.
  Preserve Phase17.3F's non-payment scope when refining APC-036/046.
- Security history loads a bounded fifty-event page, search/type/severity inputs,
  and Load older events. MFA success detail displays safe method=TOTP metadata.
  Thus history and pagination exist; APC-037 concerns readable interpretation,
  context and permitted response workflows, not absence of an event store.

## Client browser audit continuation

Normal sign-out followed by authorized demo Client login succeeded. Staff MFA
was not reset. Client Home, published Credit Center/Profile and Plan load.
Credit Center sections omit Plan; Plan remains a separate destination and exposes
`PORTAL-08` in its overline. Profile financial values are stacked on a dark card,
confirmed by an actual narrow-viewport screenshot. Plan renders one available
guidance item and two locked dependent items; no action was submitted.

Cards portfolio renders zero accounts and an unreviewed portfolio date while the
published profile has eight open accounts. This is a fixture/continuity question,
not yet proof that the projection implementation loses records.

**CAPC-019 — P1, CONFIRMED:** Explore Cards returns403 in the actual Client browser.
Sanitized API logs identify `/api/v1/cards/catalog?search=`. `cards/routes.ts:52,63`
calls `requireCapability` without a client route parameter. That middleware
(`auth/middleware.ts:96–121`) requires `req.params.clientId`, otherwise denies
`RESOURCE_SCOPE_INVALID` before evaluating capability. These unscoped catalog
routes therefore cannot succeed with the canonical middleware, irrespective of
the user's catalog.read grant. Reconcile safe authenticated catalog visibility
with canonical capability checks; do not remove authorization or widen access to
client records. Acceptance must exercise the real middleware/application mount,
both catalog and offer-history reads, authorized roles and denied callers.

Resolved-regression verification: Documents actually renders upload/drop-zone,
type/status/search and twenty-row pagination over twenty-five files. Searching
Credit Review Summary updates URL and returns exactly one result. Support shows
thirteen unresolved requests before one resolved request. New-request composer
opens the shared DocumentPicker with search/type filter and ten-row paging over
twenty-two eligible files. Next displays rows11–20 with no overlap with the first
observed page; previous document versions are absent. Closed picker and cancelled
the unsaved request without attaching/uploading/submitting. These observed
capabilities must be preserved, not reopened as missing. Upload/retry failure
injection and truly large-volume checks remain outstanding.

## Correction-plan draft, not implementation approval

## Phase 1–17 contract reconciliation

This matrix reconciles accepted phase boundaries against implementation,
current browser behavior and the screen/CAPC matrices. “Material gap” means an
accepted requirement is incomplete or unusable; it does not erase working domain
foundations. Historical completion reports are supporting provenance only.

| Phase | Implemented foundation retained | Independent completion conclusion |
| --- | --- | --- |
| 1 | Local runtime, Prisma history, transaction/idempotency/outbox, design system | MATERIAL GAPS: outbox recovery/concurrency CAPC-022; richer task-specific design patterns APC-053. Migration reset/rebuild is not proposed. |
| 2 | Better Auth, role/capability service, staff MFA, shells | MATERIAL GAPS: cookie logging P0; Admin/CRM IA; governed actions. MFA regression locally repaired. Preserve Admin/Consultant authority separation. |
| 3 | Realtime transport, documents/providers, notifications, Support, Attention | MATERIAL GAPS: domain-targeted realtime/recovery, live Help invisible to queue, Support pagination predicate, staff notification reachability. Documents/Support picker regressions verified as present. |
| 4 | Client context, Goal/intake, Journey/cycle/nurture | MATERIAL GAPS: Client360 persistent seven-tab context and richer lifetime Journey. Goal state remains canonical. |
| 5 | Products, entitlements, PayPal/Stripe/BofA, disputes/refunds/reconciliation | MATERIAL GAPS: payment search cache, operational filtering/timeline/effect preview. Preserve original-provider routing and unsupported-BofA limits. |
| 6 | Guided review intake/document pipeline | MATERIAL GAP: no complete actual browser fixture/flow; seeded review aggregate is incomplete. Preserve canonical Document/report pipeline. |
| 7 | Durable AI job/output/artifact path | MATERIAL UI/OPS GAPS: job/process configuration lifecycle and actionable diagnostics. AI remains draft-only. |
| 8 | Profile/analysis/publication | MATERIAL GAPS: typed professional verification and richer published financial hierarchy. Preserve frozen publication/draft exclusion. |
| 9 | Shared Plan model, validation, execution/reconciliation | MATERIAL GAPS: existing-draft preservation, authoring/path/dependency richness and exact client preview. Do not create another task engine. |
| 10 | Card portfolio/catalog/offers/insights | MATERIAL GAPS: scoped detail/large catalog behavior, coherent CRM research, imagery/facets. Shared read authorization locally repaired. |
| 11 | Cycle/Round/major-check state | MATERIAL GAP: current Round is not a complete lifecycle hub and uses stale development-phase copy. |
| 12 | Strategy draft/candidates/compare/sequence/approval | MATERIAL GAPS: sustained workspace/autosave/rule editing and client scheduling handoff; issuer handoff URL policy also required downstream. Consultant retains approval. |
| 13 | Appointment/live session/application events/presence | MATERIAL/HIGH-RISK GAPS: issuer handoff, OPEN/SKIP concurrency, local-state realtime/reconnect, three-zone console, Help projection. |
| 14 | Post-Round results/follow-up/analysis/finalization | MATERIAL GAPS: typed outcome-specific follow-up and sustained editable CRM workspace. Preserve immutable outcome/event history. |
| 15 | Major Readiness/coordination restrictions | MATERIAL GAPS: draft/approved projection integrity, assessment/history/context and shared preparation authoring. Server restrictions remain authoritative. |
| 16 | Support routing/SLA/AI assistance/communications | MATERIAL GAPS: lifecycle-correct server pagination and richer context; Support/AI authority boundary is preserved and non-negotiable. |
| 17 | Admin identity/ops/config/audit/retention/reporting | MATERIAL GAPS: scheduler/rule execution, document retention, typed config lifecycle, navigation, reporting and governed impact controls. Several backend contracts exist but their UI/worker completion does not. |

No phase requires a parallel replacement domain. Corrections must complete or
surface existing canonical models, transactions, projections and authorities.

## Final correction-wave recommendation — review required

1. **Wave 0 — P0 credential/log containment.** Source redaction is locally repaired
   and runtime-verified. Before feature work, securely remove/quarantine affected
   retained development logs, assess credential rotation, run exact-head CI and
   commit the reviewed repair without checking logs into source control.
2. **Wave 1 — Integrity and recovery.** CAPC-002/012/022 plus APC-019/023/025/038:
   legal concurrent application transition, claim-token/single-flight outbox
   recovery, exact delivery semantics, accurate errors and domain-targeted
   reconnect/refetch. Add real isolated database/Redis fault proofs.
3. **Wave 2 — Shell, navigation and shared interaction foundation.** APC-001–006,
   016–017,039–040,047–050,053; CAPC-007/016/023. Establish canonical Admin/CRM
   discovery, Client/record context, semantic status/error/action patterns,
   scoped global client search and live urgency indicator.
4. **Wave 3 — Client Review/Plan/Cards continuity.** APC-007/008/012–015/029/030,
   043/044/051; CAPC-001/003/005/019. Complete guided Review fixture and browser
   path first, then draft-safe Plan and volume-safe catalog/detail/issuer handoff.
5. **Wave 4 — Consultant daily work.** APC-009–011/018/024/026/027/049/051;
   CAPC-006/011/020/021. Build Client360 tabs, multi-family queue, scheduling,
   three-zone Live, typed Post-Round and Major workspaces on canonical projections.
6. **Wave 5 — Admin operational completion.** APC-020–022/031–037/041/042/045/046;
   CAPC-004/013/014/015/018. Finish lifecycle/preview/history/execution rather
   than polishing inert CRUD. Keep granular capability, step-up, audit, secret
   redaction, immutable history and safe retention boundaries.
7. **Wave 6 — Consolidation and final product gate.** APC-052 plus all collection
   findings: remove only proven unreachable legacy pages, use realistic large
   fixtures, and re-run Client→Consultant→Admin golden paths, narrow/desktop,
   keyboard/screen-reader, slow/error/stale/realtime/recovery and exact-head CI.

Dependency order is deliberate: secret containment → correctness/recovery →
shared navigation/interactions → product workflows → operations → final audit.
Visual polish must not precede authoritative workflow completion.

## Specification decisions required before their owning wave

1. **Issuer handoff source policy (P1).** Select the canonical allowlisted current
   offer/issuer URL and disclosure/return behavior. The product must not invent
   issuer URLs or treat a generic source page as an application endpoint.
2. **Support reply attachments (P2).** Current schema attaches Documents to a
   SupportCase, not SupportMessage. FQ-1 expressly says not to invent message-level
   semantics. Decide whether replies need immutable per-message attachment scope;
   until then preserve ticket-level attachments.
3. **Consultant-initiated Support (P2).** Document13 makes outbound conversation
   creation conditional on product policy. Decide whether consultants may initiate
   cases, and with what consent/category/audit behavior. Do not infer authority.
4. **Account privacy/export entry (P2).** Document13 says “where available.” Define
   the supported export/request workflow and retention/legal owner before exposing
   a decorative request button.
5. **Admin payment/integration IA (P2).** Decide the navigation placement only;
   Phase5 payment gateways remain owned by payment operations and must not be
   reimplemented in generic Phase17 integrations.

### Authorized browser-unblocking routing corrections

The user explicitly authorized only CAPC-010, CAPC-017 and CAPC-019 after the
independent audit exposed these blockers. Implemented locally on the existing
branch; no broad correction wave or merge is claimed.

- CAPC-010: Work Queue list and claim now target `/api/v1/consultant/work-queue`.
- CAPC-017: strategy denial is restricted to Admin strategy paths. Canonical
  Consultant approval still requires Consultant role and scoped authorization.
- CAPC-019: shared catalog and offer-history GETs use the existing canonical
  capability middleware. Client-specific routes and operational catalog mutation
  permissions are unchanged; no capability grants or account state were altered.
- Added nine assembled-application HTTP regression cases with actual router order
  and authorization service; only session resolution/persistence are stubbed.
  Covered catalog access for all three authorized roles; unauthenticated,
  missing-capability, unverified staff MFA and lookup-failure denial; client-scope
  isolation; Admin operations and prohibited strategy actions; Work Queue mount
  and claim-handler reachability without a business mutation.
- Focused API: three files,16/16 tests passed. Focused UI: two files,2/2 passed,
  including exact versioned list/claim URL assertions. API TypeScript/build,
  web TypeScript/build, changed-file ESLint and diff check passed. Vite retains
  its large-bundle warning. No CI run or exact-head CI success claimed.
- Restarted only verified Credit API listener on3008 (new PID23268), preserving
  database, staff MFA and Vite5185. `/ready` reports PostgreSQL/Redis ready.
- Actual Client browser now renders four seeded Explore Cards products instead
  of403. Staff browser confirmation of Dashboard/Payments/Work Queue awaits
  normal user-assisted MFA login; no staff assurance was synthesized.

Subsequent user-assisted Consultant MFA succeeded. Work Queue now renders12
items,3urgent,5mine,7unassigned in the actual browser. Start highest priority opens
the correct Dispute result follow-up Support case with reply/internal-note/AI
advisory controls. No claim or reply was submitted. Admin confirmation remains
pending. Consultant Catalog Operations still denies access via its separate
operational capability route; the approved shared-catalog read correction did
not change operational permissions or silently broaden Client access.

**CAPC-020 — P1 candidate, code evidence:** Major Readiness consultant display
labels any returned recommendation Approved even when approvedAt is null.
Furthermore `getCase` prefers an existing approved recommendation over a newer
draft even with includeDraft=true, so reassessment UI may keep targeting the old
approved ID. `MajorReadinessPages.tsx` also omits pending/error presentation for
these mutations. Require a populated draft→approval→reassessment browser proof
and explicitly separate current approved guidance from latest editable draft;
do not expose drafts to the Client. No correction implemented here.

CAPC-020 projection reproduction: invoked the compiled `getCase` with a read-only
stub containing a newer unapproved version2 and older approved version1, passing
includeDraft=true. Returned recommendation was the old approved ID. No database
or business state was changed. This confirms the selection behavior; full
reassessment browser acceptance is still required after correction.

**CAPC-021 — P1, producer/consumer contract gap:** Live application HELP creates
an urgent WorkItem with sourceType ApplicationSession and reasonCode
SESSION_HELP_REQUESTED (`live/applications.ts`). The actual Work Queue API filters
sourceType SUPPORT_CASE for candidates, results and counts (`operations/routes.ts`).
The new live Help item is therefore absent from the primary Work Queue, even with
valid client scope, and no persistent Live panel compensates for it. This is a
concrete cross-domain omission beyond APC-011's richer queue presentation.
Acceptance: client Help creates one canonical item, authorized consultant sees
it promptly with the live-session deep link, repeated Help stays duplicate-safe,
and unassigned/unauthorized staff cannot discover the client through the queue.

CAPC-012 diagnostic completed with a read-only query of the existing Credit
review database: seeded Review3c35c3b9-37bb-4043-b08e-6863682b32d9 is
INFORMATION_RECEIVED and has an intake, but intake.reportDocument is null.
`persistedReviewWorkspace.loadContext` explicitly returns404 for this condition.
This is an incomplete review fixture/aggregate, not evidence of an MFA failure.
The UI's MFA-oriented recovery remains misleading. Preserve existing records;
provide a complete separately identified synthetic review for browser acceptance
rather than fabricating a report on this historical record.

The first attempted claim reachability proof used an invalid body and exposed an
existing500 validation classification rather than400. Kept that outside this
bounded routing correction; final reachability test uses a valid body/missing
item and verifies the canonical item lookup. Reconcile this under APC-019's
error/recovery audit rather than broadening this implementation.

1. Complete independent evidence first: three-role browser access, every Doc13
   screen, every Phase1–17 requirement, recovered amendments, volume and failure
   cases. Resolve or explicitly classify contradictory specs.
2. Address proven integrity/recovery defects before broad visual work: draft
   preservation, real issuer handoff, concurrency, realtime and honest errors.
3. Establish shared shell/context navigation, accessible interaction/state
   patterns and content vocabulary without changing authority.
4. Complete coherent Client/CRM workflow workspaces using canonical services:
   Review/Plan/Cards, then Round/Strategy/Live/Post-Round/Major.
5. Complete scoped Admin lifecycle/configuration and operational collection
   surfaces, preserving immutable histories, step-up and secret redaction.
6. Re-audit full cross-product continuity, large datasets, responsive/keyboard
   behavior and security/realtime failure. Final waves and dependencies require
   the finished audit and product-owner approval.

## Reconciliation questions (not yet product-decision blockers)

- Document13 describes Documents as workflow-owned rather than generic storage;
  later FQ-1 upload amendments may refine this. Read amendments before a finding.
- Older design colors must be reconciled with accepted design-system packages;
  do not reopen accepted visual direction merely from an older general document.
- Admin operational permissions must not be confused with Consultant professional
  approval authority, especially CardInsight and Review/Strategy decisions.
- Historical test/CI policy is recoverable from the referenced strategy chat;
  prior reports are evidence of past gates, not proof of current UI completeness.

## Final audit conclusion and correction acceptance requirements

### Outbox/runtime audit continuation

CAPC-018 now browser-confirmed: entering `no-matching-audit-payment` changed
the URL/search field but left all three payment results visible. Direct navigation
to that exact search URL returned zero payments. This distinguishes a query-cache
identity defect from missing backend search support. No financial state changed.

Read-only grouped queries confirm45 FAILED events. One is INTERNAL_UNSAFE with
missing clientId/domains and5attempts. The other44 have those envelope fields
present and16–349 attempts, all reporting OUTBOX_PUBLISH_FAILED. No payload
contents, session credentials or provider secrets were emitted. No event was
retried, reset or deleted. These historical rows alone do not establish the
original transport failure or whether prior test/operational intervention reset
their state.

**CAPC-022 — P1 candidate, recovery/concurrency risk:** `outboxRuntime.ts` polls
every second without a single-flight guard, claims a batch with30-second leases,
then processes up to25events sequentially with up to15seconds wait each. A later
batch can reclaim a still-running event; terminal updates are by ID without a
claim token/version check. The query also does not cap attemptCount. This can
undermine the five-claim policy and terminal-state consistency. Real isolated
slow-worker/concurrent-poller proof is required before assigning all historical
failures to this mechanism. Do not replay financial/notification events merely
to clear the Dashboard number.

**CAPC-023 — P2, navigation:** Admin Dashboard's Platform action points to
`/admin/system-health`, absent from `App.tsx`. Provide an actual authorized
diagnostic destination or a truthful unavailable action; do not expose raw
outbox payloads as a shortcut.

### Admin routing correction: final browser confirmation

After user-assisted Admin MFA, `/admin` loads operational metrics and
`/admin/payments` loads all three seeded transactions (BofA150USD, Stripe125USD,
PayPal100USD partially refunded). The PayPal payment detail also loads its
25USD refund history and governed refund/reconciliation controls. No financial
command was invoked. Together with the prior Client catalog and Consultant
Work Queue browser checks, all three authorized routing blockers now have
actual role-appropriate browser confirmation. This closes their access-unblocking
verification, not the overall APC-2 audit or a final CI gate.

Dashboard also exposes45 failed outbox events and a `/admin/system-health`
link not registered in the inspected route table. These require independent
runtime/history diagnosis and navigation reconciliation; no retry, deletion or
other outbox mutation was performed merely because the count is nonzero.

All three roles were accessed in the actual browser; all53 baseline dispositions,
23CAPC findings, all105authenticated Document13 screen IDs and all17implemented
phase boundaries are reconciled in this report and its companion crosswalk.

The authenticated product is **not ready for product acceptance**. CAPC-008's
source defect is locally repaired, but operational containment and CI remain.
Fourteen P1 CAPC findings plus17 baseline P1 findings include
runtime recovery, workflow integrity and materially incomplete accepted product
contracts. Empty or incomplete fixtures prevented false claims of successful
Review/Live/Post-Round/Major golden paths; those missing proofs are themselves
assigned to correction-wave acceptance, not hidden as audit passes.

APC-2's stop condition is satisfied: audit and correction planning are complete;
no broad correction wave, Phase18/public/deployment work or merge was started.
The owner must review the waves and five product decisions before implementation.
