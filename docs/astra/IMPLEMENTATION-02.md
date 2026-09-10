# A1/A2 implementation pass 2: Plan authoring and safe revisions

Continued on 10 September 2026 at the user's request. This pass strengthens the Plan reference slice and part of A5's revision contract. A1, A2, and A5 remain open; this is not a production-readiness declaration.

## Delivered behavior

- Replaced the consultant's long stacked form with a step navigator, focused authoring area, contextual client preview, source-comparison drawer, and sticky save/approval actions. Narrow screens stack the workspace; wide screens expose all three areas together.
- Consultants can add, remove, and reorder steps, edit client instructions and private rationale, choose completion methods, and edit explicit All/Any prerequisite groups. Display order does not rewrite dependencies. Existing path memberships, deep links, structured schemas, and manual-protection flags survive saving.
- Completion method determines the owner. The server rejects inconsistent owner/method combinations, duplicate step identities, repeated prerequisites, mixed rules within a group, cycles, and invalid path references.
- Background refreshes retain unsaved edits. A newer server revision blocks overwrite and offers an explicit saved-version review/discard choice. Failed saves retain local edits. Browser unload warns about unsaved changes. This does not yet provide autosave, offline recovery, or protection against every in-app navigation.
- Draft saves update the same version and existing step records, rather than deleting execution history or creating a new published-version number on every save. A revision of a published Plan creates a separate private version. Title and purpose remain private until approval; approved metadata is then reflected in the Plan projection.
- Plan edits, approval, reconciliation, client outcomes, and consultant verification coordinate through the owning Plan's database row lock. Optimistic revision checks prevent two editors from overwriting one another, including when creating the first replacement draft.
- Completed, in-progress, awaiting-verification, unable, and cancelled steps retain their status and timestamps. Recorded progress prevents changing the meaning or prerequisites of that step. Original outcome records remain attached to their historical items. Approval carries forward any progress recorded on the published predecessor while its replacement was being edited.
- Source review compares actual published-review and goal-revision references. It shows before/after labels and retained progress, requires a reason, and uses a server-computed source fingerprint. Reconciliation rejects an outdated comparison; approval rejects outdated source references. Foreign or nonexistent source references cannot be saved as valid client sources.
- Updating sources preserves an existing draft's edits and step identities. A published Plan pauses for source review until the replacement is approved. Approval resolves that replacement's reconciliation Attention item and refreshes the consultant queue/context.
- Client preview excludes consultant rationale. Approval sends the exact reviewed revision. Client outcome idempotency lookups are scoped to the client and replay safely after acquiring the Plan lock.
- Denied approval offers identity verification with a return to the saved draft, while retaining the requirement for authorized client access. The browser verified expiration, re-verification, return, successful approval, and removal of the stale review-work count.

## Data and compatibility

Migration `20260910190000_astra_plan_version_metadata` adds nullable title/purpose to PlanVersion and backfills from the parent Plan. Applied only to Astra's database. Existing historical metadata that was overwritten before this migration cannot be reconstructed by the backfill. New service writes populate the version fields; read fallbacks support older fixture writers.

The approval HTTP request now requires `expectedVersion`. Source reconciliation requires `expectedVersion`, `expectedSourceFingerprint`, and `reason`; clients cannot submit arbitrary replacement source IDs. Internal approval callers remain compatible with the optional service argument and must be migrated to exact revision checks where appropriate.

## Verification and observed limits

- API and web production builds pass. Targeted lint and whitespace checks pass. The focused suites contain 16 API tests and 12 web tests; the final reconciliation change was also rerun separately.
- Focused API integration/validation suites cover draft identity, metadata privacy/publication, progress/history preservation, concurrent edits, stale previews, source changes before approval, source ownership rejection, dependency rules, scoped outcome replay, verification, and reconciliation queue resolution.
- Focused web suites cover saved graph/schema/path hydration, unsaved-edit conflict retention, failed-save recovery, private-rationale exclusion, exact approval tokens, client action restrictions, and realtime query roots.
- Real browser/API exercised a separately named synthetic `Astra QA Plan review` client: title edit, step reorder, save/reload, All-to-Any dependency edit, client preview, initial approval, unchanged source comparison, new goal comparison, replacement creation, and reapproval.
- Inspected desktop and 390px mobile layouts, source drawer, labeled controls, disabled states, and sticky actions. Mobile document and main content had no horizontal overflow. This is not a complete keyboard/screen-reader accessibility audit.
- The browser exposed a duplicate Content-Type header that mocked API tests did not catch. Removed the duplicate and verified real saves. Build-time warnings for the large web bundle and the existing pg concurrent-query deprecation remain tracked work.
- QA data and runtime files stay in ignored Astra-only storage. No other branch, database, environment, real customer record, or external provider was modified.

## Continue next

1. Complete typed client outcome forms and consultant verification UX against the real schema, including validation, attachments, corrections, and durable evidence history. Automated verification must have a real producer and explicit failure/retry behavior.
2. Complete path authoring/selection/retirement, unreachable-state validation, semantic source comparison beyond reference labels, and all completed/cancelled/stale Plan lifecycle behavior. Do not infer this is finished from the current builder.
3. Add durable draft recovery and safe navigation, then prove worker/SSE propagation with independent client and consultant sessions. Complete source-mutation coordination across goal/review publication and Plan approval.
4. Continue the A1/A2 shared next-action contract and A3 provider replacement described in ROADMAP.md. Real report ingestion, assisted AI, email, payments, calendar/live work, Admin workflows, operations, and launch qualification remain required.

No deployment, push, or merge into the other project versions occurred.
