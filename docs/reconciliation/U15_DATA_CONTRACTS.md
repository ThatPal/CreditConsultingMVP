# U1.5 read-only experience contracts

Scope: presentation adapters for current immutable publications. U3 owns structured report/Profile/Analysis publication; U4 owns canonical Plan migration. No schema, migration, duplicate record or client PDF parser was added.

## Current publication → experience

`clientSafeReviewProjection` remains the server authority. `adaptPublishedProfile` consumes only its named numeric fields. Non-numeric, negative, missing and non-finite values become UNKNOWN. Numeric zero is preserved but legacy aggregates are PARTIAL because their included/excluded account basis is absent. This is not a claim that an old zero proves no accounts or no adverse information.

| Source | Experience | Quality / comparison | Owner |
| --- | --- | --- | --- |
| Published bureau score keys | Focal score gallery; compact Home snapshot; historical snapshot | Bureau label preserved. Model/range absent: no invented range, rating, delta or score trend | U3 supplies score identity/range/factors |
| Published utilization, balance, limit | Utilization visual and totals; compact Home; metric strip | PARTIAL, with coverage disclosure. No new utilization/capacity calculation is inferred from unmatched totals | U3 supplies eligible accounts and calculation basis |
| Published open/closed/revolving/installment counts | Profile and metric strip | PARTIAL. Missing is never zero | U3 normalized account snapshots |
| Published account-age/payment/negative counts | Profile disclosure headlines and evidence sections | PARTIAL or UNKNOWN; no quality grade or invented payment percentage | U3 calculation definitions and source facts |
| Published inquiry count | Reported inquiry summary | Window absent; never labeled a 30-day/6-month/24-month metric or plotted as a comparable series | U3 bureau/window definition |
| Published summary/findings/recommendation | Authored Analysis; Overview assessment | Approved client text only. No inferred stance, why, causal story or item relationship | U3 structured published Finding relationships |
| Secure report metadata/content path | Report provenance and protected source access | Existing authorization boundary retained | U3 structured digest; existing Document domain |
| Immutable publication history | Snapshot browser; report selectors and fact pairs | Unknown models/coverage suppress deltas. Report calendar dates do not shift with local timezone | U3 comparable series and normalized events |
| Home/Center/Plan workspace projection | Focus, counts, currentness, blockers, action destinations | Existing server truth retained, never recomputed from browser lists | U1 adapters retire in their assigned later waves |

## Structured component contracts ready for U3

These are read-only component inputs, not additional API guarantees or persistence. Current production adapters explicitly supply null for data absent from the publication. Synthetic reference fixtures exercise the supported paths separately.

- `CreditValue`: value, KNOWN/PARTIAL/UNKNOWN/NOT_APPLICABLE, human-readable definition and optional coverage basis. Comparisons require KNOWN values with identical definitions.
- `ScoreFact`: bureau, score, model, report calendar date, supplied range, source factors. Model selection and score deltas reject incompatible identities. No model is guessed from a 300–850-looking number.
- `ReportAccount`: safe masked identifier, creditor, normalized type/status, balances/limits with quality, opened/reported dates, bureau facts, payment history, remarks and optional validated internal Card link. Gallery, search/list, selection retention, query-linked detail and mobile full-screen sheet consume this contract.
- `CreditExperience`: bureau scores, quality-bearing metrics, nullable account/inquiry/negative collections. Null means not supplied; an explicitly supplied empty collection means no entries in that report section.
- `ProfileEvidence`: account-mix counts from supplied collection, opening-date chronology with missing-date count, payment grids, bureau-separated inquiry entries, negative-item entries and neutral bureau value comparison. These do not manufacture consultant interpretation.
- `PublishedFindingStory`: existing approved finding plus optional published why, historical context, goal relevance, supporting fact references and related Plan-item IDs. Links derive internal routes; professional claims are never generated from raw metrics here.
- `CreditHistory`: immutable snapshot list plus optional structured experiences. Score/model selectors, one metric chart at a time, accessible values, gaps for unavailable observations, chronological report-date axis and compatible comparison rows.

## U4 Plan adapter debt

The same published Plan/version/items and server summary continue to own execution. No PlanPath, PlanPathItem, NurturePeriod or parallel timeline was created.

- Client navigation is now Credit Center → Plan; `/app/plan` and existing `view=actions|guidance` bookmarks remain compatibility entry points into the same records.
- Primary taxonomy tabs are retired. Default view is one mixed roadmap; Action/Guidance/Milestone are visual item types. Completed/history is secondary. NURTURE is presented as Maintain & Prepare.
- Display order remains the published item order. Prerequisites explain readiness; they are not reinterpreted as chronology or new dependency records.
- Selected item retains saved response, submission, consultant verification, inability/help, history, stale/conflict and dirty-navigation protection. Server command revalidation remains authoritative.
- Decision publications are contextual secondary evidence. The current DTO does not identify the affected Plan point; the UI explicitly avoids claiming an attachment. U4 must supply canonical affected-item relationships.
- Plan-to-specific-Finding/Goal/service relationships and authoritative phase transitions remain U3/U4/U6 integration work. General Analysis/Journey continuations are available now without inventing source relationships.

## Explicit limits

This pass does not prove report extraction completeness, provider integration, production operations, or canonical U3/U4/U6 migrations. The richer account/factor/event paths shown in reference fixtures require their owning source cycle before real publications can supply them. No synthetic values are used as production fallbacks.
