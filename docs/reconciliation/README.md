# Unified convergence execution

The user-directed U0–U10 program replaces the incremental A1/A2/A5 continuation. U0 baseline reconciliation has passed; U1 is the active implementation wave. Existing implementation reports are historical evidence, not final product acceptance. See [U0 acceptance](U0_ACCEPTANCE.md) for evidence and limitations.

Baseline: `codex/astra-production` at `44a905b2d5b804441864ec6faddc8e67552f2491`, synchronized with origin on 2026-09-15 (local time). Work remains in the independent Astra worktree. Other versions remain independent.

## Governing sources

- [U0–U1 build package](https://docs.google.com/document/d/1u7HJ-pTTvVHFFZP8Pj6ubmG1ZYA8Dj_ExlzIvPhW5eM/edit), read in full.
- [Unified reconciliation plan](https://docs.google.com/document/d/1JkaRKuychcNcpQFNpJ2YmrJ7cQ0u1VvsJ5_I4gaQ7wE/edit), read in full.
- [Final exact Portal specifications](https://docs.google.com/document/d/1uwjWzStBv45fWkAkpuSliDOyGyEHBTx2CVLSGKa_otI/edit). Latest applicable QA repair and final reconciliation override older sections. In particular, use final section K navigation, QA Batch 1 Home/Actions, and QA Batch 2 Profile/Review/Plan separation.
- [Component library](https://docs.google.com/document/d/1wOEgVNLDPwvmurT4sIYS0iday6Q69ETQiUXbudkyfcg/edit).
- [Surface inventory](https://docs.google.com/document/d/161kuRuOeIJ2d-S6SLK586DOFcyIAF1kU0cvJrgFwXX0/edit) and [coverage register](https://docs.google.com/document/d/1J7gduj9rR_NQXLb7maN5wT7_hmwEkRTKS-mCBiT-OdQ/edit).
- [Frozen database/domain](https://docs.google.com/document/d/1SpUodfDzG8yq6R2M6FPeYpvCJTWCmy2mTIF29zYeVq8/edit), [API/events](https://docs.google.com/document/d/1gqG-xPUX_5axKgp2VLGyB6-LAJwtxWg5AAp9zdnrKVg/edit), and [state machines](https://docs.google.com/document/d/1YZ60H61Fay-reCDn4xfsMrS9ItbnNURH1pW4uccSPsg/edit).

Downloaded source text remains private under ignored `docs/astra/sources/drive/u0-*`. Fetching a document is not a claim that every section has been reviewed. Screen-specific sections and latest amendments must be read before implementation. Source revision metadata is recorded separately.

## Latest topology review

[Staff surface reconciliation](STAFF_SURFACE_RECONCILIATION.md) now maps all 28 CRM and 27 Admin screen IDs plus System Health to current routes, embedded sections or missing final surfaces. It records treatments, owning waves and alias compatibility decisions. This is ownership/topology review, not full visual or workflow acceptance. The route extractor now correctly identifies lazy screens instead of their loading fallbacks, and preserves props, index identity, authorization wrappers and redirect destinations. The inventory remains 120 routes / 47 shared modules.

## Acceptance status

| Deliverable                                   | Status                                                                                      |
| --------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Baseline health                               | Checked; failures diagnosed and tooling corrections verified                                |
| F01–F24 current status                        | Current-source matrix recorded; production qualification remains open                       |
| All routes/components against final inventory | 120 routes and 47 shared modules explicitly classified; final product qualification pending |
| U1 truth map                                  | Initial source-level map captured                                                           |
| Visual baseline                               | Ten real browser captures, including published Profile and expanded Action                  |
| U0 acceptance                                 | PASSED — baseline/inventory only                                                            |
| U1 implementation/acceptance                  | IN PROGRESS / NOT PASSED                                                                    |

No U1 completion report should exist until both gates actually pass. No broad U2 work is authorized by completion of an individual U1 feature.

Latest checkpoint: baseline diagnostics and tooling-only corrections are complete for this batch; ten screenshot artifacts captured/reviewed. API 354 passing tests across broad + focused runs; web baseline 279/288, with four timeout cases passing diagnostic rerun and five test-isolation failures corrected; auth boundary rerun 10/10. Runtime 3/3, worker 17/17. Root lint passes after excluding ignored tooling and declaring script globals. Both databases match all 69 migration checksums. **Portal/staff/shared dispositions are now complete; U0 acceptance is recorded separately. All final UI and production qualification remains open.**

Latest implementation: [U1 batch 01](BATCH-U1-01.md) records collection interaction repairs and shared reference query refresh. Server truth and final reference-screen compositions remain next.

Latest implementation: [U1 batch 02](BATCH-U1-02.md) shares server focus, Action counts and Profile currentness across Home/Center/Plan, preserving history and response recovery. Final shell/reference-screen composition and remaining source/action contracts are next. U1 remains NOT PASSED.

Latest implementation: [U1 batch 03](BATCH-U1-03.md) aligns the seven primary Portal destinations, gives Credit Plan independent navigation ownership and replaces empty Home appointments with conditional dated context. U1 remains NOT PASSED; final page compositions and action contracts remain.

Latest implementation: [U1 batch 04](BATCH-U1-04.md) flattens the Plan execution layout and removes the floating bar over response content while preserving draft/live-update recovery. Final multi-view Plan and other reference compositions remain open; U1 NOT PASSED.

Latest implementation: [U1 batch 05](BATCH-U1-05.md) separates published Credit Center content from current next steps, fixes Review Support context and history wording, and reveals selected mobile section links. U1 remains NOT PASSED.

Latest implementation: [U1 batch 06](BATCH-U1-06.md) shares Plan response disposition across published reads, client focus and draft eligibility, with explicit verification ownership and fail-closed UI. Remaining final available-action/source-blocker contracts and coordinated Plan views are still open. U1 NOT PASSED.

Latest implementation: [U1 batch 07](BATCH-U1-07.md) adds Overview roadmap, Actions and Guidance views over shared Plan items, protects dirty responses when changing views, and routes shared next-step links to the exact item. Decisions/Nurture and remaining domain/action contracts remain open. U1 NOT PASSED.

Latest implementation: [U1 batch 08](BATCH-U1-08.md) reconciles shared typography, teal controls, touch targets and reduced motion, and scopes optional Plan collection restoration to publication/view identity. Reference browser checks preserve focus/count agreement and response recovery. Final truth and screen gates remain open; U1 NOT PASSED.

Latest implementation: [U1 batch 09](BATCH-U1-09.md) follows the user's richer visual direction with score pointers/scales, utilization ring, icon-led Plan steps, shared gradients/glow and blue-slate surfaces. Published values and recovery are preserved. U1 NOT PASSED.

Latest implementation: [U1 batch 10](BATCH-U1-10.md) recomposes Credit Center with ivory/mint advisory context alongside a dark action rail, extends light/dark contrast to Home, and strengthens navigation and financial iconography. U1 NOT PASSED.

Latest implementation: [U1 batch 11](BATCH-U1-11.md) shares server-driven Action progress between Home and Plan and recomposes the Home summary into a visual data surface. 28 focused tests pass; recovery and cross-surface truth checks remain intact. U1 NOT PASSED.

Latest implementation: [U1 batch 12](BATCH-U1-12.md) makes publication history expandable with snapshot-specific assessments/facts and improves analysis reasons/findings. Currentness is not inferred from history order. U1 NOT PASSED.

Latest implementation: [U1 batch 13](BATCH-U1-13.md) improves source-report metadata/preview presentation and missing/unpublished states, preserving the secure document destination. U1 NOT PASSED.

Latest implementation: [U1 batch 14](BATCH-U1-14.md) shares server-derived Profile currentness explanations across Home, Center and Plan without changing command authority or response recovery. 27 focused tests pass; full server blocker/action/Live/Major contracts remain open. U1 NOT PASSED.

Latest implementation: [U1 batch 15](BATCH-U1-15.md) adds client-scoped open Live session focus with exact return links and safe source versions. Existing execution authorization remains authoritative. Major/scheduling precedence and full U1 acceptance remain open.

Latest implementation: [U1 batch 16](BATCH-U1-16.md) adds scoped Major restrictions to shared focus, distinguishes restricted Live activity from paused sessions, and preserves exact-case navigation. 55 focused tests pass. Scheduling/action contracts and final acceptance remain open; U1 NOT PASSED.

Latest implementation: [U1 batch 17](BATCH-U1-17.md) adds server-timed appointment focus within the existing pre-session window, preserves restriction/Live precedence, and repairs appointment timezone/session wording. 49 API tests and desktop/mobile checks pass. U1 NOT PASSED; remaining action contracts and final acceptance stay open.

Latest implementation: [U1 batch 18](BATCH-U1-18.md) aligns shared next-step guidance with response-form availability and makes form submission respect server completion/help denials. 111 tests and desktop/mobile recovery checks pass. U1 NOT PASSED; final action contracts and acceptance remain open.

Latest implementation: [U1 batch 19](BATCH-U1-19.md) removes competing Plan hero actions, preserves server action wording, and shows shared next-step guidance without a published Plan. 29 tests and desktop/mobile focus/recovery checks pass. U1 remains NOT PASSED.
