# U1.5 — Client Core Experience Finalization

Status: engineering verification PASSED; commit closeout and product review pending. U2 is not started. Stop after U1.5 for product review.

Baseline: `0cc3c12546e4ce0f84dadee4206b41e95c4b676c`, clean and synchronized with origin/codex/astra-production on 2026-09-16. Independent Astra worktree only.

Read: complete latest U1.5 build package, Context Architecture, Data Dictionary, and complete U1.5 amendments in exact screen specifications, component library and coverage register. The final mobile hub/detail override supersedes earlier mobile tab-strip instructions. Raw source copies remain ignored/private.

Baseline validation: all five packages build; API workspace/Journey/Plan regression 139 tests / 15 files passed. Web reference regression initially 19/20 passed with one loading timeout; isolated unchanged Plan file rerun 13/13 passed. This records both results rather than concealing the timing failure.

## Component dispositions

| Area | Treatment | Scope |
| --- | --- | --- |
| Portal registry | RECOMPOSE | Six primary destinations; Plan nested; Goals owned by Journey |
| Credit Center navigation | REBUILD | Six desktop peers; mobile hub/detail/back and scroll restoration |
| Home | RECOMPOSE | Dominant focus; compact credit/Plan; Goal/Journey and meaningful context |
| Overview/Profile facts | REBUILD | Focal score gallery, utilization, quality indicators, section disclosure |
| Report Details | REBUILD | Account gallery/list/detail, provenance, secure source |
| Analysis | RECOMPOSE | Authored consultant plane, finding stories and evidence relationships |
| Plan taxonomy tabs | RETIRE | Integrated roadmap; Maintain & Prepare phase; contextual decisions |
| Plan response/history/recovery | KEEP | Server authority, dirty snapshot, timed/realtime refresh, write pause |
| Currentness/blockers/focus | KEEP | Server-owned truthful state and scoped actions |
| History | REBUILD | Comparable metrics, unavailable states, immutable snapshot evidence |
| Shared visual language | RESTYLE | Restrained emphasis, structural sections, accessible readable data |

## Acceptance worklist

- [x] Final navigation, mobile hub/detail and compatibility routes.
- [x] Home and all six Credit Center peer compositions.
- [x] Shared quality states and documented U3 data adapters.
- [x] Integrated Plan response flow and documented U4 debt.
- [x] Regression, responsive and accessibility verification.
- [x] Deterministic desktop/mobile evidence matrix, visual inspection and repairs.
- [ ] Closeout with explicit gates, final SHA, dependency owners and product review stop.

No new canonical persistence, production fallback credit fixtures, or browser PDF parsing is permitted. Tests/reference fixtures remain separate from runtime data.

## File-level experience map

| Component / contract | Disposition | Result |
| --- | --- | --- |
| navigation.tsx / App routes | RECOMPOSE | Six primary peers; utility-only documents/notifications/account; contextual service ownership; Plan alias retained |
| CreditCenterNavigation / hubPosition | REBUILD | Desktop peers, mobile destinations/back and ephemeral hub position |
| HomeExperience / HomeCreditSnapshot | RECOMPOSE | Focus first; goal, appointment, published snapshot, Plan and activity |
| CreditDataValue / data.ts | REBUILD | Explicit data quality, calendar dates, legacy adapter and comparability guards |
| BureauScoreGallery | REBUILD | One selected bureau; supplied-range pointer only; controls/swipe/source factors |
| UtilizationCapacity / CreditMetricStrip | RECOMPOSE | Separate capacity region, compact peer values, coverage disclosures and links |
| CreditProfile / ProfileEvidence | REBUILD | Headline disclosures and structured evidence inputs; no inferred interpretation |
| ReportAccounts | REBUILD | Gallery, searchable list, query-linked detail, wide drawer/mobile full-screen sheet |
| AnalysisFinding | REBUILD | Published narrative, optional published why/evidence/Plan relationships |
| CreditHistory / HistoricalMetric | REBUILD | Series selectors, gaps, accessible values, compatible deltas and immutable snapshots |
| PublishedCreditCenterPages | RECOMPOSE | Stable context/source header, six peer compositions, source-safe continuations |
| PlanPages / PlanRoadmap | RECOMPOSE | Integrated mixed roadmap, selected response, completed disclosure, phase and upcoming conditional work |
| PlanViews / PlanNurture | RETIRE | Removed obsolete primary taxonomy UI and replaced its tests with integrated behavior |
| PlanDecisions | KEEP / RECONTEXTUALIZE | Secondary published context; no fabricated point-to-decision relationship |
| SavedPlanResponse / PlanFollowUp / ResponseHistory / NavigationProtection | KEEP | Existing response, review, help, verification and recovery behavior |
| WorkspaceBlockers / ProfileCurrentnessNotice / FocusOwner | KEEP | Existing server-owned truth and safe disclosure |
| PublishedCreditFacts | KEEP for consultant scope | Client current/history surfaces use U1.5 components; this pass does not redesign CRM |

Evidence and limitations: [review index](../evidence/u15-review/README.md), [read contracts and owners](U15_DATA_CONTRACTS.md).
