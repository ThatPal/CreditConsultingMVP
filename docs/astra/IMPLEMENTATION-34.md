# Pass 34: Expiry during pending Plan work

## Delivered together

Controlled integration tests reproduced two defects beyond the previous simple sign-in recovery test. An already-open leave-page blocker survived expiry, hid the login destination and incorrectly reported that changes were saved. A pending draft save could also restore private data to the query cache after expiry cleared it.

Navigation protection now reads the session-ended state, releases old navigation in the layout phase before the login handoff, and hides the stale dialog. Its blocker predicate sees the committed session state before child navigation effects run. Normal dirty/busy navigation remains protected.

Saved Plan responses ignore results after session loss or editor unmount, preventing late saves from repopulating private cache. Document uploads now carry an AbortSignal, cancel on component unmount, suppress late callbacks even if a transport ignores cancellation, and guard duplicate starts synchronously. Normal failed uploads remain retryable.

Browser cancellation does not prove a server write was rolled back. A file or draft already accepted by the server may remain in the account; after signing in, clients must inspect saved state before retrying. No local persistence of unsaved response text was introduced.

## Verification

30 distinct cases passed across five web suites over this batch: pending-session work (6), navigation protection (4), session recovery (6), saved responses (12), and draft transport (2). The new tests use the real auth provider, data router, API wrapper and response/upload components with controlled fetch responses. They cover dirty expiry with and without an open blocker, expiry while uploading, an upload's own 401, late draft completion, upload cancellation/late callback suppression, and failed-upload retry followed by normal navigation. Initial reproductions failed as expected; the repaired scenarios and existing regressions passed.

Scoped lint and whitespace checks passed. The grouped web build passed once; the existing bundle-size warning remains. No API change, migration or runtime restart was required.

## Browser evidence and remaining work

Read-only inspection of the open Astra browser at /app/plan showed Credit preparation plan, Published Version 1, three completed steps, and no editable response. That completed user-visible state was preserved. This is not browser evidence of dirty/upload expiry; the failure scenarios above are controlled component integration evidence. A synthetic editable Plan browser scenario, mobile/keyboard accessibility, multi-tab transitions, consultant MFA-dependent visuals and operational qualification remain open.

A1/A2/A5 and separate-Plan replacement remain in progress. Other version heads are unchanged; work stays on codex/astra-production.
