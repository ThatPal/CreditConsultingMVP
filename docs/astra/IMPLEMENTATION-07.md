# Astra implementation pass 7: Private client response drafts

Date: 10 September 2026. Continues pass 6 on `codex/astra-production`.

## Delivered

- Client Plan responses now have an explicit Save draft action. Values, notes/help mode, and selected document IDs are stored on the server, scoped to the client actor and exact Plan item. Drafts do not create outcomes, consultant attention work, or published response history.
- Returning to a step offers Resume saved response or Start a new response. Restoring preserves answers and current available attachments. Missing/private/deleted/superseded attachments are excluded with a warning. Changes to the step after the draft was saved are identified for review before restoration.
- Saves use an optimistic draft revision and exact step update token under the Plan transaction lock. Another tab's newer draft or changed Plan context prevents overwrite. Submitting also checks the loaded draft revision/context, preventing an old tab from deleting a newer saved draft.
- Submission clears the actor's draft in the same transaction that records the outcome. Successful replay remains idempotent. Saved response data never becomes a consultant submission merely because Save draft was pressed.
- Failed saves retain mounted answers. Save/submission controls are disabled during an active save/upload/submission. Status text distinguishes a private saved draft from a response submitted to the consultant. Browser unload warnings cover unsaved changes and uploads.
- Disabled automatic draft-query refresh on focus/reconnection, so a background fetch does not silently advance the revision used by an older form. Reload fetches current server state for explicit review.
- Browser review caught duplicate React sibling keys keeping a submitted form on a completed step. Assigned a separate form identity and added a regression that verifies completion removes the form and retains history.

## Verification

- Migration `20260910210000_astra_response_drafts` applied only to Astra database port 5445, with Prisma regeneration. Adds PlanResponseDraft keyed by item/actor. No changes to the other project databases.
- 33 API tests pass across five Plan suites. Draft coverage includes persistence, actor/client isolation, conflicting save revisions, changed context, conflicting submission revisions, no partial domain/attention activity, and atomic draft removal on submission.
- 20 web tests pass across six focused Plan suites. Added private restore/save/remount recovery, save-conflict retention, and removal of the form after completion. API/web production builds and targeted ESLint/whitespace checks pass. Existing bundle-size and pg concurrency warnings remain.
- Real mobile browser checked explicit save, private saved status, full reload, explicit restore, and successful submission on synthetic Astra QA Plans. Repeated after correcting the duplicate-key display bug: completed state retained history and removed response/draft controls. The Jordan demo Plan was not changed.
- API restarted only on port 3015. All work remains in the Astra checkout, branch, database and file store. No deployment, external notification, payment, push, or merge occurred.

## Scope limits and next work

1. This is explicit server draft saving, not autosave. Changes after the last successful save are not recovered after a crash or unsaved in-app navigation. The UI tells clients to save before leaving; browser unload warnings do not guard every router transition. Add coordinated autosave, navigation protection, and upload recovery next.
2. Consultant authoring drafts still need durable unsaved-edit recovery and offline/conflict handling. The existing explicit saved Plan draft behavior is unchanged.
3. Drafts are tied to exact item/version IDs. They do not migrate automatically to replacement Plans or provide cross-Plan recovery navigation. Add explicit review/rebase and draft-discard/retention controls; do not silently apply old answers to changed instructions.
4. Browser verification used one session and synthetic notes. Concurrent conflict coverage is at the service/component level, not a full two-browser/offline/device test. Complete attachment recovery, accessibility and shared-device/retention qualification before production.
5. Continue response-aware publication preview, path/multi-Plan lifecycle, independent-session realtime proof, A1/A2 and real integrations from the full roadmap. The platform is not production-ready.
