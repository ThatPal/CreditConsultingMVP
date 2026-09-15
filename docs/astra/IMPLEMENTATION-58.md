# Pass 58: Revision-bound cycle confirmation

## Delivered

The legacy confirm-goal endpoint now requires a goal ID and positive revision. A transaction locks the owning cycle before checking completion, locks the requested goal before validating its active-primary revision, captures all canonical goal/preference fields, completes the step and records the goal version in one audit. First confirmation replaces only the provisional snapshot and sets goalConfirmedAt. Stale or unavailable goals return a conflict.

Already-confirmed, seasonal, or round-used snapshots remain frozen. An exact replay returns the recorded goal revision without another write or audit, even when the current goal has subsequently changed. A different revision receives CYCLE_GOAL_ALREADY_CONFIRMED. Client isolation is checked before cycle details are returned.

The web client binds confirmation to the accepted command revision, rather than whichever version a later read returns. It retains that reference with tab recovery. Stale/confirmed conflicts expose explicit current-goal review and a link to the cycle, with blind confirmation retries disabled. Older recovery records without a revision require review.

Round creation takes the same cycle lock and requires confirmation before claiming an entitlement. Existing legacy cycles with a completed STARTED step remain eligible even if their older goalConfirmedAt field is empty; genuinely provisional snapshots are rejected.

## Verification

Eighteen web tests passed, including confirmation payload binding and conflict controls. Ten API database tests passed across the new confirmation suite and existing Phase 11 suite. Coverage includes stale rejection without partial changes, canonical snapshot capture, concurrent retries with one audit, frozen history after later edits, client isolation, seasonal cycles without legacy steps, unconfirmed round rejection and legacy-confirmed compatibility. Scoped lint and whitespace checks passed. API compilation and the web production build passed.

A real browser scenario signed in an isolated synthetic client, saved goal version 5, lost the cycle-confirmation response after server completion, changed the current goal to version 6, reloaded and explicitly recovered. The cycle retained snapshot version 5 and its original completion time, returned to application rounds, and had one confirmation audit for two confirmation requests. This verifies the API/web revision contract and replay behavior. The round guard and simultaneous confirmations were database-tested, not exercised with real paid services.

Initial fixture tests omitted required Client fields and were corrected. Four users from the first incomplete fixture setup were identified by the unique test prefix and creation window and removed; cleanup now tracks user IDs before client creation. A web build found an exact-optional-property mismatch in the new recovery metadata; conditional inclusion corrected it. The existing pg concurrent-query deprecation warning appeared in the Phase 11 suite.

The legacy characterization request fixture was updated for the required body; that broad characterization suite was not run. Synthetic browser and database fixtures were cleaned with client/user-specific criteria.

## Remaining

No existing confirmed snapshots were rewritten or backfilled. Their historical accuracy still requires an explicit data audit. Broader simultaneous round/cycle lifecycle operations, full mobile conflict-panel accessibility and durable cycle event delivery remain unqualified. Review publication wording and source alignment remain a priority beyond this originating Goals/cycle slice.

A1/A2/A5 and the larger roadmap remain in progress. Only the verified Astra API was restarted; the web remains on 5195. No migration, push, deployment or changes to the protected worktrees/branch heads occurred.
