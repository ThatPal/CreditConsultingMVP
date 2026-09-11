# Astra implementation pass 6: Paginated Plan history

Date: 10 September 2026. Continues pass 5 on `codex/astra-production`.

## Delivered

- Client and consultant response histories now offer Load older responses instead of stopping at the most recent 20 events. Pages add older events in chronological order, retain previously loaded evidence, and remove the load action when the end is reached. Failed requests preserve the loaded history and offer retry through the same control.
- History has a bounded, keyboard-focusable scroll region, keeping long histories from pushing subsequent Plan steps down an unbounded page. The history summary and load action remain outside that scroll region.
- Authenticated history endpoints reuse the current published-Plan selection and visible-path projection. Client requests derive client scope from the session; consultant requests require scoped review.read capability. Other clients, private draft steps, and cursors belonging to another stable step are rejected.
- Cursor pagination orders by createdAt and ID, handling identical timestamps and new events inserted between page requests without offset-related duplication or omission. Historical events remain scoped to the same Plan/stable key and published versions up to the viewed version.
- Existing file snapshots/downloads, original response labels, help replies, and decisions render in older pages. A new latest outcome resets the paginated component so obsolete local pages do not carry into a new response state.
- The shared published-Plan lookup is extracted; loading an older page does not fetch every other step's history again. Full query profiling and large-Plan benchmarking remain open.

## Verification

- API/web production builds, targeted ESLint, and whitespace checks pass. Existing bundle-size and pg concurrency-deprecation warnings remain.
- 32 API tests pass across five Plan suites. New pagination coverage checks 45 equal-timestamp events across three pages, an event arriving between page loads, exact ordering/no duplication, foreign-client scope, wrong-step cursors, and exclusion of a newer private draft.
- 17 web tests pass across five focused Plan suites. New coverage exercises a failed older-page request, retained current evidence, successful retry, scoped consultant URL, and final-page control removal.
- Real mobile browser review on the synthetic Astra QA client loaded 20, then 40, then all 45 events. Oldest and recent records remained present; the final load action disappeared. Inspected the bounded scroll region. The extra archived events are explicitly synthetic fixture records in Astra only; no Jordan demo records were changed.
- Consultant pagination is covered by component request tests and the shared service's scope tests; it was not separately repeated in a consultant browser session in this pass. Full keyboard/screen-reader, concurrent revocation, and production-scale performance qualification remain open.
- No migration required. Restarted only Astra API port 3015. Other project versions remain unchanged.

## Next work

1. Durable response and authoring drafts across navigation/reload, with conflict detection and upload recovery. Current form state remains in memory.
2. Response-aware publication preview, multi-Plan/path lifecycle navigation and independent client/consultant realtime proof.
3. History export and richer evidence comparison. Pagination is complete for the currently selected published Plan's visible stable steps; this does not add navigation across all historical Plans.
4. Continue A1/A2 and the real integrations/other service workflows in the full roadmap. Production qualification remains outstanding.
