# U1 batch 12 — Usable published history and clearer analysis

Baseline `c369da2`; independent Astra branch. RECOMPOSE Credit Center history/analysis, KEEP role-safe published DTOs and immutable data. F08/F09 reference slice progress; U1 remains NOT PASSED.

History previously exposed only a date/label timeline. It now provides keyboard-operable accordions with each publication's saved assessment, recommendation explanation, report source/date and credit facts. Latest is identified by the selected publication ID, not array order, and is never labeled as current readiness. Details mount only on expansion and unmount on collapse. Missing history has an explicit state. No new fetch/command, snapshot mutation or current-action inference.

Analysis uses a focused recommendation surface, wrapping reason bullets and icon-led finding rows. Published severity is displayed as a human-readable label without invented thresholds. Repeated Plan reminders are removed; the single canonical Plan link remains. History uses embedded facts without an extra nested gradient panel.

Validation: five focused history/score-boundary tests pass. Tests open two differently dated snapshots in deliberately non-latest-first order and prove their scores/assessments stay distinct. Root lint and five-package build pass before the final presentation-only cleanup; final web typecheck/lint and browser repeated afterward. Six browser states (Overview, Analysis, expanded History at 1440 and 390px) pass with no page errors/overflow and preserved exact Support context/selected navigation visibility. Screenshots under `docs/evidence/u1-history-analysis/`; reviewed desktop expanded history and mobile analysis, then flattened redundant styling/copy.

Browser uses synthetic isolated sessions and blocks non-read API calls after login. No submissions or live user-session changes. History query pagination remains an existing performance gap; lazy chart mounting does not solve unbounded server history retrieval. Full historical findings/report-document drilldown and final U3 model remain outside this presentation slice. Remaining U1 truth/action/Live/Major and reference-state gates are still open.
