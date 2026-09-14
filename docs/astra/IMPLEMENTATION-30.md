# Pass 30: Guarded live Plan updates

## Delivered together

Background Plan refreshes previously could unmount a response form while local text was unsaved. The client page now holds its displayed Plan while registered response work is dirty or busy. A waiting update is clearly identified, and response autosave, submission and attachment changes are paused while it waits. Text stays accessible for inspection and copying.

Loading a waiting update requires explicit confirmation while unsaved work remains. Running saves/uploads/submissions prevent that action. A completed save does not release the held Plan when newer local edits still exist. Successfully saved drafts remain available through the existing library. Failed Plan reads retain the displayed answers while work is in progress.

The existing navigation guard now exposes its aggregate dirty/busy status to this flow. Normal clean-page updates continue without confirmation. Existing in-app navigation and beforeunload protections remain in place.

## Verification

Five relevant web suites passed 21 distinct cases across runs: existing navigation, response, saved-response and Plan-page cases plus two new live-update scenarios. The new tests cover replacement after a failed save, explicit keep/load decisions, paused writes, a replacement during an in-flight save, and newer edits retained after the older save completes. Initial new assertions were adjusted to wait for asynchronous query notification before checking controls. New scenarios live in PlanLiveUpdates.test.tsx; the original PlanPages.test.tsx is retained unchanged.

Scoped lint and whitespace checks passed. One web build at the batch boundary passed with the existing bundle-size warning. API and database code are unchanged; no API build/restart or migration was needed. Protected branch heads remain unchanged.

## Remaining

This is in-memory protection against client-Plan query replacement, not durable recovery of text after browser shutdown. Independent draft-query invalidation, simultaneous draft deletion/editing, session loss, and broader live-event/browser/mobile/accessibility qualification remain open. Consultant browser evidence still requires MFA. Separate-Plan replacement and A1/A2/A5 production qualification remain in progress.
