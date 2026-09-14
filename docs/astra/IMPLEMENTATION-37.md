# Pass 37: Identity refresh boundaries and uncertain upload recovery

## Delivered together

The current-user lookup compares the refreshed user ID, linked client, role and status with the tab's established identity. A difference triggers session-loss cleanup before adopting the replacement account, closes private editors and requires sign-in. Successful ordinary login also notifies other Astra tabs using the existing private-data-free transport. The MFA challenge path does not yet send that notification.

Upload failures now distinguish definite API rejection from uncertain transport/server failure and confirmed upload followed by attachment callback failure. The latter cases explicitly direct users to inspect existing Documents before uploading again. Plan attachment recovery closes the upload form, refreshes the document picker/list queries and leaves existing answers unchanged. Users can open Attach existing documents and search for the file. No automatic duplicate upload or automatic attachment selection occurs.

## Verification

36 tests passed across authentication recovery (12), pending-session work (6), upload recovery (4) and authentication pages (14). New checks cover account/client/role/status changes, network failure, server failure, confirmed-upload callback failure and definite validation rejection. Scoped lint and whitespace checks passed. The grouped web build passed once with the existing bundle-size warning. No API change or runtime restart was required.

In an isolated Chromium context, the synthetic review account's cookie session was switched through the real API to the regular synthetic client. A controlled hidden-to-visible event sequence triggered the real current-user refresh. The old Plan editor disappeared and sign-in was required. This is browser evidence of the refresh guard, not of a naturally generated OS focus event: initial headless focus attempts did not trigger the event listener. Repeated setup also reached the configured sign-in rate limit; it was left intact and the final run occurred after cooldown.

In a separate context, a synthetic PDF upload was sent to the real API, its successful document ID captured, and delivery of the acknowledgement aborted. Check existing documents led to the picker where searching found that accepted file. The browser recorded exactly one upload POST. Its recovery screenshot was inspected. The synthetic document was then deleted via its authorized API; its audit/history remains as normal. No response draft, outcome, publication, user-visible open tab or completed Plan was changed. Raw script/results/screenshot remain ignored under .tmp/astra-runtime/account-upload-* and upload-recovery-existing.png.

## Remaining

Detection through current-user refresh is not an atomic fence on every request: tabs that miss notifications may retain old state until their next session check. MFA challenge/enrollment transitions, capability changes beyond role/status, accepted-file selection/autosave after lost acknowledgement, durable upload idempotency, full accessibility/mobile qualification, consultant visual review and separate-Plan replacement remain open. A1/A2/A5 are still in progress; this does not establish production readiness.
