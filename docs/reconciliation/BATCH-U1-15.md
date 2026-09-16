# U1 batch 15 — Open Live session focus

Baseline `e18fc2b`; independent Astra branch. KEEP existing Live authority/presence/command machinery; RECONCILE server focus composition. Final Portal Round cross-screen matrix says an active Live session is primary focus and Home/Journey deep-link directly there.

The U6 legacy ApplicationSession read adapter now selects the requesting client's open LIVE/PAUSED/WAITING_FOR_CLIENT/WAITING_FOR_CONSULTANT session, excluding endedAt records. Selection is deterministic by updatedAt/id. Only id, roundId, status, version and updatedAt enter the workspace DTO; private fingerprints/pause rationale/consultant data do not. Selected source identity/version is recorded under workspace.sources.liveSession.

Open session navigation takes focus before ordinary Plan/legacy-cycle work and Round restrictions. The CTA is Return to session, never permission to apply. Paused/waiting-for-consultant names the consultant and tells the client to wait. LIVE/waiting-for-client directs them to session instructions. All existing server execution/release/supervision/restriction checks remain untouched. READY/SCHEDULED/ENDED do not become active return focus. Existing live-sessions invalidation already refreshes all workspace roots.

## Evidence

- Projection/currentness tests: 30 pass, including four open-session statuses, encoded exact round destination, and three excluded lifecycle statuses retaining blocked-Round focus.
- Plan/service integration suite on isolated test DB 5446: 14 pass. New composition test mocks only the session read while using actual workspace/Center database reads; it verifies exact client/endedAt/status filtering, narrow selected fields, source version and identical focus across composed reads. It is not persisted-session lifecycle coverage.
- Initial attempted session fixture failed the database's required Round FK. No constraints were bypassed; replaced with explicit mocked-read composition coverage. Full valid Round/appointment/Strategy session fixture coverage remains open.
- Root lint and five-package build pass. Astra API process/listener ownership and environment were verified before restarting only API3015; /ready returns200. No other process/version changed.

No schema/domain writes or persisted focus state. The adapter retires in U6. Major Readiness restrictions/precedence, upcoming-session scheduling precedence and broader blocker/available-action contract remain open; this batch does not claim all final focus ordering. U1 NOT PASSED.

Final compatibility checks: 12 Live authorization/presence/decision tests and 13 workspace query/invalidation tests pass. Targeted final lint and diff whitespace checks pass.
