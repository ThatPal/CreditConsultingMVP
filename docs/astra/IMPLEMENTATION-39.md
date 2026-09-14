# Pass 39: Legacy request coverage and real MFA handoff

## Delivered together

The shared request account expectation now covers protected /api routes beyond /api/v1, including legacy goals/services callers. Authentication, current-user discovery and public goal intake remain exempt. The server mounts its expectation check after auth/current-user/public handlers and before all protected API families, so a legacy route cannot bypass the consistency check merely by omitting v1 from its path. Expectations remain optional for older external/internal clients and do not grant authorization.

A successful password sign-in that enters a two-factor challenge now announces the session change to other same-origin Astra tabs immediately. The existing completed-MFA refresh still announces after verification. The one-shot announcer closes its temporary channel/listener, and sends no identity, credentials or response data.

The source audit found direct fetch calls only in the shared API module (excluding tests); the remaining EventSource connection transports refresh notices with client/domain metadata, and its triggered data queries use the shared wrapper. This does not establish continuous session revocation for an already-open event stream.

## Verification

Twenty-one web tests passed across request actor coverage (4), tab transport (3), and auth/MFA pages (14). The challenge route test now verifies the cross-tab notification as well as its encoded staff return target. Four API expectation tests also passed. Scoped lint and whitespace checks passed. Grouped API/web builds passed once; the existing bundle-size warning remains. Only the verified Astra API was restarted; readiness passed.

A fresh Chromium context used two test tabs. The first opened the synthetic review account's saved Plan response. Clearing cookies only in that isolated context simulated a session change missed by the old tab; the second requested the Admin services route with query and fragment, then signed into the synthetic Admin account. Entering its real MFA challenge sent the first tab to sign-in and removed its editor. A current authenticator code from the already-enrolled, previously authorized synthetic Admin fixture completed verification. The API confirmed ADMIN with staffMfaVerified, and navigation restored the exact requested URL. No MFA reset, enrollment, bypass or backup-code consumption occurred.

The same authenticated context sent a mismatched actor to /api/services and received 409, verifying the live legacy middleware placement. Raw script/results remain ignored under .tmp/astra-runtime/mfa-transition-*; the existing private MFA setup key was never printed or staged. No client Plan, response, document, outcome or publication was modified, and user-visible tabs were not used.

## Remaining

This closes the normal synthetic Admin MFA challenge/return-path browser check, not all staff account recovery or consultant screen qualification. Enrollment interruption, backup/recovery flows, same-account session replacement, continuous event-stream revocation, older callers without expectations and broader accessibility/operational qualification remain open. A1/A2/A5 and separate-Plan replacement remain in progress.
