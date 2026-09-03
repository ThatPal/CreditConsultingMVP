# Sprint 10.2 — Client Cards, Explore & Wishlist — Completion

## Boundary

- Starting boundary: Sprint 10.1 `fa7c921d4d00b3603320e7352f76af60d3142b5e`.
- Implementation/report boundary: this commit; exact SHA is recorded in the Phase 10 gate.

## Delivered contract

- Extended the existing `ClientCard` aggregate with optional catalog identity and append-only link/unlink provenance; unresolved identity remains valid.
- Added client-owned add/update/close-ready commands, personal/business/secured/non-reporting support, stable portfolio ordering and consultant-scoped CRM projection.
- Added persistent duplicate-safe Wishlist preferences with audit/outbox invalidation and no recommendation, eligibility, Strategy or Apply semantics.
- Added PORTAL-17 overview navigation, PORTAL-18 Explore, PORTAL-19 Wishlist, PORTAL-20 Card Detail and CRM client Cards routes with loading/empty/error states and responsive catalog layout.
- Explore and detail use client-safe current-offer projections, visibly label stale offers and suppress expired promotion claims.

## Verification

- Focused portfolio integration proves unresolved/identified/unlinked history, cross-client mutation denial, duplicate-safe Wishlist and preference-only projection.
- Focused web/API typecheck, lint and build are required green at this boundary.

## Scope control

- Existing Review/report records are not rewritten by current portfolio identification.
- No Apply action or Phase 12 Strategy selection/scoring was introduced.
- Source operations and CardInsight approval remain governed later Phase 10 boundaries.
