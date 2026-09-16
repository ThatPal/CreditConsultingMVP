# U1 batch 16 — Major coordination in shared focus

Baseline d622b07; independent codex/astra-production branch. Reconcile shared focus with existing Major authority; no new lifecycle, command permission, or schema.

The workspace reads client-scoped uncleared restrictions and the latest active Major case, selecting only safe identities/status/version fields. Coordination restrictions precede ordinary Plan work. Open Live session navigation still takes priority, but a LIVE_EXECUTION restriction identifies consultant ownership and instructs the client to wait. LIVE_RESTRICTED is distinct from persisted PAUSED status. Active Major case context supplies the no-round fallback after actionable Plan work.

Focus links carry the actual restriction case ID. Major pages fetch that exact client-authorized case and preserve its identity across sections instead of silently opening whichever case was most recently updated. Existing query-root invalidation still applies. No internal rationale or source fingerprint is exposed.

## Evidence

- 41 API tests pass: focus projection, persisted Plan/workspace integration and Major service guards, isolated DB 5446 / Redis6396. Real Major case/recommendation/decision/restriction records verify shared Center/workspace focus, private-field exclusion, cross-client rejection, and clearing removes restriction focus while returning revalidationRequired. These tests do not independently prove a persisted Strategy/Round remains stale after clearing; existing command behavior is unchanged.
- 14 web tests pass: exact-case fetch/navigation and workspace query invalidation.
- Five-package build and root lint pass. An initial test assertion incorrectly expected the command payload outside its result envelope; corrected to assert the actual envelope including cleared count and replay status.
- Isolated Playwright browser: coordination page at 1440 and 390 pixels, selected case preserved in section links, no horizontal overflow or page errors. Response fixture after real synthetic login; all non-read requests blocked after login. Mobile capture reviewed. This is not full Major workflow/visual acceptance.
- Only the ownership-verified Astra API3015 restarted after build. Other versions untouched.

## Remaining acceptance

U1 NOT PASSED. Upcoming scheduling priority, comprehensive available-action/source-blocker contracts, final reference-state/accessibility acceptance and persisted full Live lifecycle coverage remain open. Major lifecycle-specific focus and multi-case guidance still need final reconciliation. This batch does not claim production qualification or U1 completion.
