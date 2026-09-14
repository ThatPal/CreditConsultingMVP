# Pass 22: Approval-context concurrency batch

An unchanged draft revision did not establish that the client publication shown during review was still current. Two consultants could approve different Plans from the same starting context.

## Delivered

- Approval service acquires a client-scoped advisory lock before the Plan lock. Callers that provide a reviewed publication expectation compare its Plan ID/version (or explicit no-publication state) inside the approval transaction.
- Consultant HTTP approval now requires that expectation as well as the draft revision. A missing expectation is rejected. Existing internal service callers may omit it for compatibility; they share the lock but do not receive the expectation guard. Other domain code that writes publication records directly is outside this guarantee and needs migration review.
- Opening the client preview captures publication context. Background query refresh cannot change that snapshot while it is open. The API rejects a changed publication with PLAN_PUBLICATION_CHANGED.
- The editor offers explicit refresh and re-review after a conflict, with no automatic approval retry. Private edits remain governed by existing revision/navigation protection.
- History and cancellation sibling keys now have separate prefixes, fixing a React duplicate-key warning found during the expanded tests.

## Evidence

All seven Plan API suites passed (52 tests), followed by the expanded six-test route/preview suite including the new required-context assertion: 53 distinct API cases across runs. Concurrent approval of two different Plans from one baseline permits one activation and retains the other as a draft. Explicit no-publication context is rejected once a publication exists.

Seventeen consultant editor tests passed after updating the old request-shape expectation; four Plan page cases passed in the earlier combined run (21 distinct web cases). The new test updates publication context while preview is open, verifies the original snapshot is submitted, and verifies refresh does not send another approval.

API and web each built once in the grouped build run; both passed. Scoped lint and whitespace checks pass. Existing bundle-size and pg warnings remain. Verified Astra API alone restarted; readiness checked separately. Other branch heads remain unchanged. No authenticated consultant browser evidence was added; MFA/visual/accessibility qualification remains open.

## Remaining

This is publication concurrency protection, not formal cross-Plan supersession or an outstanding-work handoff policy. Those lifecycle rules remain open, as do migration of direct publication writers, internal caller expectations and full operational qualification. A1/A2/A5 remain in progress alongside the wider roadmap. Continue grouped feature batches.
