# Pass 17: Publication identity and Plan-specific follow-through

Multi-Plan review exposed a pre-existing publication-selection bug: saving a private revision changed the parent Plan timestamp, which could promote an older published Plan into the current client view. This pass addresses publication identity before adding cancellation/replacement commands.

## Delivered

- Client Plan selection now orders eligible published versions by approval time, with activation time, immutable creation time and ID as deterministic fallbacks. Draft updates, response activity and reconciliation timestamps cannot promote a different Plan. Legacy eligible versions lacking approval metadata remain readable rather than disappearing. This fallback is an implementation compatibility rule, not a newly recovered business decision.
- Home and consultant publication context already consume the same client Plan projection. Round preparation context used a separate parent-update-time selector; it now shares publication ordering while retaining its existing purpose/status eligibility rules.
- Closed cancelled/superseded Plans reject draft edits, approval and source reconciliation under the existing Plan lock. Leftover draft versions cannot reactivate a closed Plan through these commands.
- Consultant response review now requests the selected Plan's published version, with a scoped lookup and separate cache identity. Opening an older Plan no longer shows another Plan's verification queue. The client route continues to select only the current publication.
- New reconciliation and response work items link to their exact Plan. Existing work-item links are not migrated in this pass.
- Approval preview explains when another Plan will become current and confirms that prior history remains saved. Preview/save remain private; no new approval step was added.

## Verification

- Eight Plan/Phase 11 API suites passed: 53 cases. After the subsequent response-scoping/link changes, all six Plan suites passed again: 43 cases. Regression coverage includes editing an older publication, paused current publication, explicit reapproval, foreign-client selected execution rejection and closed Plan edit/approval rejection.
- Consultant authoring and execution-review suites passed: 16 web cases. Added approval-impact preview evidence and selected-Plan request assertion.
- API/web builds, scoped lint and whitespace checks pass. Existing bundle-size and PostgreSQL query-concurrency warnings remain. No migration.
- Only the verified Astra API process was restarted; health is checked separately. Consultant browser/visual/accessibility qualification remains pending the recorded MFA challenge; this pass adds no authenticated visual evidence.

## Remaining

A1/A2/A5 remain in progress. Source reading reconfirmed immutable published history, private proposals and explicit consultant approval, but did not establish a complete cancellation/replacement policy. Those commands and client-facing multi-Plan navigation remain open, as do cross-session race qualification, full graph/schema conflict resolution and the wider roadmap. Publication switching between different Plans currently retains earlier Plan records/statuses; it does not implement formal cross-Plan supersession. New library links and queues are Plan-specific, but older work items need a safe migration/projection policy. Continue sustained related batches within Astra only.
