# Pass 32: Transport recovery evidence and server draft identity

## Delivered together

Client draft saves now send expectedDraftId alongside the reviewed revision. Outcome submissions send draftId alongside draftRevision. Under the existing Plan lock, the API rejects an identity mismatch before altering a draft or creating an outcome. A deleted/recreated draft at revision 1 therefore cannot be mistaken for the older revision-1 record by the updated client. Existing successful outcome replay remains unchanged.

The fields remain optional for compatibility with older/internal callers; the updated client always sends an ID or explicit null. Legacy callers that omit identity retain revision-only behavior, so this is not a claim that every integration is migrated.

## Verification

The earlier transport-test uncertainty is now covered with a new test using the real apiRequest wrapper and controlled fetch behavior rather than mocking apiRequest itself. Both sustained network rejection and HTTP 503 show recovery controls, retain local text, disable saving during failure and recover after retry. This proves the wrapper/component boundary, not a real-browser network outage or session-expiry path.

All seven Plan API suites passed (61 cases); the recreated-draft test now checks both save and submission rejection and no outcome creation. Four web suites passed (18 cases), including the two new transport scenarios. Scoped lint and whitespace checks passed.

The grouped web build passed once. The API build initially found an exact-optional-property type mismatch; after aligning the input type with the schema it passed. The verified Astra API was restarted and readiness passed. No migration was required and protected branch heads remain unchanged. Existing PostgreSQL concurrency and web bundle-size warnings remain.

## Remaining

Session-loss recovery, real-browser failure/accessibility/mobile qualification, and migration of all legacy identity-omitting callers remain open. Consultant visual evidence still requires MFA. Separate-Plan replacement and A1/A2/A5 production qualification remain in progress.
