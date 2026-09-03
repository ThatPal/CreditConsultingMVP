# Sprint 12.2 Completion — Product Discovery, Comparison & Shortlist

- Canonical Phase 10 `CardProduct`, current `CardOfferVersion`, and current `CardInsightVersion` are the only discovery sources; no shadow product model was introduced.
- CRM-scoped catalog discovery provides deterministic search and governed offer/insight facts.
- Consultants can shortlist or exclude products and assign planned, alternative, or conditional roles with distinct internal rationale and client-safe reason.
- Every candidate freezes exact offer and insight version identifiers.
- Strategy-level optimistic concurrency returns a conflict instead of silently overwriting a concurrent edit.
- Approved/non-draft versions remain immutable.
- Focused API typecheck and migration-backed verification passed against the dedicated Credit database.
