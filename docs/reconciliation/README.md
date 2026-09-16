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
