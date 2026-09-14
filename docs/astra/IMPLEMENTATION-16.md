# Pass 16: Multi-Plan discovery and safe resumption

The consultant workspace previously selected only the most recently updated Plan. This pass makes other saved Plans reachable without changing client publication selection.

## Delivered

- Client-scoped Plan library with bounded 20-record cursor pagination, working-version titles/status, update dates, empty/loading/error states and retry that retains loaded records. Cursor ordering uses immutable IDs so edits do not move records between pages; it is not a chronological ranking.
- Explicit Plan selection in the URL, scoped lookup with a 404 for absent or foreign Plans, and a link back to the most recently updated default. Selection is read-only and does not publish, promote or update the Plan.
- Query/editor identity and tab recovery are isolated by selected Plan as well as actor/client. Existing router protection guards query changes before discarding unsaved work. Unrelated URL parameters survive selection.
- Cancelled/superseded Plans expose version history rather than authoring controls. Existing default behavior remains compatible.
- MFA return links preserve the selected Plan; successful saves/approval refresh the library cache. Client publication context continues to identify the independently selected published Plan.

## Evidence

- Seven API tests across authoring integration and route access suites pass, including full 21-record pagination, cross-client Plan/cursor rejection and consultant/client-scope authorization.
- Fourteen library/consultant component tests pass, plus four navigation tests from the preceding run (18 distinct web cases). Coverage includes paging failure/retry, guarded URL switching, recovery separation and closed-Plan history-only presentation. An initial navigation test needed to await the dialog exit transition; the corrected test passes.
- API and web production builds and scoped lint pass. Existing bundle-size and PostgreSQL concurrency deprecation warnings remain. No migration.
- Only the verified Astra API process was restarted; /ready reports PostgreSQL and Redis ready. Protected branch heads remain unchanged.
- No new authenticated consultant browser/visual/accessibility evidence: the previously recorded MFA challenge still needs completion. Component tests are not a substitute for that qualification.

## Next work

A1/A2/A5 remain in progress. Multi-Plan discovery is delivered; cancellation/replacement policy and client-facing multi-Plan navigation remain open. Resolve those against authoritative business decisions before introducing lifecycle mutations. Also open: full graph/schema conflict resolution, independent-session realtime, cross-device/offline recovery, consultant responsive/keyboard review and the remaining production roadmap waves. Keep development in sustained related batches.
