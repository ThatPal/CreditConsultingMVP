# U1 batch 22 — Persisted Live source verification and Round start guard

Baseline a39cf0d; independent Astra. KEEP existing Live command and source adapters; RECONCILE missing Round-state guard and replace the persisted-fixture evidence gap. Supports F05 focus correctness and F20 verification coverage, without full production qualification.

The integration fixture creates real client, consultant, Journey, Cycle, Goal and Goal snapshot, Profile state, service entitlement, Round, approved Strategy/version and Appointment records with foreign keys enabled. It starts the session through startApplicationSession, and creates persisted Major recommendation/decision/restriction records before using clearRestrictions. All data is scoped to generated test identities and removed in dependency order. The test explicitly refuses databases other than Astra test5446. It never seeds the review database.

## Verified behavior

- Booked near-term appointment supplies exact Round scheduling focus and end-time refresh hint; another client sees no appointment.
- Cancelled booking and wrong consultant cannot start a session; stale Strategy also blocks the command.
- LIVE, PAUSED, WAITING_FOR_CLIENT and WAITING_FOR_CONSULTANT supply exact return navigation and expected next-step owner. Center and workspace agree. Private source fingerprint is excluded.
- Another client sees no session and cannot pass participant authorization. endedAt excludes even an open-status record; SCHEDULED/READY/ENDED statuses are excluded from open-session focus.
- LIVE_EXECUTION restriction changes focus to LIVE_RESTRICTED and blocks session start. Clearing via the real command leaves Strategy STALE; session start remains blocked pending reassessment.

The new Round-state assertion initially failed: a BLOCKED Round with an old booking and still-approved Strategy started a session. Fixed by rejecting BLOCKED/COMPLETE/CANCELLED (and missing) Round status before command execution, then re-reading under a Round row lock immediately before the session upsert. Denied cases leave no session row. The lock protects this Round status boundary; this batch is not a comprehensive race audit of every Live source or command.

## Checks and limits

23 unique API tests across persisted fixture, Plan composition and Live session/decision/appointment suites. Five-package build and root lint checked. Existing PG client.query concurrency deprecation remains. Test-only final fixture additions rerun after the initial broad checks.

This is real database service/command coverage, not a browser booking flow, production-provider test, real credit application, or proof of all domain transitions. Foundation records are synthetic fixtures; Goal/Strategy approval user journeys are not exercised here. The old explicitly mocked-read tests remain useful projection-isolation coverage.

T2's bounded persisted-source evidence gap is now closed in U1_ACCEPTANCE_WORKLIST.md. Next is combined Home/Center/Plan state verification and remaining UI/accessibility gates. U1 NOT PASSED; no completion report.
