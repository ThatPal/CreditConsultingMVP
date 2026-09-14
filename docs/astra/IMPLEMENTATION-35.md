# Pass 35: Real-browser expiry qualification and upload authentication

## Delivered together

A separate headless Chromium context signed in to the existing synthetic Plan review account and exercised its editable saved response. The user's open browser tabs and completed Plan were not changed. No new Plan, outcome, fixture seed or database reset was needed.

This browser run exposed an API defect that controlled 401 component tests could not detect: anonymous document creation returned 403 FORBIDDEN from the client-role guard. The web correctly retained authentication on 403, so expired uploads left an obsolete response screen and navigation dialog. Document creation now checks missing authentication separately, returning 401 AUTH_REQUIRED. Signed-in staff and clients without a linked client record still receive 403. Rejected requests do not reach authorization or storage creation.

The Plan action bar now says Go to current step and Ask for help, fitting together at 390px instead of repeating the entire step title across a two-row dock. The local-step action moves keyboard focus into a named step group before scrolling; reduced-motion behavior is retained.

## Verification

Three focused Express route tests passed for anonymous, staff and unlinked-client upload rejection. Twelve web tests passed across Plan rendering, live updates and pending-session work. Scoped lint and whitespace checks passed. Grouped API and web builds passed once each; the existing bundle-size warning remains. Only the verified Astra API process was restarted, and readiness passed.

Real browser evidence used Chromium, the Astra web on 5195 and API on 3015. Request interception delayed sending a draft PUT or document POST while the same synthetic session was signed out through the real auth endpoint. The intercepted requests then continued to the real API; no mocked 401 was supplied. Both flows reached the expiry login screen, removed the navigation dialog after its exit transition, and returned after sign-in to the full Plan URL including query and fragment. The original server draft remained unchanged. The unauthorized synthetic file was absent from the authenticated Documents listing, and no attachment appeared. No page errors were recorded; live-update request aborts during logout were expected.

A 390x844 viewport had no horizontal overflow. Keyboard Enter on the current-step action transferred focus to the named step group. Mobile Plan and desktop expiry-login screenshots were inspected. Private raw script, results and screenshots are retained under ignored .tmp/astra-runtime/expiry-browser-* and are not staged. The initial login locator was corrected to include the required-field marker; a dialog assertion was corrected to wait for its exit animation.

## Reproduce and limits

Use an independent browser context and the synthetic review account with an editable, already-saved response. Record its saved note; delay the next draft save; edit only locally and attempt Home navigation. Sign out that test context through the real auth endpoint, release the request, and verify expiry navigation. Sign back in and verify the exact return path and unchanged saved draft. Repeat with a delayed document upload, then verify the file is absent. Do not mutate the regular client's completed Plan or reuse another version's session.

This proves requests arriving after real sign-out are rejected and recovered. Browser cancellation does not prove rollback of requests already accepted by the server. Cross-tab account switching, already-accepted writes, full assistive-technology/mobile-keyboard qualification, consultant MFA-dependent visuals, separate-Plan replacement and A1/A2/A5 production gates remain open. No production-readiness claim is made.
