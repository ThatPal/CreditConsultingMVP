# Pass 48: Consultant decision recovery

## Delivered

An unconfirmed consultant decision now blocks further verification, correction and reopen actions until a successful explicit response/history refresh. Switching steps or filters cannot bypass this requirement. A failed refresh keeps the recovery requirement and unsent message. Existing evidence identity protection still requires explicit review when the returned evidence differs from the note's original evidence.

Accepted decisions now show the specific outcome separately from history loading. If the follow-up read fails, the interface explains that the decision was accepted and Retry only reloads history. Confirmation survives an unavailable/empty step collection. Unsent message recovery is presented outside nested error alerts, and its drawer now has a named modal dialog and sticky heading/close controls.

## Verification

Sixteen response-review component tests passed, covering previous note isolation, expiry, storage recovery, source pauses and evidence conflicts plus new uncertain-request filter bypass, failed refresh, retained text, accepted-write/failing-read and unavailable-step cases. Scoped lint, whitespace checks, API compilation and web production build passed. The first web compilation caught test-only locator options and array nullability; those were corrected before the successful build.

An isolated browser used real synthetic consultant authentication and MFA. Its execution response was controlled to present an awaiting-review step, and its decision POST was intercepted with a 503 before reaching the server. One decision attempt occurred; changing filters left decisions disabled, explicit refresh preserved the message, and the named unsent-message drawer was accessible. No actual client decision was sent. A 390x844 screenshot was inspected; this is limited recovery interaction evidence, not full responsive or screen-reader qualification. Browser-local test wording was discarded afterward.

## Remaining

Actual accepted-decision browser verification, approval/publication failure recovery and separate-Plan replacement policy remain open. This change does not provide durable idempotent replay for a lost decision response; it requires reading recorded history before another decision. No API contracts, migrations or runtime restarts changed. A1/A2/A5 and broader production qualification remain in progress. Other project versions remain untouched; no push or deployment occurred.
