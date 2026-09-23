# Executed verification commands

Working root: Credit/.worktrees/astra-commerce-integrity unless noted. DATABASE_URL was explicitly set only to the named disposable PostgreSQL instance; credentials omitted from this report. No inherited application environment file used.

Baseline: git status --short; git rev-parse HEAD; git rev-parse --is-shallow-repository; git config --get-regexp 'remote\..*\.(promisor|partialclonefilter)'; git for-each-ref; git worktree list --porcelain; git ls-remote --heads origin; git cat-file -e and git merge-base --is-ancestor for each manifest SHA; git log --oneline bef53dc..1daf6eb; git rev-parse HEAD:<each of three packet source paths>; git rev-list --left-right --count for local/remote differences. No fetch/ref mutation was needed.

pnpm install --offline --frozen-lockfile --ignore-scripts
node node_modules/prisma/build/index.js generate
node node_modules/prisma/build/index.js migrate deploy

Prisma needed NODE_PATH pointing at this worktree's apps/api/node_modules because dotenv is an API dependency, and permission to use the cached Prisma engine. First generate failed on dotenv resolution, then on sandbox engine-cache utime; the final attempt succeeded with no dependency edits. An initial network-none disposable container was recreated with a loopback port before migration. A database naming-guard failure is retained in setup-db-name-guard.txt. No tests ran against an existing app database.

# Baseline API reproduction before production changes
node apps/api/node_modules/vitest/vitest.mjs run --root apps/api --maxWorkers=1 src/commerce/commerceIntegrity.integration.test.ts
# Supplemental R1 refresh reproduction temporarily used the pinned paymentOperations.ts, restored in finally without moving refs
node apps/api/node_modules/vitest/vitest.mjs run --root apps/api --maxWorkers=1 src/commerce/commerceIntegrity.integration.test.ts -t "R1 ordinary refresh"

# Required targeted API suites plus scoped regressions; final successful run
node apps/api/node_modules/vitest/vitest.mjs run --root apps/api --maxWorkers=1 src/commerce/paymentOperations.integration.test.ts src/commerce/paymentRoutes.integration.test.ts src/commerce/paymentService.integration.test.ts src/commerce/domain.integration.test.ts src/commerce/commerceIntegrity.integration.test.ts
# Final strengthened assertions
node apps/api/node_modules/vitest/vitest.mjs run --root apps/api --maxWorkers=1 src/commerce/commerceIntegrity.integration.test.ts

# Web baseline/fixed and focused intermediate reproduction
# First baseline was run from apps/web using node node_modules/vitest/vitest.mjs with the same file filter.
node apps/web/node_modules/vitest/vitest.mjs run --root apps/web src/pages/AdminPaymentsPages.test.tsx
node apps/web/node_modules/vitest/vitest.mjs run --root apps/web src/pages/AdminPaymentsPages.test.tsx -t "keyboard focus"

pnpm --filter @credit/api typecheck
pnpm --filter @credit/web typecheck
pnpm --filter @credit/web build
node node_modules/eslint/bin/eslint.js apps/api/src/commerce/paymentOperations.ts apps/api/src/commerce/paymentRoutes.ts apps/api/src/commerce/commerceIntegrity.fixture.ts apps/api/src/commerce/commerceIntegrity.integration.test.ts apps/web/src/pages/AdminPaymentsPages.tsx apps/web/src/pages/AdminPaymentsPages.test.tsx

git diff --check

Vitest's local entry point was called directly with explicit filters (same installed Vitest as the packet's pnpm exec commands), avoiding package-script argument forwarding ambiguity. No full web/API regression suite was run.

# Browser (local scripts preserved here; originally launched from .tmp/rec02)
node node_modules/tsx/dist/cli.mjs docs/evidence/rec-02-commerce-integrity/browser-api.ts
# From apps/web, with VITE_API_URL=http://127.0.0.1:3017
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5197 --strictPort
# PLAYWRIGHT_MODULE identifies the existing bundled Playwright module; no library install/upgrade
node docs/evidence/rec-02-commerce-integrity/browser-check.mjs

Initial browser harness launch needed elevation for tsx's sandbox user-profile read. The early browser run before that server started timed out; no acceptance claimed. Screenshot waits were tightened to wait for the URL/rendered result after router navigation, then all captures were regenerated. Final captures use a freshly recreated disposable DB with only two synthetic purchases.

Database checks: current_database(), PostgreSQL version(), count of completed non-rolled-back _prisma_migrations. Test servers interrupted and only the named disposable container stopped after evidence capture.

Final verification notes: the recreated disposable database needed a readiness check before migration; migration succeeded after pg_isready. A Testing Library role selector used an unsupported exact option; it was replaced with an anchored name expression (test-selector-type-error.txt). Final web typecheck/build and lint passed. The existing main checkout reports only the untracked .worktrees/ directory; the Sol and approved-theme checkouts are clean (principal-checkouts-after.json).
