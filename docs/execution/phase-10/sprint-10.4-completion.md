# Sprint 10.4 — CardInsight AI & Approval — Completion

## Boundary

- Starting boundary: Sprint 10.3 `581e60c` (full SHA in the Phase 10 gate ledger).
- Implementation/report boundary: this commit; exact SHA is recorded in the Phase 10 gate.

## Delivered contract

- Added immutable, offer-version-bound CardInsight lineage with prepared/review/approved/stale/superseded states and rebuildable current pointer.
- Integrated AI preparation with the shared versioned `AIProcessDefinition` registry and persisted structured proposal, model/process/source provenance, confidence and evidence.
- AI preparation never approves or publishes. Manual preparation remains available when AI is unavailable.
- Added consultant-only professional approval/edit-approval/reject APIs with MFA step-up, idempotent audit/outbox effects and preserved original proposal provenance.
- Added deterministic material-offer-change staleness and current-pointer removal without rewriting approved history.
- Added ADMIN-13 operational review plus consultant approval surface. Admin may inspect but cannot silently exercise professional approval authority.
- Client/Explore projection exposes only approved summary/strengths/cautions and excludes provider/model/confidence/raw evidence/internal rationale.

## Verification

- Focused integration proves governed AI process provenance, no auto-canonical transition, safe pre/post approval projection, exactly-once replay, immutable approval and material offer staleness.
- API/web typecheck, lint and production build are required green at this boundary.
- Shared AI job/worker execution code was not changed; the package therefore permits exact-head CI at the Phase 10 gate rather than immediate CI.

## Scope control

- CardInsight never overwrites offer facts, resolves source conflicts, determines eligibility, creates Apply actions or selects Phase 12 Strategy cards.
- No production AI vendor is hard-coded; the model profile remains configuration-driven.
