# Pass 28: Explicit private draft discard

## Delivered together

Clients can discard the current saved draft from its recovery prompt or paused inspection view, and an earlier draft from its inspection drawer. Confirmation describes exactly what is removed. Uploaded documents and submitted outcomes are not deleted.

The client-only DELETE endpoint scopes the item to the client and the draft to its actor. It locks the Plan, requires the reviewed draft ID and revision, and rejects newer or recreated drafts. A missing draft is a harmless replay; a new record starting again at revision 1 is not mistaken for the removed record. Old-version draft discard remains possible without modifying current-version answers.

The dialog freezes the selected identity/revision. It prevents closing during the request, preserves errors, and offers an explicit refresh without automatically retrying deletion. Current answer editing is not given an inline delete action that would silently discard unsaved work. Dialog labels use unique IDs.

## Verification

All seven Plan API suites passed (60 cases). Coverage includes cross-client/actor isolation, newer-save conflicts, deletion replay, recreated identity protection, and earlier-draft deletion without changing current answers. Two relevant web suites ran 11 distinct cases; one initial assertion raced the dialog exit animation. After waiting for the dialog transition, the affected nine-case suite passed. Tests cover confirmation/cancel, exact deletion identity, and conflict refresh without another DELETE.

Scoped lint and whitespace checks passed. API/web each built once at the grouped boundary and passed. The verified Astra API was restarted and readiness passed. No migration was required. Protected branch heads remain unchanged. Existing PostgreSQL query-concurrency deprecation and bundle-size work remain outside this batch.

## Remaining

Recovery for removed/hidden current steps, full draft history, unsaved-edit transitions and broader production qualification remain open. API service integration and component evidence do not constitute authenticated browser, mobile or accessibility qualification. Consultant browser evidence still requires MFA completion. Separate-Plan replacement and A1/A2/A5 remain in progress.
