# U1 batch 20 — Timed reference reads

Baseline 59a14a5; independent Astra only.

The shared server workspace now supplies refreshAt: the earliest future publication expiry, booked appointment pre-session boundary, or appointment end. It uses the existing session-window constant, excludes past/invalid/cancelled boundaries and returns null when none remain. This is a read hint, not a persisted lifecycle or permission. Profile/appointment authority stays server-side.

Home, Journey, Plan and client/consultant Credit Center queries schedule authenticated reads using the difference between server generatedAt and refreshAt, minus elapsed time since the response reached the cache. Device calendar skew does not reinterpret state. Long delays are bounded to one day to avoid browser timeout overflow, with a one-second minimum. Missing/invalid hints and failed query states stop the interval; normal query retry/focus/reconnect behavior remains. Background intervals retain TanStack's default visibility behavior. Timing is best-effort after receipt, not an exact wall-clock guarantee under network latency or browser suspension.

Plan uses its existing held snapshot and pending-update recovery: a timed read does not discard in-progress answers or submit a response. Realtime invalidation and command revalidation remain unchanged.

## Evidence

- 31 API tests: refresh boundary/currentness projection and Plan service integration; appointment composition additionally checks refreshAt against the appointment end at the pre-session boundary.
- 29 web tests: query scheduling, invalidation and Plan pages. Timer test verifies an actual mounted query refetches, displays the new server result and stops after refreshAt becomes null. Device clock skew and failure/no-hint cases covered.
- Isolated browser response fixture after real synthetic login: scheduled Plan refetch produced two reads, retained unsaved response text, held old visible guidance and displayed Review Plan update. Non-read requests blocked after login; no page errors or actual response writes.
- Build initially caught a missing result type in the new test fixture. Corrected the fixture type; five-package build rerun. Root lint passed before the type-only correction.

U1 NOT PASSED. Full final-domain blockers/available-action contracts, persisted full scheduling/Live lifecycle evidence, comprehensive reference-state and accessibility acceptance remain open. No schema change, real booking/payment/email, deployment or other-version mutation.
