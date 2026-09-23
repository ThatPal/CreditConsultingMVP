# Guarded integration database routing follow-up

Base: fdd6b6e226c59cf2461f066a1d01473c5318cccc. Local and live remote matched; worktree was clean.

Inventory: searched API/worker/package tests and fixtures for DATABASE_URL, parsed target checks, isolated-database errors, explicit ports/names, current_database(), and Vitest/CI selection. Three suites require dedicated targets. Other integration tests use the ordinary environment (or explicitly synthetic/mock URLs). No additional target-specific guards were found.

| CI route | Database endpoint (credentials omitted) | Coverage |
|---|---|---|
| Ordinary pnpm test | localhost:5432/credit_strategy | All ordinary workspace tests; API excludes only the three explicitly routed files below |
| test:commerce-integrity | localhost:5432/credit_strategy_rec02_com01a | commerce/commerceIntegrity.integration.test.ts; existing six cases and actual-database guard unchanged |
| test:astra-isolated | 127.0.0.1:5446/credit_strategy_astra_u0 | plans/reconciliation.integration.test.ts and workspace/live.integration.test.ts, sequential with maxWorkers=1 |

A fresh PostgreSQL CI service provisions the exact existing Astra allowlisted endpoint; existing migrations run before the dedicated command. Both Astra suites create their own prerequisites and use scoped fixture cleanup, so no demo/system seed is added there. REC-02 retains its separate database and migration step. Ordinary system seed and its existing idempotency re-run are unchanged. All services are disposable GitHub job resources; no local development database is started or touched by this correction.

No test or production code, guard, assertion, skip condition, dependency, theme, permission, financial policy, or principal ref is changed. The two routing files plus this evidence note are the complete change. Final GitHub run and actual counts are reported after execution; this routing description is not a claim of success.
