# Pass 31: Reviewed draft context and refresh guard

## Delivered

An open response form previously used the latest cached draft revision when saving, which could silently adopt another tab's newer revision. The form now retains the draft context it opened and advances that context only after its own successful save or explicit user reload.

Changes to saved draft identity/revision, active status or step context pause saves/submissions and show a review-update action while retaining local text. Explicit loading remounts the response with the selected saved data; deletion loads an empty response rather than retaining stale answers under a new revision. Running writes block this transition. Successful own saves still allow queued newer edits to autosave.

A save failure exposes Check latest saved response. Query error state retains the accepted response, blocks writes and offers Retry draft lookup. Existing outer Plan-update pauses are inherited. Earlier-draft inspection refreshes independently of the current form's accepted context.

## Verification

Three relevant suites covered 18 distinct cases across runs. The final saved-response suite passed all 12 cases; the existing navigation and live-Plan-update suites passed their six cases. New coverage checks cached newer/deleted draft transitions, retained local answers, disabled writes and explicit loading.

A test using a rejected lookup Promise continued to surface the exception in the test runner. The committed error-state test injects the query cache error state directly and verifies the UI branch; this is not evidence that the real rejected-lookup path is qualified. The rejected-request case remains an explicit follow-up. Temporary diagnostic code was removed.

Scoped lint and whitespace checks passed. One web build passed at the batch boundary with the existing bundle-size warning. API code/database are unchanged, so no API rebuild/restart or migration was needed. Protected branch heads remain unchanged.

## Remaining

Investigate the rejected-lookup Promise fixture and verify the real transport failure path. Session-loss recovery and actual browser/mobile/accessibility qualification remain open. Server-side save/submission protection against a deleted draft being recreated at the same revision needs separate identity validation; this batch detects identity changes that reached the client cache. Separate-Plan replacement and A1/A2/A5 production qualification remain in progress.
