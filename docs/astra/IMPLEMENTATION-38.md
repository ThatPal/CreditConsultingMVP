# Pass 38: Request account expectation and MFA refresh propagation

## Delivered together

The shared web API wrappers attach X-Credit-Actor to authenticated /api/v1 JSON, upload and download requests, using the identity established by the current-user lookup. Public goal intake and authentication remain available without this expectation. Local session loss clears the binding and blocks follow-up private wrapper requests until a current user is established again.

After resolving authentication, the API checks a supplied actor expectation before protected /api/v1 routers. A different authenticated user returns 409 SESSION_ACTOR_CHANGED; an anonymous caller with an expectation returns 401. Neither reaches the business operation. The web recognizes the mismatch code as session loss, clears private state and preserves the sign-in return path. The header never authenticates a caller or replaces role/client/capability authorization.

Successful MFA verification now uses the same notify-other-tabs refresh as ordinary sign-in. Password-stage challenge handoff and full MFA browser qualification remain separate work; no MFA configuration was changed or bypassed.

## Verification

Four focused server tests passed for mismatched GET/POST/DELETE, matching expectations, anonymous claimed identity and legacy omission. Thirty-five web tests passed across request wrappers (3), session recovery (12), pending-session work (6) and auth pages including MFA flows (14). Scoped lint and whitespace checks passed. Grouped API and web builds passed once each; the existing bundle-size warning remains.

Only the verified Astra API was restarted. The first immediate readiness request arrived before startup completed; the subsequent readiness check passed.

A separate Chromium context signed into the synthetic review account, opened an editable Plan and prepared an upload. The cookie session was changed through the real API to the other synthetic client without refreshing the old tab. Its real upload request retained the old actor expectation, received 409 SESSION_ACTOR_CHANGED, and the old editor closed into sign-in. The new account's authenticated Documents listing contained no test file. This verifies the actual CORS/header/middleware/browser handoff, not a mocked response. No Plan/outcome/document mutation or change to the user's open browser tabs was needed. Private test script/results remain ignored under .tmp/astra-runtime/request-account-*.

## Compatibility and remaining work

The header is optional for legacy/internal callers; only updated shared-wrapper requests receive this protection. Omission still uses normal server authentication and authorization. Direct fetch/EventSource callers, legacy non-v1 routes, same-account session replacement, authorization changes occurring after request authentication, MFA challenge transition notification and broader recovery/operational qualification remain open. This is an account-consistency guard, not a substitute for session revocation, CSRF controls or transaction authorization. A1/A2/A5 and separate-Plan replacement remain in progress.
