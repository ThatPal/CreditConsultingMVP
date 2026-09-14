# Astra implementation pass 10: Consultant tab recovery

Date: 14 September 2026. Continues pass 9 on `codex/astra-production`.

## Delivered

- Unfinished consultant Plan edits are copied to session storage, scoped by authenticated user ID and client ID. Returning in the same tab offers explicit restore or discard. No automatic shared Plan save or publication occurs.
- Recovery retains the original Plan identity, version, revision and baseline. A newer server draft blocks save/approval rather than silently rebasing old work. Conflict detection now includes publication version and status as well as optimistic revision.
- Copies expire after 24 hours, are removed when the editor becomes clean, and are cleared on successful sign-out or detected session loss. Storage failure shows a warning to keep the page open and save explicitly. Unsupported/corrupt records are ignored.
- Consultant dirty/busy state now participates in the shared navigation guard. Shared wording covers explicit draft saving as well as autosave.
- A failed server refresh after a mutation no longer replaces the editor with stale cached query data. Local recovery remains available when confirmation cannot be fetched.

## Verification and limits

- Focused consultant, navigation and authentication tests cover restoration after remount, original-revision conflicts, explicit discard, expiration, scoped keys and recovery cleanup. Web production build, subsequent typecheck, targeted ESLint and whitespace checks pass. Existing bundle-size warning remains.
- Live consultant verification reached the authenticator challenge; authenticated browser recovery was not verified in this pass. No MFA configuration was changed or bypassed. Restored the regular client demo afterward.
- Session storage is tab-local browser storage, not cross-device recovery or a durable offline database. Closing the tab, clearing storage, session loss or expiration can remove the copy. Shared-device and browser-restoration behavior still require qualification. Existing XSS/privacy controls remain production gates.
- The editor still uses explicit server Save draft. Recovery requires current server context to load; it does not provide full offline startup. Conflict comparison/merge, server autosave, upload recovery and exact replacement-version reconciliation remain open.
- Continue response-aware preview, path/multi-Plan lifecycle and full production qualification. This pass does not complete A5 or establish production readiness.

All edits remain on Astra with no changes to other branches/runtimes, no migration, push, merge, publication or external messages.
