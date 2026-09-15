# Pass 53: Source reconciliation recovery and comparison usability

## Delivered

Accepted source reconciliation is now acknowledged before refreshing the Plan. A failed follow-up read no longer reports the accepted update as a failed mutation. Unknown or accepted-but-unloaded results pause further editing, saving, source changes and approval until explicit Plan recovery succeeds. Closing the comparison does not bypass this gate. Recovery reads the current Plan without repeating reconciliation; unknown-result recovery preserves the entered reason.

The source comparison drawer has a named modal dialog and a sticky heading/close control. Its reason field is disabled during mutation or unresolved recovery, capped at the API's 1000-character limit and accompanied by a count and audit-purpose explanation. Existing saved-versus-latest reference comparisons and retained progress remain visible.

## Verification

Thirty focused tests passed: 21 builder component cases and nine reconciliation database cases. New component coverage includes accepted update/failing read, unknown result/failing recovery, preserved reason, recovery after closing the drawer, blocked saves/approval, exact reviewed fingerprint/revision and a single mutation. Database coverage includes source freshness, preserved completion dates, existing private drafts, competing edits and republishing progress. Scoped lint, whitespace checks, API compilation and web production build passed. The existing pg concurrent-query deprecation warning appeared.

A dedicated synthetic browser fixture had an approved Plan with a verified step. A primary-goal revision was added directly to that isolated fixture to represent changed source data; this does not qualify the goal-editing UI. The consultant compared sources and reconciled through the real API/UI. Only the subsequent builder reads were intercepted with 503 responses. Explicit recovery succeeded without a second reconciliation request. Database checks confirmed version 2 references the new goal revision and retains the original completion timestamp. The consultant then approved version 2 through the UI; its ACTIVE state and retained timestamp were verified. The 390x844 comparison screenshot was reviewed. Synthetic records were removed by client-scoped cleanup.

Initial component checks needed to await comparison loading. The first mobile script selected the hidden navigation drawer after resize; its corrected selector uses the comparison's accessible name. Both were resolved before passing qualification.

## Remaining

Goal/review source creation through their own UI, source changes during an open comparison, lost reconciliation response replay, prolonged reconnect/load behavior and separate-Plan policy remain open. This is one-source reconciliation and republishing evidence, not completion of the full Review/strategy workflow. A1/A2/A5 and the broader roadmap remain in progress. Other project versions were untouched; no migration, API runtime restart, push or deployment occurred.
