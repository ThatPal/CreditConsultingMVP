# Pass 33: Session expiry explanation and return navigation

## Delivered together

Authenticated 401 recovery now carries an explicit expiry reason to sign-in. The page explains that account-saved responses remain available while unsaved edits and temporary tab notes are cleared. Ordinary login does not show an expiry warning. No response text is added to browser storage.

Login waits for its active sign-in sequence before redirecting on refreshed authentication. An already authenticated arrival also honors a validated internal return path. This prevents an early Home redirect from interrupting return navigation. Explicit logout now cancels private queries before removing them and resets the expiry reason; concurrent expiry signals are ignored after the first loss clears the user reference.

## Verification

26 cases passed across four web suites over the batch: authentication pages, protected routes, session recovery and draft transport. The new real-provider/API-wrapper test triggers a controlled 401, signs back in, and reaches the exact Plan path including query and fragment. Additional checks cover temporary authoring/review-note removal, retained public cache, expiry copy and ordinary-login silence. An initial return-path test used a wildcard route that remounted login after navigation; it was corrected to distinct login/destination routes and passed.

Scoped lint and whitespace checks passed. The grouped web build passed; its existing bundle-size warning remains. No API change, migration or API restart was needed. Protected branch heads remain unchanged.

## Remaining

This is controlled-fetch component evidence, not full-browser expiry during a dirty response, upload or navigation blocker. Those combined transitions, multi-tab behavior, mobile/accessibility checks, consultant MFA-dependent visual review and production qualification remain open. Separate-Plan replacement and A1/A2/A5 remain in progress.
