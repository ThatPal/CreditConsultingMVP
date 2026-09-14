# Pass 25: Approved revision follow-up handoff

## Problem and delivered batch

A revised Plan carried pending response status and retained evidence, but its attention records still referenced old item IDs. Reviewing the carried response could leave the original reminder open.

- Approval now retargets open Plan attention records for carried UNABLE and AWAITING_VERIFICATION steps to the approved version's item. Stable keys match only within the same Plan and client. Record identity, assignment, age, due date and status are retained; links and deduplication context update and the work version increments.
- Private draft saves do not move live reminders. The transfer occurs in the existing locked approval transaction after progress validation. Earlier versions and outcomes remain intact.
- Consultant decisions resolve only live Plan attention projections for the scoped client/item. Cancelled and independent work are excluded.
- Editor refresh invalidates selected-client response review and Journey data alongside the existing publication/queue caches.
- Approval preview explains that pending responses and assigned follow-up work carry into the approved revision.

## Evidence

The full Plan API suite passed 55 cases. Expanded handoff coverage then passed the nine-case reconciliation suite, totaling 56 distinct API cases across runs. The added help-path fixture initially omitted its required reason; it was corrected before the passing run. Coverage follows both submitted responses and help requests through two approved revisions, preserves assignment/due date/age, verifies no transfer on private save, checks final reminder resolution and retained original outcomes, and excludes cancelled/independent work.

Two relevant web suites passed 30 cases before the final explanatory copy addition. API/web each built once at the batch boundary and passed. Scoped lint and whitespace checks passed. Existing PostgreSQL concurrency and web bundle-size warnings remain. The verified Astra API was restarted and readiness passed; no schema migration or other runtime was changed. Protected branch heads remain unchanged.

Source grounding: the cached Journey specification, Journey 4, requires Plan changes to propagate into Work Queue and historical work to remain inspectable without cluttering current focus. This batch repairs the existing same-Plan revision lifecycle; it does not establish a new cross-Plan cancellation policy.

## Remaining

Formal replacement between separate published Plans remains open. Legacy reminders for already resolved superseded items are not bulk-repaired by this change; this transfer handles pending carried responses at approval. Cross-device message drafts and consultant visual/accessibility qualification remain open (MFA required for authenticated consultant browser evidence). A1/A2/A5 and the broader production roadmap remain in progress.
