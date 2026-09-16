# Shared component dispositions

All 47 current modules under components/features/layouts are explicitly classified in shared-dispositions.json and rendered in UI_SCREEN_COMPONENT_MAP. The inventory enumerates exported functions/components, current literal API references, query roots and child components. Module dispositions apply to their exported helpers; module-level discovery is not a promise that every export makes every listed request.

Authority: final Design System & Component Library, especially post-screen-QA reconciliation and ownership passes, plus exact Portal section K and CRM/Admin screen amendments. RESTYLE is used only for narrow presentation primitives (ChoiceCard, icon glyphs, Light Focus surface, StatusChip); it does not certify all callers. No entire product screen receives KEEP.

## Preserve while recomposing

- PlanResponse/SavedPlanResponse: actor/version fencing, private autosave, preserved uncertain outcomes, typed false/zero values, revision history, protected evidence and submit-not-verify. U1 changes query ownership and detail composition; U4 changes persistence ownership.
- Review/Plan authoring controls: source/version checks, explicit conflict choices, local/saved comparison, publication preview and client-safe fields. Preserve guards while migrating the final shared CreditPlan engine in U4.
- RouteReadyBoundary: bounded error telemetry, lazy recovery and warning that reload clears unsaved work. Final loading/error design must not remove these safeguards.
- GovernedActionDialog/RecoveryState: preserve consequence/reason and current-to-proposed previews; compose final shared overlays and retain keyboard/focus behavior.
- Document picker/upload/evidence: canonical private Document subsystem and protected access; no alternate file store created by new layouts.

## Confirmed shared-code gaps assigned to U1

`CollectionSurface.tsx` reads/writes sessionStorage without a try/catch, keyed only by display title. It also handles ArrowUp/ArrowDown for any descendant, including editable fields, by moving focus to collection rows. Storage failure can break presentation and row keyboard behavior can interfere with form editing. REBUILD the collection interaction boundary; add tests for unavailable storage, scoped state and nested controls before reuse in final screens. The existing fixed desktop height and generic empty text are not sufficient for every final collection archetype.

`EaseOfUse.tsx` provides local session-only view state and a fixed two-pane layout. This is not server-persisted saved views or the final three-zone workbench. U1 owns safe primitives; U4 owns durable views (F10). Role-filtered command presentation does not replace server capability checks.

`ProductFoundation.tsx` contains many useful visual functions, but a shared renderer must never invent lifecycle truth. LifecycleRail receives exact stages from the owning projection; the retired universal sequence cannot become a reusable business rule. ScoreBand/UtilizationGauge remain factual, source-dated displays, never approval probability. Timelines show meaningful authorized events, not raw audit payloads. Data/financial components require typed published facts, accurate dates and currentness.

`SectionCard`, `MetricCard`, `PageHeader`, `FocusSurface` and shell wrappers must support varied final compositions. A dark rounded-card wrapper around every region does not satisfy the design. Light Focus is a coherent work plane; role density differs across Portal, CRM and Admin. Sticky controls must not obscure content, and selected/focus/hover/error states must remain readable.

## Explicit retirement and later migration boundaries

- PlanPathEditor: RETIRE U4 after ranks/groups plus PlanItemDependency migrate data and behavior. Do not merely rename path controls and keep a parallel path lifecycle.
- editor/PlanDraftComparison/PlanLifecyclePreview/PlanLibrary: adapt path-bearing payloads, comparison and active-root assumptions in U4; retain concurrency and history.
- reviewNotes: scoped expiring session notes are existing temporary material, not durable governed review notes. U4 must establish final ownership/retention and preserve privacy through migration.
- Navigation registry: REBUILD U1 from final route ownership. Keep old deep links until the owning wave proves parity; never derive primary nav from every available route.

No shared runtime code changes in this U0 classification batch. Desktop/mobile qualification and final command/state tests remain per-wave obligations; the classification itself is complete for the 47 inventoried modules.
