# UI-F01–UI-F03 implementation record

Date: 2026-09-17. Branch: `ui/portal-shell-credit-center-overview`. Engineering implementation complete; visual approval pending. Scope: global Client shell, Credit Center shell, Overview only.

## Authority and resolved blocker

Read the three linked Feature Packages in [the preflight record](UI_F01_F03_CONTRACT_BLOCKER.md). Latest user clarification explicitly defers atomic Review/Profile/Analysis/Plan publication. Existing independently published Review and Plan sources remain authoritative for this slice. No API, schema, publication transaction, AI process, CRM/Admin domain workflow or Plan behavior was changed.

## Data and compatibility mapping

The rendering component accepts `OverviewModel`. `buildOverviewModel` is a replaceable read-only compatibility adapter over existing client-safe screen responses, not raw database tables. Future atomic screen queries can supply the same view model without redesigning the UI. Existing credit/Plan query keys and invalidation remain in use; independent reads do not claim an atomic combined version.

| Display | Existing authority and processing | Publication/privacy/comparison rule |
| --- | --- | --- |
| Scores and metrics | `current.projection.profile` from `/api/v1/client/credit-profile`; existing finite/unknown/partial adapter; report date from accepted source provenance | Client-safe published whitelist only; never infer missing values or a model/range/inquiry window. No AI at render time. |
| Baseline / What Changed | Current immutable publication and earlier published history; equivalence helper requires known metric definitions or same bureau/model/range | Legacy projection omits comparability metadata, so no numeric deltas are invented. Neutral noncomparability state links to History. First publication gets Baseline. Future equivalent facts can use the same delta/render model. |
| What Matters Now | `current.projection.findings`, already filtered to approved client-safe findings by the existing server | First three in published array order. Existing projection lacks separate importance/sort metadata; severity is not invented as an importance rank. Raw draft/AIOutput is never fetched. |
| Consultant Assessment | Published `analysisSummary`, falling back only to published recommendation explanation | Existing consultant-approved wording; no new Overview authoring or AI generation; Analysis owns deeper content. |
| Current Priorities | `/api/v1/client/plan`, existing published Plan version/items and canonical order | Known published statuses only; completed/cancelled/superseded steps excluded from summary. Status/dependency behavior remains in Plan. No-action requires an authoritative zero open-action count, not an empty fetch. Failed Plan reads are explicit and retryable. |
| Progress | Existing `workspace.currentFocus` title/detail/owner/action from server projection | No client-generated milestone, readiness percentage or timeline estimate. Journey supplies broader context. |
| Context notice | Deterministic presentation of existing publication/currentness/profile quality | At most one Overview notice; no-review/in-progress/stale/partial copy is fixed UI explanation, never professional advice. Versioned Admin-managed message-library integration is not added in this UI slice. |

Prepared professional-content AI processes, governed finding libraries, richer source/calculation metadata and atomic publication remain owned by the existing/planned domain work. This slice adds no duplicate records or consultant writing workload and does not claim to implement those backend requirements.

## States and failure handling

No Review, unpublished Review in progress, first published baseline, noncomparable history, available comparable-change rendering, partial/unknown values, stale publication retained, no current Plan action, Plan-read loading/error/retry, and existing overall query loading/error handling. Current-only Review context and historical deep-link guard are preserved.

Available-comparison behavior is tested with explicitly comparable model inputs. The live legacy API lacks the required metadata, so there is no claim of live numeric historical comparison. Full historical Credit Center switching remains deferred and is not advertised.

## Changed files

Application:

- `apps/web/src/layouts/AppShell.tsx`
- `apps/web/src/layouts/ClientPortalNavigation.tsx` (new)
- `apps/web/src/theme/portalSurfaces.ts` (new)
- `apps/web/src/features/credit-center/CreditCenterShell.tsx`
- `apps/web/src/features/credit-center/CreditCenterNavigation.tsx`
- `apps/web/src/features/credit-center/CreditOverview.tsx` (new)
- `apps/web/src/features/credit-center/overviewModel.ts` (new)
- `apps/web/src/pages/PublishedCreditCenterPages.tsx` (delegates client Overview only; other inner content unchanged)

Tests:

- `apps/web/src/layouts/ClientPortalNavigation.test.tsx` (new)
- `apps/web/src/features/credit-center/overviewModel.test.tsx` (new)
- `apps/web/src/features/credit-center/CreditNavigation.test.tsx`
- `apps/web/src/pages/PublishedCreditCenterPages.test.tsx`

Records/evidence:

- `docs/reconciliation/UI_F01_F03_CONTRACT_BLOCKER.md` (user-approved deferral)
- `docs/reconciliation/UI_F01_F03_IMPLEMENTATION.md` (this record)
- `docs/evidence/ui-f01-f03/README.md`, `browser-results.json`, and the eleven PNG captures listed there

## Verification

Targeted component/model/navigation suite: **55 tests across 5 files passed**. Coverage includes all global primary parents, all Credit Center areas, review-context preservation, published-only professional data, unexpected draft Plan rejection, unknown versus zero, baseline, invalid comparison suppression, valid comparison, top-three summaries, stale publication retention, no-action authority, and Plan read failure.

Browser: **passed**, including desktop/mobile layout, both sheets, focus trap/return, Escape, route switching/back, active parent, single H1, widths 390–1440, no-review/in-progress read fixtures, and no page errors. See [evidence index](../evidence/ui-f01-f03/README.md).

Final `pnpm --filter @credit/web build` **passed** (TypeScript project build and Vite production bundle). Changed-file ESLint **passed**; `git diff --check` **passed**. No broad regression/domain suite was run.

## Review gate

Follow-up shell correction: see [updated reference comparison, changed files, tests and screenshots](../evidence/ui-shell-correction/README.md). This supersedes the initial shell screenshots/branding treatment while leaving Overview content and the backend deferral unchanged.

UI-F01/UI-F02/UI-F03 only. Visual review remains required. No UI-F04 or later Credit Center implementation began. Atomic publication remains explicitly deferred; no production readiness claim follows from these UI checks.

Follow-up requirements review: [UI-F03 review and profile correction](UI_F03_REVIEW.md). Overview still needs the recorded visual adjustments and contract qualifications resolved before acceptance; previous engineering checks do not imply full requirements compliance.

Overview visual corrections are now implemented; see [latest evidence and checks](../evidence/ui-overview-polish/README.md). Visual approval and the documented backend dependencies remain outstanding.

Final styling pass: [latest review captures](../evidence/ui-final-visual-polish/README.md). Larger desktop scores, increased spacing and hierarchy, cool neutral assessment plane as explicitly requested, compact header refinement. READY FOR FINAL VISUAL REVIEW; no automatic freeze or UI-F04 progression.
