# Phases 6–8 accumulated checkpoint

## Boundary and method

- Required start and audited head: `57b743f4b5f8e0ac22e120dd7e3d8da82c40d9fe`
- Branch: `rapid/phase6-8-review-golden-path`
- Method: audit first, one consolidated correction wave, then exact-final-head verification.
- Authority boundary: AI remains factual Level 1 proposal infrastructure. A scoped, MFA-step-up Consultant remains the only publication authority. Phase 9 is excluded.

This report was opened before implementation changes. Initial dispositions below record the audited state at the required start head; final dispositions and proof are completed after the correction wave.

## Baseline findings audit

| Finding | Initial disposition                  | Audit evidence                                                                                                                                                                                                                | Correction boundary                                                                                                                                    |
| ------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| B68-01  | Validated — P1                       | `reviewWorkspace.ts` provides pure materialization/concurrency helpers and Prisma has the 8.1 models, but no persisted workspace service or 8.1 command routes exist. The CRM screen still uses the legacy review projection. | Add the persisted, authorized CRM-11 workspace query and governed override/exception/profile commands; wire the real screen.                           |
| B68-02  | Validated — P1                       | `reviewAnalysis.ts` provides pure finding/readiness helpers and Prisma has finding/approval fields, but there are no persisted 8.2 authoring routes and no real Analysis/Recommendation/Readiness workspace UI.               | Add governed draft/finding/analysis/recommendation commands and exact readiness projection; wire the real screen.                                      |
| B68-03  | Validated — P1                       | `submitCreditReview` atomically consumes the Review Credit and emits the submission outbox event, but neither it nor the route starts `runDurablePhase7Pipeline`. That pipeline is reached only by integration tests.         | Connect accepted submission to a durable, duplicate-safe processing request using the accepted report and current card context.                        |
| B68-04  | Validated — P2                       | `DurableAIRuntime.inspect` supports one client-scoped job; no safe deterministic list/filter query exists.                                                                                                                    | Add an authorized, bounded, deterministic monitoring query foundation without Phase 17 configuration UI.                                               |
| B68-05  | Validated — P1 evidence defect       | Sprint 8.1/8.2 and the Phase 8 gate describe domain proof as complete even though no application-layer routes/UI or real submit-to-pipeline path existed.                                                                     | Correct the completion/gate reports and replace the claim with application-boundary proof.                                                             |
| B68-06  | Open — browser verification required | The healthy review environment responds, but route behavior and cache freshness must be verified after the real contracts are wired.                                                                                          | Browser-first functional verification on the final running build.                                                                                      |
| B68-07  | Partially validated — P1/P2          | Phase 6 routes and the guided UI exist. Detailed re-audit is required for validation states, complete-card drawer behavior, explicit no-changes, deterministic re-entry, and contextual support.                              | Preserve correct behavior and correct any contract gaps found by focused and browser tests.                                                            |
| B68-08  | Validated — P1                       | Supported-source validation/extraction currently accepts a TypeScript `SyntheticReport` object supplied directly to a test-only pipeline. Uploaded bytes are not adapted through a governed source parser.                    | Add a narrowly supported deterministic fixture adapter for actual protected uploads; fail unsupported/malformed sources closed with client-safe state. |
| B68-09  | Validated — P1 evidence defect       | Existing tests separately seed or call internal services; no single proof crosses the real M3 application boundaries from intake through durable AI, consultant authoring/publication, and published client reads.            | Add one real application-boundary golden-path acceptance proof and retain lower-level rollback/concurrency/recovery suites.                            |

## Independent Sprint 6.x–8.x reconciliation matrix

| Sprint | Requirement / layer                                                          | Start-head evidence                                                       | Initial disposition                                                                 |
| ------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 6.1    | Eligibility, newer-report rule, purchase/reservation, PORTAL-10/11           | Lifecycle service, client routes/UI, transaction tests                    | Implemented; re-prove in accumulated gate.                                          |
| 6.2    | Protected upload, validation state machine, replacement, PORTAL-12/13        | Storage-backed upload routes, report document state, UI and focused tests | Implemented with B68-08 integration omission.                                       |
| 6.3    | Durable complete card portfolio, unresolved identification, PORTAL-14        | `ClientCard`, intake confirmation routes and UI                           | Implemented; browser and pagination/state review pending.                           |
| 6.4    | Post-report updates, platform-event reuse, explicit no-changes, PORTAL-15    | `ClientUpdate`, intake changes commands and UI                            | Implemented; browser proof pending.                                                 |
| 6.5    | Atomic submit/consume-once, processing/re-entry/support, PORTAL-16           | Consequential command, audit/outbox/notification/attention proofs         | Domain transaction implemented; B68-03 prevents complete processing contract.       |
| 7.1    | Durable registry/job/output, retry/recovery, validation, safe monitoring     | PostgreSQL models/runtime, BullMQ adapter, recovery/concurrency tests     | Runtime implemented; B68-04 query omission.                                         |
| 7.2    | Supported validation/extraction with evidence and safe malformed handling    | Deterministic processes and synthetic facts/evidence tests                | Algorithms implemented; B68-08 uploaded-source omission.                            |
| 7.3    | Normalize/reconcile/match with bureau differences and non-reporting cards    | Deterministic processes, artifacts and focused tests                      | Implemented; B68-03 prevents application use.                                       |
| 8.1    | Persisted CRM-11 source/exceptions/profile/override/stale workspace          | Models plus pure helper tests                                             | B68-01: not implemented across service/routes/UI.                                   |
| 8.2    | Persisted findings/analysis/recommendation/readiness authoring               | Models plus pure helper tests                                             | B68-02: not implemented across service/routes/UI.                                   |
| 8.3    | Immutable atomic publication, frozen versions, exactly-once effects          | Publication service/migration and transaction/concurrency tests           | Implemented at service/route; must be exercised by the real workspace and M3 proof. |
| 8.4    | Client-safe Overview/Profile/Report/Analysis/History and CRM read projection | Published projection service/routes/pages                                 | Implemented; final privacy/browser/realtime proof pending.                          |

## Additional checkpoint findings

| Finding | Severity | Initial evidence                                                                                                                                                          | Planned disposition                                                                                                                                                       |
| ------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C68-01  | P1       | CRM-11’s legacy `complete` command can create a snapshot and complete a review outside the immutable 8.3 publication transaction, leaving two competing completion paths. | Retire the legacy UI path and make the canonical publish transaction the only current workspace completion action; retain compatibility only where demonstrably required. |
| C68-02  | P1       | Phase 7 orchestration synchronously calls `processJob` after enqueue and cannot represent the true multi-job dependency chain when executed by a separate Bull worker.    | Persist a durable pipeline coordinator/input contract so restart and duplicate delivery resume the next process safely.                                                   |
| C68-03  | P2       | Consultant review listing is role-based and manually scoped rather than using the canonical `review.read` capability contract described by CRM-11.                        | Apply canonical capability and client scope on new workspace/monitoring boundaries; avoid widening Admin authority.                                                       |
| C68-04  | P1       | A failed outbox delivery retained its Bull job identity, so the next governed outbox attempt could not enqueue and deliver the event.                                      | Key transport attempts by durable event plus attempt number while preserving the event identity in the payload; prove restart/retry delivery and duplicate-safe effects.  |

## Consolidated correction wave

- Added a fail-closed byte adapter for the deliberately supported synthetic three-bureau PDF fixture. Unsupported or malformed uploads are rejected before Review Credit consumption.
- Connected accepted submission to a durable Bull/PostgreSQL AI pipeline. The coordinator advances validation, extraction, normalization, reconciliation and card matching with deterministic job identities; startup recovery finds submitted reviews without a job and safely resumes them.
- Added bounded, client-scoped, deterministic AI-job monitoring without exposing provider payloads or Phase 17 configuration.
- Added the persisted CRM-11 workspace service and protected routes for source/profile materialization, optimistic overrides, exception resolution, finding decisions, analysis and recommendation approvals, readiness and immutable publication.
- Replaced the current CRM review action/link with the canonical persisted workspace. The old completion route remains only as compatibility infrastructure and is no longer exposed by the current review flow.
- Added the real Source, Profile, Analysis and Publish workspace surfaces, including evidence-aware findings, exception handling, explicit approval gates, secure source-document viewing and an AI job rail.
- Corrected outbox retry transport identity so a retained failed queue job cannot suppress a later governed attempt.
- Corrected the Sprint 8.1, Sprint 8.2 and Phase 8 gate evidence records to distinguish their original helper/domain boundary from the application-layer completion supplied by this checkpoint.
- Added a Credit-only review launcher that pins the Phase 6–8 database, Redis, API and web ports and refuses the unrelated database identity.

## Final finding dispositions

| Finding | Final disposition | Acceptance evidence |
| ------- | ----------------- | ------------------- |
| B68-01 | Corrected | Persisted workspace service, protected application routes, canonical CRM link and functional workspace UI are present and covered by transaction/application tests. |
| B68-02 | Corrected | Findings, optimistic authoring, approvals and exact readiness are persisted and exercised through protected routes and the real workspace. |
| B68-03 | Corrected | Accepted submission enqueues the durable Phase 7 chain; duplicate submission and duplicate advancement remain effect-safe. |
| B68-04 | Corrected | Scoped job list is bounded, deterministic and excludes unsafe provider request/response details. |
| B68-05 | Corrected | Historical reports now state their original boundary and point to this accumulated application proof. |
| B68-06 | Corrected | Correct Credit-only API/web environment is reproducibly launched on ports 3007/5184; browser review is performed against that build rather than the stale Phase 4–5 process. |
| B68-07 | Verified | Eligibility, upload, card confirmation, updates/no-changes, atomic submission, re-entry and support contracts remain green in the 188-test API regression. |
| B68-08 | Corrected | Actual protected document bytes pass through the governed supported-source adapter; malformed and unsupported sources fail closed. |
| B68-09 | Corrected | `m3GoldenPath.integration.test.ts` crosses protected HTTP application boundaries from eligibility and upload through durable processing, governed consultant authoring/publication and client-safe published reads. |
| C68-01 | Corrected | The current CRM queue/workspace exposes only canonical publication; the legacy command is retained solely for compatibility tests. |
| C68-02 | Corrected | Durable coordinator and startup recovery replace test-only synchronous orchestration for the application runtime. |
| C68-03 | Corrected | New workspace and monitoring routes require canonical capability plus client scope, with MFA on consequential authoring commands. |
| C68-04 | Corrected | Worker recovery suite proves retry delivery after failure/restart while canonical outbox identity and downstream duplicate safety remain intact. |

## Verification and M3 golden path

### Clean database and seed proof

- Fresh disposable Credit database: all 44 historical migrations applied from zero without reset, squashing or editing history.
- System/reference seed executed twice successfully and remained at 16 templates.
- Demo seed executed twice successfully with stable canonical IDs and unchanged volume fixtures (25 documents, 14 support cases, 31 notifications and 25 directory clients).

### Accumulated verification

- API: 45 files / 188 tests passed on the isolated clean database with one worker.
- Web: 16 files / 82 tests passed with one worker.
- Worker: 5 files / 12 tests passed against isolated Redis DB 15, including failure/restart recovery.
- Runtime: 1 file / 3 tests passed.
- Final focused checkpoint gate: 4 files / 18 tests passed.
- ESLint: passed.
- TypeScript workspace typecheck: passed.
- Production workspace build: passed (existing Vite chunk-size advisory only).
- Repository-wide Prettier check remains a known pre-existing baseline issue affecting files outside this wave; every changed supported source/report file was formatted and `git diff --check` passed.

### Real M3 application golden path

The acceptance proof performs eligibility, review start, protected report upload using real supported bytes, complete-card confirmation, explicit no-changes capture and duplicate-safe submission through authenticated Express routes. It processes all five durable jobs through the production coordinator, then uses protected consultant routes to review source/profile evidence, decide findings, approve analysis/recommendation, verify readiness and publish. Finally it reads the published Credit Center projection through the client route and proves:

- exactly five successful durable process jobs;
- exactly one Review Credit consumption;
- exactly one immutable publication and publication outbox effect;
- no storage key, provider payload or internal artifact leakage in the client response;
- duplicate submission/advancement cannot duplicate the business effects.

### CI and final head

- Consolidated implementation/report commit: `a1b889d103d290050a5c705e11185a4b7e82d512`.
- Exact-final-head CI: pending the evidence-only report commit and push; the successful run URL is added as a post-CI evidence addendum rather than rewriting the tested implementation.

The branch remains separate from `ai-enabled`; Phase 9 was not started.
