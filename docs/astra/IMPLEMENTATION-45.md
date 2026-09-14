# Pass 45: Accepted-save confirmation recovery

## Delivered

After a draft save is acknowledged, saving and submission now pause during its confirmation read. The editor distinguishes checking an accepted save, a failed saved-response lookup, and a conflicting revision. A lookup failure no longer describes itself as a waiting Plan update. When the preceding save was accepted, the message states that explicitly and explains that retrying the check does not repeat that save. Starting another save clears the earlier acknowledgment flag so a failed new attempt cannot inherit success wording.

Local answers remain editable and preserved. Retry draft lookup reads the current saved response; existing conflict review applies if that response differs. The saved payload is not submitted again by the retry action. New local edits still follow the existing autosave behavior once the pause clears.

## Verification

Twenty-four focused tests passed across confirmation failures (2), delayed acknowledgment races (4), saved-response/autosave behavior (12), and session loss during pending work (6). Controlled network and 503 failures verify accepted-save wording, disabled submission while checking, retained text, and recovery with exactly one write. Scoped lint, whitespace and the web build passed. API/worker code and processes are unchanged.

A separate browser context saved the existing synthetic review note through the real API while its subsequent draft GETs were intercepted with 503 responses. The UI correctly reported an accepted save with a failed check, retained the note and paused submission. Restoring reads and selecting Retry draft lookup recovered the saved state with exactly one page-originated PUT. The original synthetic note was restored through a separate API request afterward; its revision advanced. No Plan submission, publication, outcome or document change occurred. User-visible browser tabs were not used. Ignored evidence: .tmp/astra-runtime/draft-confirmation-review.mjs and draft-confirmation-results.json.

## Remaining

This qualifies confirmation failure/recovery for the current response editor. Staff/Socket.IO browser coverage, multi-node ordering and coordinated rollout, prolonged suspension/offline work, and the broader Plan lifecycle remain open. A1/A2/A5 and separate published-Plan replacement remain in progress; the product is not yet production-ready.
