# Astra implementation pass 4: Plan documents and evidence snapshots

Date: 10 September 2026. Branch: `codex/astra-production`. Continues pass 3; A1/A2/A5 remain in progress.

## Delivered

- Clients can attach up to five existing private documents to a Plan response or help request. The library picker supports search, type filters, and pagination. New documents can be uploaded inside the response using the existing upload controls, without navigating away.
- Selected files are named and removable. Removing a selection does not delete the library file. Submission is blocked while an upload is in flight; uncertain response retries preserve the attachments and idempotency key. Corrections preselect available current files from the previous response and explain why old/unavailable files need replacement.
- The outcome transaction validates file ownership, client visibility, availability, uniqueness, and count. Document rows are locked while attaching or verifying, serializing against ordinary replacement/deletion updates. Rejected attachments do not create a partial response.
- Each submission stores immutable file identity/name/type/size/hash snapshots and question-label definitions. History uses original question labels for new responses, with the prior fallback for legacy events. Existing response records are not backfilled with invented historical labels.
- Client and consultant histories include authenticated file downloads. A replaced document retains its original ID and submitted bytes; history labels it as the original version. Deleted, hidden, or hash-mismatched files are marked unavailable. Their submission metadata remains in history.
- Verification rejects unavailable attached evidence and permits a correction request. Corrected responses create new events and attachment records; previous evidence is preserved.

## Validation and runtime

- Migration `20260910200000_astra_plan_evidence` deployed only to Astra PostgreSQL on port 5445; Prisma client regenerated. Adds nullable response snapshots and a PlanOutcomeAttachment relation with a unique outcome/document pair. No changes to the other versions or their databases.
- API production build and web production build pass. Targeted ESLint passes. Thirty API tests pass across all five Plan suites. Nineteen web tests pass across five focused suites for Plan response/review/authoring and document screens, including selection/retry, immutable label rendering, unavailable download controls, upload-in-progress protection, removal without deletion, and correction prefill.
- Browser review at the existing mobile viewport used only the synthetic Astra QA Plan review client. Selected a private file, submitted the response, inspected its history, downloaded as client and consultant, and verified completion. The consultant's active work returned to zero. Roles were switched sequentially; this is not proof of independent simultaneous-session realtime delivery.
- Synthetic PDF upload and owner download were exercised through the authenticated HTTP APIs (200); another client's direct download returned 404. Browser native file selection/drop itself was not automated; inline upload behavior is covered by component tests and the real upload endpoint was exercised separately.
- Mobile screenshots inspected the selected-file/upload controls and consultant evidence/decision controls. Full keyboard, screen-reader, device-matrix, and scroll/sticky-action qualification remains open.
- Astra API restarted on 3015 and readiness reports PostgreSQL/Redis ready. Preview remains on 5195. Existing web bundle-size and pg concurrency-deprecation warnings remain.

## Next work and limits

1. Finish paginated/exportable history and benchmark history queries across many steps. Current UI still shows the most recent 20 events per stable step. Submitted-file download is available; inline evidence preview and rich comparison remain to be designed.
2. Finish help-request resolution/reopening, full path lifecycle, multi-Plan selection, complete consultant history after verification, and response-aware publication preview. The pending-review panel currently disappears once no steps need verification.
3. Add durable form drafts/navigation recovery, including in-flight upload/navigation handling, and prove independent-session realtime invalidation. The current response retains data in mounted component state only.
4. Qualify the shared document subsystem for production: byte-level file validation, malware scanning/quarantine, physical-storage integrity checks, retention/holds/deletion and restore, and complete endpoint permission tests. This pass validates database availability/hash metadata; it does not prove a storage object exists at verification time or provide immutable object-store retention. Soft-deleted files cannot be downloaded; historical metadata remains, and FK restrictions prevent accidental physical row removal while referenced.
5. Continue the full roadmap. This pass does not establish production readiness for reports, AI, payments, email, scheduling/live sessions, Admin, or all client/consultant screens.
