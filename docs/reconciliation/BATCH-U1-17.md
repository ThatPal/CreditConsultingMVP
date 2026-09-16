# U1 batch 17 — Time-sensitive appointment guidance

Baseline a0f7758; codex/astra-production only. Shared focus now consumes the server-selected booked appointment and server clock. At the existing 30-minute pre-session boundary until appointment end, it offers View appointment ahead of ordinary Plan focus. Open Live session, Major restrictions, blocked Round, stale Strategy and stale Plan retain priority. Cancelled/ended appointments cannot become upcoming focus. The same JOIN_WINDOW_MS constant supplies existing session-start authority; command behavior is unchanged. The focus window ends at appointment end, while the existing consultant start grace period remains unchanged.

This is a conservative compatibility mapping of the final Portal scheduled-session-soon requirement to existing timing policy, not a new final scheduling policy. The destination is the current contextual Round scheduling/appointment surface. A booking does not imply an active Live session or execution permission. The appointment screen now says View session status, explains consultant ownership, and formats the time in the named appointment timezone instead of showing browser-local time with a different timezone label.

## Evidence

- 49 API tests pass: projection boundary/status/precedence cases; existing Live authorization/presence and appointment timezone tests; Plan/workspace integration. Appointment composition test mocks only the appointment read over real test database reads and verifies client/status/end-time filtering and explicit clock propagation. This is not persisted full appointment lifecycle coverage.
- Five-package build and root lint pass; final copy correction followed by web TypeScript and targeted lint verification.
- Isolated browser with response fixtures after synthetic login: desktop1440/mobile390, correct New York time from UTC timestamp, contextual session-status link, no Join session label, no overflow or page errors. Mobile screenshot reviewed. Initial browser check caught the missed label replacement; corrected and rerun successfully.
- Astra API alone restarted after ownership/environment checks. No database/schema mutations outside isolated test fixtures, real bookings, deployment, or changes to other versions.

## Open gates

U1 NOT PASSED. Comprehensive source blockers/available-action contracts, persisted full scheduling/Live lifecycle evidence, final reference-state/accessibility acceptance and final-domain reconciliation remain open. Focus is reevaluated on authenticated reads; exact wall-clock boundary refresh for a continuously open idle page is not added here. Final preparation state and appointment-detail topology remain to reconcile with U6; no new preparation lifecycle is invented.
