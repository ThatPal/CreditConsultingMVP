# U1 batch 26 — Notification recovery, menus and contrast boundaries

Baseline 35bd281. Independent Astra; U1 NOT PASSED.

Notification query failures previously fell through to an empty list and could claim the user was caught up. Loading, failed read and confirmed-empty states are now distinct. Failed reads offer a retry and suppress the mark-all-read command. The notification popover is a named modal dialog with an explicit close button, initial heading focus and return to its trigger after closing. Notification and account triggers expose their controlled popup identities. No notification writes or external messages were sent during browser verification.

## Evidence

- Six desktop/mobile browser scenarios across Home/Center/Plan verify account menu keyboard traversal and Escape focus return, notification focus placement/trapping, failed-read retry to confirmed empty, close-button focus return and no page overflow. Controlled 503/empty response fixtures, isolated synthetic account browser; all non-read requests blocked after login. Results and reviewed mobile capture in docs/evidence/u1-menus/.
- 25 App/Shell tests pass. Added contrast assertions cover advisory gradient endpoints, brand button endpoints, and dark surface/base-gradient colors with their intended foreground tokens. Existing tests cover light surfaces and control boundaries. These checks do not prove all rendered translucent blends, disabled states, graph marks or local overrides.
- App regression contained an outdated progressbar expectation after batch24 replaced Home loading with an announced skeleton. Updated it to assert the actual loading status text; rerun passes.
- Five-package build and root lint pass.

## T3 contract inspection — still open

Compared the U0–U1 package sections on shared source/currentness/blocker/action projection and allowed U4 Plan adapters with the frozen API/events query DTOs (read envelope, GetPortalHome, GetCreditCenter, GetCreditPlan). Current service.ts exposes currentFocus navigation, Plan summary, Profile currentness, restrictions and source versions. clientAvailability.ts exposes response/help/completion booleans and reasons for Plan read-only, owner, verification, step status and form configuration.

This is not the complete frozen read envelope: there is no shared typed collection of availableActions or client-safe blockers/warnings across all three screens. Plan prerequisite titles/status and Major restrictions exist as separate reads; next-step links are navigation, not command authorization. Missing Review/service/access and source-owned dependency affordances must be traced to their actual domain queries before introducing a shared adapter. Commands must continue to revalidate and no global Major or expired-Profile denial should be invented for unrelated Plan responses.

Next bounded T3 work: inventory existing guard/source coverage and implement only supported shared blocker/action projections with tests; record unsupported source ownership and U3/U4/U6 removal boundaries. Do not mark this inspection as T3 acceptance. V3 rendered contrast/remaining dialogs, T4 final recovery matrix, V1 final reference comparison and V4 Decisions/Nurture disposition remain open.
