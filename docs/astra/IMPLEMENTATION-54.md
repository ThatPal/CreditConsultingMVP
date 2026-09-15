# Pass 54: Reviewed source snapshots

## Delivered

An open source comparison now retains the references the consultant started reviewing. A newer source fingerprint or saved-Plan revision no longer silently replaces that comparison or the request's expected values. The interface explains that the source/Plan changed and requires Load latest comparison before updating the draft. The typed reason remains available for review. Loading or failed source reads also disable reconciliation while retaining the displayed comparison. Reopening comparison starts a fresh review.

The reconciliation request uses the displayed snapshot's fingerprint and expected revision, preserving the server's concurrency contract. This change does not prevent source changes themselves or substitute client checks for server validation.

## Verification

All 23 builder component tests, scoped lint, whitespace checks, API compilation and web production build passed.

Builder component coverage was expanded for both fingerprint and saved-revision changes: the displayed comparison stays fixed, no update is sent while changed, the reason survives, and explicit loading binds the next request to the new values. The initial assertions ran before the query notification rendered; they were corrected to await the visible change warning.

A real browser scenario added a second goal revision directly to an isolated synthetic fixture while the first comparison was open. A browser visibility event triggered the normal query refresh. The old reference and reason remained visible and reconciliation was blocked until explicit loading. The consultant then reconciled once, recovered from a controlled failed follow-up read, and republished version 2. Database checks confirmed the new goal reference and original completion timestamp. The mobile comparison was visually inspected. Goal editing itself was fixture setup, not browser-qualified product behavior. Fixture records were removed by scoped cleanup.

## Originating workflow findings

Code inspection of GoalsPage found that its effect resets form fields whenever the fetched primary goal object changes, without an unsaved-edit guard. Its save generates a new idempotency key for each attempt and couples a saved goal to a subsequent cycle-confirmation operation. These are priority follow-up checks for overwrite and uncertain-result recovery.

The consultant Review completion code derives client summary text directly from readiness, submits a new profile snapshot and navigates after completion. The readiness-derived summary and editable publication workflow need review against the approved business sources before expanding that flow. Neither originating screen is marked complete by this Plan comparison work.

## Remaining

Goals form continuity/recovery and Review publication content remain next. Source updates during the transaction, lost-response durable replay, prolonged reconnect behavior and separate-Plan policy remain open. A1/A2/A5 and the broader roadmap remain in progress. Other project versions were untouched; no API code, migrations, runtime restart, push or deployment changed.
