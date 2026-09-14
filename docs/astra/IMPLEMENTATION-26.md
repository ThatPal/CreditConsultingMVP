# Pass 26: Client response boundaries and paused draft inspection

## Delivered together

- Client execution now applies the same path-visibility rule as the client Plan projection: unassigned steps or steps on ACTIVE/AVAILABLE paths. Direct requests for hidden alternative items return NOT_FOUND before creating outcomes or attention. Existing successful request replay remains available without a new mutation.
- Source pause markers now make draft context inactive even when version status remains ACTIVE. Draft reads retain the saved values; writes reject with the existing context-change error and preserve the saved revision.
- Paused client steps expose a read-only saved-response view with field labels, notes/help wording, downloadable available attachments and unavailable-attachment feedback. There are no save, resume or submit controls in this view. A parent pause overrides cached editable context.

## Verification

All seven Plan API suites passed: 58 cases. The new integration coverage verifies direct COMPLETE/UNABLE rejection for a hidden AVAILABLE item, no outcome/work-item side effects, existing history/draft access boundaries, successful visible-item execution, and paused draft read/overwrite protection.

Two response component suites passed all eight cases, including read-only saved values, absent write controls, attachment feedback and parent/API pause variants. Scoped lint and whitespace checks passed. API/web each built once at the grouped batch boundary. Existing PostgreSQL concurrency and web bundle-size warnings remain. The verified Astra API was restarted and readiness passed; no migration was required. Protected branch heads remain unchanged.

## Remaining

The paused view displays the last saved draft, not a guarantee of recovering edits that never reached storage. Draft transfer between published version item IDs, runtime transition behavior, full browser/accessibility qualification and separate-Plan replacement remain open. Consultant browser evidence still needs MFA completion. A1/A2/A5 and the broader production roadmap remain in progress.
