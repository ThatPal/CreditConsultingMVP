# Pass 42: Live collection refresh and document search recovery

## Delivered together

The live-update query map now includes the actual client document list and picker, Plan libraries/version history/private response queries, current Review/eligibility/consultant queue, and consultant journey/timeline summaries. These supplement existing query roots instead of renaming routes or changing server permissions. Authenticated query responses remain the source of displayed data; events only trigger refreshes.

Refresh payloads are parsed defensively. Invalid JSON, missing/non-array domains, non-string entries and unknown-only domains are ignored. Recognized domains in a mixed future-version message are retained and deduplicated. Prototype property names cannot masquerade as supported domains. The listener ignores updates after cleanup. Connection copy now describes connected/reconnecting state in plain language and explains that recent changes may not yet appear.

The browser exercise exposed an adjacent document search defect: no matches hid the toolbar and incorrectly showed the first-use empty library. Filtered searches and later empty pages now keep the controls visible, explain that no documents match, and offer Clear search and filters, which resets the URL search/type/status/page state. A truly empty unfiltered first page retains the original upload-oriented state.

## Verification

Twenty-nine distinct focused tests passed across live mapping (5), session handling (3), refresh validation/integration (10), Plan live-update protection (2), and Documents (9). The integration test drives a real query cache and saved-response component through a live event: an unchanged revision stays usable; a changed revision retains local text, pauses writes, supports keeping local answers, and loads the newer saved response only after explicit review. No automatic mutation occurs in that scenario. Collection invalidation leaves unrelated payments/current-user queries intact and preserves cached values until queries refresh. Unmounted listeners no longer invalidate queries.

An initial test assertion ran before a closing dialog transition completed; it was corrected to await the accessible control. Typechecking also caught a Playwright-only option mistakenly used in a Testing Library assertion; it was removed. Scoped lint, whitespace checks, and the final web build passed with the explicit Astra API URL. API code was unchanged; no API rebuild/restart or migration was needed.

In a separate Chromium context, the synthetic review account opened its Plan document picker and a document-list tab, both filtered to a unique test filename. A real API upload produced an outbox/live event and the file appeared in both screens without reload. A real API deletion produced the second event and removed the file from both screens. The synthetic file was cleaned up, no attachment was selected, and no Plan response/submission was changed. The test's first upload attempt omitted the required category and was correctly rejected before creation; the corrected request used GENERAL_CLIENT_DOCUMENT. User-visible tabs were untouched. Ignored evidence is .tmp/astra-runtime/document-live-review.mjs and document-live-results.json.

## Remaining

Private draft save/discard functions currently do not emit their own targeted notifications. The newly covered draft queries refresh when a corresponding event arrives; this is not proof of immediate private draft synchronization across devices. Targeted private notifications, write/event ordering, same-revision document availability changes in open editors, staff editing reconciliation, first-connect gaps and broad event-domain coverage need further qualification. Existing explicit conflict checks remain necessary.

This advances A2 live-query consistency and the A5 response slice. A1/A2/A5, separate published-Plan replacement, complete paid-service integrations and broad production qualification remain in progress.
