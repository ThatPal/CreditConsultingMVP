# U1 batch 24 — Loading context and recovery states

Baseline 0b2a176. Independent Astra branch codex/astra-production. U1 NOT PASSED.

Home now announces initial loading through the styled skeleton. Client Credit Center, Plan and Journey retain a page heading while loading or recovering from a failed initial read; Journey gains an explicit retry. Consultant Center uses the same named loading state. Shared ReferenceQueryState reuses existing safe recovery copy and native retry buttons. Held Plan responses and refresh/write protection remain unchanged.

## Verification

- 24 focused tests pass across ReferenceQueryState, PlanPages, PublishedCreditCenterPages and PlanLiveUpdates. Coverage includes accessible loading/page context, sanitized errors, retry callbacks and existing dirty-response protection.
- Six browser scenarios: Home/Center/Plan at 1440 and 390 widths, each forced through initial loading, failed read and keyboard Enter retry to success. Checks cover one h1, announced loading, hidden internal diagnostics and no horizontal overflow. Controlled read failures; synthetic account in a separate browser context with non-read API requests blocked after login.
- Four additional Center presentation checks: no publication and two-publication history at both widths. Empty state has the review destination; historical assessment remains distinct and expands/collapses with Enter while focus stays on its trigger. These use controlled response fixtures, not persisted publication transitions.
- Results and reviewed mobile error capture: docs/evidence/u1-query-states/. Other captures remain private. Mobile error and history layouts visually inspected.
- All five workspace packages build; root lint and follow-up changed-file lint pass. Initial build found a missed consultant loading reference after import removal; repaired and full build rerun successfully. History harness initially assumed numeric date formatting; switched to the actual accessible publication label and reran successfully.

V2 initial loading/failure coverage for the three reference surfaces is now verified. Center no-publication/history keyboard behavior is verified separately. Completed-state and cross-surface no-Profile combinations, full V3 focus/contrast audit, T3 action/blocker contract and V4 Decisions/Nurture disposition remain open. No U1 completion report or production-readiness claim.
