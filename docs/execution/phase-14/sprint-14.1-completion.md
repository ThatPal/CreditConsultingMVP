# Sprint 14.1 Completion — Post-Round Summary & Dynamic Totals

Starting SHA: `8156494b533f0264be0fe9e3ec3e21fc11082da8`

Implementation SHA: recorded by the commit containing this report.

Implemented canonical, query-time post-Round aggregation from `CreditApplication` state. Submitted, approved, declined, pending, other, skipped, approved-limit-pending, known approved amount, unresolved follow-up count, and Goal progress are derived without shadow counters. Skipped occurrences remain outside submitted applications; approved amount includes only positive known limits. Later canonical application updates automatically recalculate the projection without rewriting events.

Added client-safe PORTAL-31 and scoped consultant CRM-20 summary endpoints and responsive result screens at `/app/rounds/:roundId/results` and `/crm/clients/:clientId/rounds/:roundId/results`. The client projection excludes issuer/internal details while the consultant projection may include current version and known issuer reason.

No migration was required. Focused aggregation verification covers known approval, unknown approval limit, pending, declined, technical outcome, skip exclusion, unresolved totals, and Goal progress. Phase 14.2 workflow, analysis, finalization, and Phase 15 remain out of scope.
