# Pass 27: Earlier response draft access

## Delivered together

A published revision gives steps new item IDs, leaving earlier saved responses inaccessible through the current-step draft endpoint. Current draft reads now also expose the most recent earlier-version draft for the same actor, client, Plan and stable step key. Current answers remain a separate record with their own revision and context guards.

The client can open an earlier-response drawer while reviewing the current step. It shows the original title, instructions, form labels, saved answers, note/help text and save time. Available attachments use the existing download component and current authorization; unavailable attachments are identified. Reads do not create, migrate, submit or overwrite answers. The UI explicitly asks the client to review current instructions before reusing text.

The shared attachment query filters each draft's own file IDs independently. Earlier versions never cross Plan or user boundaries. Existing current-step visibility and ownership checks still gate access.

## Verification

All seven Plan API suites passed (59 cases). New coverage changes the step instructions across approval, recovers original wording/answers, preserves independent current drafts, checks actor/Plan isolation and verifies that access creates no outcomes. Two response component suites passed (9 cases), including original field labels, read-only earlier text, unchanged current answers and no write requests.

Scoped lint and whitespace checks passed. API built once; the grouped web build caught two unsupported UI-library props, which were corrected before the successful web rebuild. The verified Astra API was restarted and readiness passed. Existing PostgreSQL concurrency and web bundle-size warnings remain. No migration was required and protected branch heads remain unchanged.

## Remaining

This is explicit inspection of the most recent earlier draft, not automatic field migration. Full historical draft browsing, orphan steps removed from the current Plan, retention/discard controls and unsaved-edit transition recovery remain open. Browser/mobile/accessibility qualification was not performed in this batch; authenticated consultant visual evidence still requires MFA. Separate-Plan replacement and the broader A1/A2/A5 production qualification remain open.
