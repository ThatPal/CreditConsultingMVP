# Pass 40: Live-session revocation

## Delivered together

Production live-update connections now revalidate the original authenticated session on each five-second heartbeat and before sending refresh events. A missing or changed session, inactive account, changed role/client scope, or lost staff MFA verification ends the connection and sends a session-ended event. Existing client subscription authorization remains in force. Concurrent checks share a pending lookup; closing the connection stops timers/subscriptions and ignores late results.

The browser handles session-ended through the existing private-state cleanup and sign-in recovery flow. If an event connection fails without that message, it checks current authentication so a rejected reconnect can also clear the stale account. A temporary lookup/network failure closes the server stream for reconnection without falsely announcing session expiry. Client callbacks are removed on cleanup.

The production app supplies the session resolver; the router option remains optional for existing direct-router test doubles. Each connection incurs periodic authentication lookups; throughput and operational load are not yet qualified.

## Verification

Eight API guard tests and twenty-one web tests passed (live-update recovery, session recovery, and pending work), for 29 focused cases. The three new browser-component tests were rerun after callback cleanup and passed. Scoped lint, whitespace checks, and grouped API/web builds passed. The existing web bundle-size warning remains. Only the verified Astra API process was restarted; readiness passed.

A fresh headless Chromium context opened the synthetic review account's saved Plan response. A separate request in that isolated context revoked its actual server session without invoking the application's cross-tab broadcast. The idle editor received exactly one server session-ended event, disappeared, and returned to sign-in in 4.3 seconds without a click or reload. This verifies the heartbeat path against the real API. No Plan response, document, outcome, or publication was changed; user-visible browser tabs were untouched. Raw script/results remain ignored under .tmp/astra-runtime/stream-revocation-*.

## Remaining

This closes the previously recorded idle event-stream revocation gap. It does not qualify every staff recovery path, browser suspension/offline timing, session race, stream load, or consultant screen. Separate published-Plan replacement policy and broader accessibility, operational, and production qualification remain open. A1/A2/A5 remain in progress; the overall product is not yet production-ready.
