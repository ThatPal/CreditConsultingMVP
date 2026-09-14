# Pass 29: Saved response library

## Delivered together

The client Plan page now offers a saved-response library, including when no current approved Plan is available. It loads on demand and includes private drafts across the client's published Plan history, so answers for removed or replaced steps are no longer stranded behind current-step lookup.

The client-only endpoint scopes every row to the authenticated actor and client. It returns original Plan/step titles, instructions, form labels and saved text, rechecks attachment availability and omits consultant rationale. Pagination uses immutable draft IDs with 20 rows per page, so deleting the cursor record does not invalidate the next page. This is stable identity order, not a recency-ranked list.

The library reuses read-only inspection and guarded discard, with wording suitable for both current and historical drafts. Discard refreshes library pages and invalidates individual draft reads. No automatic migration, submission or rewrite happens when opening the library.

## Verification

All seven Plan API suites passed (61 cases). Added integration coverage creates 22 saved steps, removes a step through approved revision, inspects its original draft, checks pagination after cursor deletion, verifies actor/client isolation and checks that consultant rationale is not exposed.

Two relevant web suites passed all 11 cases. Library coverage verifies on-demand loading, inspection of original saved text without writes and next-page loading. Existing saved-response/confirmation coverage remains green. Scoped lint and whitespace checks passed. API/web each built once at the grouped boundary and passed. Existing PostgreSQL concurrency and web bundle-size warnings remain. The verified Astra API was restarted and readiness passed; no migration was required. Protected branch heads remain unchanged.

## Remaining

The library exposes saved server records, not unsaved form text. Live Plan transitions and interactions with an already editing response still need broader concurrency/recovery qualification. Search/recency views, automatic retention policy and full browser/mobile/accessibility qualification remain open. Consultant browser evidence still requires MFA completion. Separate-Plan replacement and A1/A2/A5 remain in progress.
