# Sprint 10.3 — Catalog Sources, Candidates & Operations — Completion

## Boundary

- Starting boundary: Sprint 10.2 `f442bc3be1c58c771d6dc9e14546770633ea0f03`.
- Implementation/report boundary: this commit; exact SHA is recorded in the Phase 10 gate.

## Delivered contract

- Added cards-owned approved source registry/mapping and HTTPS host allowlisting with private-network rejection.
- Added durable duplicate-safe candidate identity, normalized payload, evidence, match, material conflict and optimistic review state.
- Added governed new-product and offer-change publication transactions; publication creates one evidence mapping, immutable offer and atomic current pointer.
- Added explicit reject, merge and conflict-resolution transitions with actor/reason/version protection.
- Added consultant/admin operational queue routes and UI. Clients cannot access candidate payloads or conflict/source internals.
- Added catalog publication audit/outbox effects. Retrieval remains an adapter boundary; no uncontrolled scraper or arbitrary target is present.

## Verification

- Focused operations integration proves replay safety, ambiguous/material conflict blocking, explicit resolution, single canonical publication, immutable prior offer and concurrent approval convergence.
- Source allowlist/SSRF behavior is covered by catalog integration.
- API/web typecheck, lint and build are required green at this boundary.

## Scope control

- No external source was invented or contacted, and no credential is stored in source records.
- AI normalization remains non-authoritative candidate data. CardInsight approval is 10.4; Strategy is Phase 12.
- The existing worker/source runtime was not materially changed, so the package permits CI deferral to the phase gate.
