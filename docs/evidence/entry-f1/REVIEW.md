# ENTRY-F1 v1.0 — review record

**Status: READY FOR REVIEW.** Implementation commit: 83a2e82b01610d2d9e1967b314f05bfd93331474. No merge or deployment.

[Changed files](changed-files.txt) · [Test results](checks.json) · [32 desktop/mobile screenshots](SCREENSHOTS.md) · [Browser scenarios and exact provenance](browser-results.json)

## Authority and bounded preflight

Dedicated worktree: C:/Users/morde/Desktop/Projects/Credit/.worktrees/entry-f1. Branch: codex/entry-f1. Parent pinned at cb5f5267c65ff29b914f5e0b01fd158542d6756c; it was clean before implementation. No intervening local edits were adopted.

Read the complete ENTRY-F1 sections, not the similarly numbered Credit Center packages:
- [Unified Build Plan, section M](https://docs.google.com/document/d/1JkaRKuychcNcpQFNpJ2YmrJ7cQ0u1VvsJ5_I4gaQ7wE/edit)
- [UX/UI 03 entry wireframes and EC01–EC06 bindings](https://docs.google.com/document/d/1uwjWzStBv45fWkAkpuSliDOyGyEHBTx2CVLSGKa_otI/edit)
- [Product Development 08, complete ENTRY-F1 technical contract](https://docs.google.com/document/d/1gqG-xPUX_5axKgp2VLGyB6-LAJwtxWg5AAp9zdnrKVg/edit)
- [Product Development 07, ENTRY-F1 schema amendment](https://docs.google.com/document/d/1SpUodfDzG8yq6R2M6FPeYpvCJTWCmy2mTIF29zYeVq8/edit)

The inherited AGENTS.md referred to the older Astra worktree, shared database and roadmap. Its task-local override now records this explicit user assignment. All other worktrees and branches were preserved. The private document cache is ignored and is not part of the review commit.

## Implementation and reconciliation

Shared schemas live in packages/shared/src/contracts/entry.ts and are exported from @credit/shared. The specification's generic packages/contracts location did not exist; this reuses the existing shared package instead of adding a parallel package. The only dependency additions are the already-pinned Zod 4.5.4 and a workspace link; no package versions were upgraded.

Ordinary signup requires no Goal. Better Auth's supported request-local context carries the exact prepared claim into the actual User/Client creation hook. Concurrent same-email signup and forced post-creation attachment failure are tested. A claim preserves the original intake expiry, never applies it. All legacy automatic binding paths are inert or explicitly reject a bodyless decision.

Authenticated preview is effect-free and actor-derived. Resolve requires explicit Apply/Keep, the loaded intake revision, the collection epoch, the observed primary identity/version (including meaningful null), and a stable command key. Client-row locking is shared with every reachable canonical Goal writer. Revisions include implicit primary demotions. A resolution, consumed marker, operation audit/outbox and any actual Goal change are atomic. Exact retry returns the historical result, even after later Goal edits. Keep/matching do not create a Goal revision or changed-picture event.

Writer inventory: production writes are in goals/prismaGoalStore.ts and goals/entryIntake.ts. The only additional non-test site is scripts/setupDemo.ts, an explicitly labeled seed that was not run or changed. Legacy auth stores no longer create nested Goals. No Cycle/Review/Round/payment/ACH/AI command or policy was changed. The existing Goal uniqueness constraint and unrelated records remain intact.

Resolution events include an empty domains array so the existing worker can safely process them without claiming a changed credit picture. Actual changes emit client.goal.changed with goals invalidation; existing Home/Journey/Goals readers now recognize that domain. Real outbox delivery and authenticated refetch are tested.

The browser uses the existing routes, auth frame, app shell, theme and Goal editor. It preserves safe continuation across auth links/verifiers, exposes pending claims deliberately, rejects stale public revisions, guards storage, retains an exact uncertain command for retry, and discards old-session responses. A reproduced same-tab session invalidation was corrected by removing the duplicate transient-channel sign-in announcement; the provider still notifies other tabs. Staff MFA was preserved and retested.

## Isolation and migration

Every test database is named credit_strategy_entry_f1_test with loopback-only disposable containers and tmpfs data. Ports: 5549 legacy migration proof; 5550 final migration/ENTRY-F1 browser and API evidence; 5551 ordinary/authentication checks. An earlier disposable 5548 database was not reset or reused after the final migration changed. Redis 6399 is a dedicated ephemeral test container. API 3018 and web 5198 are test harness ports. No shared/demo/production database, provider or existing app process was used. Email is captured in memory; no customer email or financial transport is invoked.

The guard rejects missing, production, remote, shared, demo and non-PostgreSQL targets. CI explicitly provisions and migrates the dedicated database and runs both scoped suites; existing REC-02/Astra guards remain unchanged.

Migration 20260922000000_entry_f1 adds collection epoch, request-correlated claim metadata and durable resolution references. Fresh migration proof applies all 70 migrations. Legacy proof applies 69 pinned migrations, inserts synthetic legacy-shaped records, then applies this migration and verifies field-equivalent Goal/revision/Cycle snapshot/consumed-intake records, null legacy claim metadata, zero new epoch, no invented outcomes and rejection of invalid constraints. See migration.json and empty-migration.log.

## Test evidence

Passing checks: **31 DB/API + 45 web + 17 authentication/MFA + 7 guard tests = 100**. Lint, workspace typecheck and build passed; the build retains a Vite chunk-size warning. See checks.json and logs.

Final exact counts and screenshot provenance are recorded in the accompanying logs and browser-results.json. Browser captures use real API/DB signup and actual captured verification links. Fault injection is explicitly limited to transport-loss/storage-denial scenarios. No intercepted production DTO supplies the primary success evidence.

| Case | Executed evidence |
| --- | --- |
| ET01 | Ordinary UI registration, real verification/sign-in, no Goal; API checks ordinary claim preservation. |
| ET02 | Public form save, auth-link continuity, verification, explicit comparison/apply; zero canonical Goal before confirmation and no unrelated service/lifecycle records after. |
| ET03 | Real Keep, Apply, matching and Not now; exact preferences, scope/amount/note differences, no-op revisions and incompatible/secondary collisions covered in DB tests. |
| ET04 | Authenticated login/register reopens comparison; staff/unverified rejection and role-compatible destination checks; existing staff MFA suite. |
| ET05 | Genuine verifier, expired signed token, wrong email, resend with original callback, forged-status neutral UI and interrupted pending continuation. Controlled email only. |
| ET06 | Concurrent same-email actual signup correlation, changed-payload rejection, independent pending claims, ordinary signup preserving claims, forced attach failure retaining account and token recovery. |
| ET07 | No-primary and demotion epoch tests; simultaneous canonical edit/resolution and competing intakes; real second-tab editor invalidates prior comparison. |
| ET08 | Two real public tabs load revision 1; first saves revision 2, stale second write rejects; explicit discard/reload offers review rather than silently adopting a new version. |
| ET09 | Throwing storage read/write/remove component tests; real public save with storage denied and top-level capability handoff; honest expiry recovery. |
| ET10 | Same-key historical replay, changed-key/body rejection, competing keys, interrupted retry restoration; browser loses response after a real commit and retries without another revision. |
| ET11 | Real transaction fault injection after Goal, revision, collection epoch, resolution, consumption, audit and outbox writes; no partial effects; wrong-client preview/replay denied. |
| ET12 | Legacy consumed outcome not fabricated; email-only legacy claims remain unattached; cleanup retains attached history; conflicts preserve unrelated Goals. |
| ET13 | Delayed preview and resolve discarded after session loss; action checks current actor; slow intake prefill preserves manual fields; existing Goal continuity tests. |
| ET14 | Real DB outbox → BullMQ/isolated Redis → production realtime runtime → authorized SSE → Home/Journey/Goals refetch without document reload. Unchanged/Keep do not emit changed-picture events; Cycle snapshot/currentAmount/unrelated Goals remain unchanged. |
| ET15 | Desktop 1440×1000/mobile 390×844 captures, long preferences, no horizontal overflow, named controls, keyboard confirmation, pending/conflict/expiry/uncertain states and origin-controlled iframe handoff. |

## Limits and not-run items

- This is local Chromium and DB/API evidence, not production deployment, a real website-origin integration test, cross-browser/device certification or assistive-technology audit. The configured marketing website origin is not changed or certified.
- A broad ordinary API attempt was aborted: it omitted required Redis configuration and canonical system seed, producing unrelated setup/timeout failures. api-ordinary.log preserves that incomplete attempt. It is not a successful regression run or evidence of an inherited code regression. No unrelated domain fixes were made. Authentication/MFA was rerun independently with controlled infrastructure.
- The full ordinary API/web suite, REC-02 suite and Astra suites were not rerun to completion for this bounded slice. Existing suite routing and guards were preserved. No GitHub Actions run is claimed for this local branch.
- Direct historical fixture assertions cover CycleGoalSnapshot, Goal revisions and consumed intake data. No new Round lifecycle fixture or Round implementation was introduced.
- Screenshots are synthetic reference accounts only. Approval remains the owner's visual/implementation review; no release or production-readiness approval is implied.

## Preserved refs

- main and baseline/current-non-ai: 642112202adee802b7d206bfe364dd779b33448c
- ai-enabled: becce2d268263c6c196cc524cb62526f0c65aec1
- codex/astra-production: bef53dcbae9b6ae090f90cdeef56cdc0d73740e5
- ui/credit-profile: 1daf6eb58f5e33bc7b0673f0a5bf0f2ee26e629d
- fix/astra-commerce-integrity: cb5f5267c65ff29b914f5e0b01fd158542d6756c

The approved theme files, shell/layout files and reference design assets have zero implementation diff against the pinned base. No merge, deployment, principal-ref advancement, remote visibility change or real financial operation.

## Diagnostic artifacts

failure.png and the earlier browser-run/browser-run-expanded logs are retained troubleshooting artifacts, superseded by the final PASS browser-results.json/browser-run-final.log. They are not final-state review screenshots. The private sources.json cache remains ignored.

## Repeatable local commands

Set DATABASE_URL explicitly to the dedicated loopback credit_strategy_entry_f1_test database before migrate/test commands. Run node scripts/entry-f1-guard.mjs, migrate deploy, pnpm --dir apps/api test:entry-f1, and pnpm --dir apps/web test:entry-f1 --testTimeout=15000. Run node --test scripts/entry-f1-guard.test.mjs for target-refusal checks. Browser evidence uses pnpm test:entry-f1:e2e with PLAYWRIGHT_MODULE pointing to an installed Playwright module URL and a dedicated Redis at 127.0.0.1:6399. The harness starts API3018/web5198 and closes them in finally; it seeds only canonical system reference data in the guarded database. It never sends real email.

Disposable containers remain available for review; the temporary API/web/browser and outbox/realtime runtimes are closed. Do not use generic/shared launchers to rerun these checks.
