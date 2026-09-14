# Pass 18: Start a separate Plan

The Plan library could resume existing records but offered no way to start another Plan after the first existed.

## Delivered

- Library action to start a separate Plan, preserving unrelated URL parameters and using the existing unsaved-navigation guard.
- Read-only new-draft context endpoint mode, with blank items and current source references while retaining explicit current-publication context. Merely opening the workflow creates no records. Combining a selected Plan ID and new mode is rejected.
- Independent new-draft recovery key, normal purpose/step validation, and clear copy separating creation, saving and approval.
- Successful first save immediately binds the returned Plan identity and revision, then replaces the temporary URL with the saved Plan link. If a subsequent read fails, recovery targets the created Plan rather than repeating creation. New unsaved Plans do not show another Plan's response queue.

## Evidence

Six authoring integration tests and 16 consultant/library web tests pass. Added no-write context/publication coverage, separate-Plan entry-link coverage and successful-create/failing-read recovery with a single POST. Initial creation fixture omitted the required step title; corrected fixture passes. API and web builds, scoped lint and whitespace checks pass. Existing bundle and pg warnings remain. No migration. Only the verified Astra API was restarted; health checked separately. No authenticated consultant visual evidence was added; MFA qualification remains open.

## Next

A5 remains in progress alongside A1/A2. Creation still uses the existing non-idempotent POST contract: a lost creation response (as opposed to a failed follow-up GET after receiving success) requires server-side request replay protection. Prioritize that with recoverable first-save handling, then source-grounded cancellation/formal replacement commands. Client-facing multi-Plan presentation, old queue-link reconciliation, graph conflict resolution and operational/browser qualification remain open. Other roadmap waves are unchanged. All work remains Astra-only.
