# Sprint 9.4 — Nurture & Plan Reconciliation

## Boundary

- Starting SHA: `0684527d079cebb328ed7be160b0c5f49b11ebd7`
- Implementation/report SHA: recorded by this sprint boundary commit.

## Delivered contract

- Added deterministic material/non-material source-version comparison for Review/Profile/Goal-backed Plans.
- Material changes mark the approved version and Plan stale, preserve completed outcomes/history and consultant-authored/manual-protected content, and create an explicit replacement draft with lineage.
- Non-material or fingerprint-identical changes do not churn versions.
- Replacement content cannot become active until a scoped, MFA-step-up consultant approves it; approval supersedes the old version while retaining read-only history.
- Stale/superseded Plans reject new client outcomes.
- Reconciliation emits one audit/outbox invalidation and one meaningful Work Queue review projection.
- Nurture uses the same Plan aggregate (`purpose=NURTURE`) and current Journey/Home plan foundation now reads canonical Plan state rather than the legacy action projection.
- Portal and CRM surfaces expose stale/reconciliation state without silent AI regeneration or overwrite.

## Focused proof

- Non-material change creates no replacement.
- Material Profile version change creates explicit stale + replacement lineage.
- Completed outcome remains attached to immutable prior history.
- Consultant rationale/manual protection and completed state are preserved in the proposed version.
- Old version rejects execution after staleness.
- Replacement activates only through governed approval and supersedes the old version.
- Reconciliation Attention projection occurs once.
- Focused reconciliation suite: 1 file / 2 tests passed.
- Workspace typecheck passed.

## Deviations and limitations

- AI-assisted delta generation is not exposed because a canonical Plan-specific AI process was not defined; deterministic manual reconciliation is complete and honest.
- Phase 11 Cycle start/resume behavior was not pulled forward.

## Scope confirmation

Phase 10 card/catalog behavior was not started.
