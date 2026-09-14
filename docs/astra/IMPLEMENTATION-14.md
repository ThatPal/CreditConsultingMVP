# Astra implementation pass 14: Plan readiness scenarios

Continues pass 13 on `codex/astra-production`.

## Delivered

- Publication preview explains which steps are visible under active/available paths, counts hidden steps and lists configured path statuses. Shared steps remain visible. An empty visible set has an explicit warning.
- Each visible step shows prerequisite groups using All/Any rules, named earlier steps and completion indicators. Groups combine with All semantics, matching the current server rule.
- Consultants can switch from loaded completion records to a hypothetical all-prerequisites-completed scenario. Missing references remain unsatisfied. Recorded completed, awaiting-verification, help, cancelled and in-progress states remain intact.
- Response-form inspection appears for ready/in-progress steps; other states explain that a new response is unavailable. The server-backed response preview remains batched.
- Scenario state is local and resets when the preview closes. It does not write progress, change paths, save a draft or approve a Plan. Copy makes the assumption of approval/current sources explicit.

## Evidence and scope

- Focused lifecycle, response-preview and consultant editor tests cover rule semantics, multiple groups, missing references, path visibility, preserved recorded states, scenario switching, unchanged input and exclusion of private rationale. Web production build, targeted lint and whitespace checks pass; existing bundle-size warning remains.
- This frontend readiness projection was checked against current service path filtering and prerequisite semantics. It is not a shared server projection of every lifecycle condition; stale-source, paused/version replacement and future domain rules still need integration evidence.
- Authenticated consultant browser review remains pending the MFA challenge recorded in pass 10. No new browser qualification is claimed here.
- Full path activation/version lifecycle tooling, independent-session progress and live updates, interactive correction/help simulation, accessibility and remaining roadmap work remain open. No production wave is complete.

All work remains in Astra, without migrations, other-version changes, external actions, push, merge or deployment.
