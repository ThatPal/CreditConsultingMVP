# Astra implementation pass 11: Consultant draft comparison

Continues pass 10 on `codex/astra-production`.

## Delivered

- The newer-version dialog now compares unfinished edits against the loaded server Plan instead of showing only its title. Opening the comparison neither saves nor discards work.
- Comparison includes Plan metadata/source versions, stable-identity step additions/removals and positions, instructions, private rationale, completion method/owner, response schema, protection and progress, paths and prerequisite rules.
- Object property ordering does not create false response-schema differences. Differences are presented with labeled local/saved columns that stack on narrow screens, readable wrapped text, a count, and an explicit empty state.
- Existing Keep my edits and explicit Discard edits and load saved Plan remain. Comparing does not advance the local revision or bypass stale-save/approval protection.

## Verification and remaining work

- Focused comparison and consultant tests cover stable identity/reordering/removal, source and dependency changes, response-schema ordering, and opening/closing a conflict review without a write. Production web build, targeted lint and whitespace checks pass. Existing bundle-size warning remains.
- Authenticated consultant browser review is still pending the MFA verification recorded in pass 10. This pass has component/integration evidence, not completed responsive/accessibility browser qualification.
- This compares two current snapshots. It is not a three-way merge or selective conflict resolution, and it does not fetch an immutable comparison snapshot. Background updates can update the saved side; existing optimistic version checks still apply to future saves.
- Continue selective conflict handling and response-aware publication preview, then remaining Plan lifecycle and the full roadmap. No production wave is marked complete.

No backend migration, external action, push, merge or changes to other project versions occurred.
