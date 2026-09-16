# U0 baseline health

Recorded before application changes on 2026-09-15 local time. Branch `codex/astra-production`; baseline SHA `44a905b2d5b804441864ec6faddc8e67552f2491`. `git pull --ff-only origin codex/astra-production`: already up to date. Initial tracked/untracked working tree clean.

## Environment and isolation

Node 24.16.0; pnpm 11.19.0; Prisma client/CLI 7.9.1. React/Vite/Express retained. Existing lockfile retained.

Live Astra: PostgreSQL 5445 / `credit_strategy_astra`; Redis 6395; API 3015; web 5195; cookie `credit_astra_sid`; private local document directory `.data/documents`.

Separate U0 test services: `credit-astra-u0-postgres` on 127.0.0.1:5446, database `credit_strategy_astra_u0`; `credit-astra-u0-redis` on 127.0.0.1:6396. Test credentials are disposable local fixtures. No parent/Sol data was used. Full integration suites must not run against live demo data: some tests delete records broadly.

## Unmodified baseline results

| Check                                      | Result                                                                                                         | Evidence                     |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `pnpm install --frozen-lockfile --offline` | PASS; already up to date, all six projects                                                                     | Terminal output              |
| `pnpm typecheck`                           | PASS across workspace                                                                                          | `.tmp/u0-typecheck.log`      |
| `pnpm lint`                                | FAIL: 3,169 errors; includes ignored `.tmp` scripts and JS globals in audit tooling                            | `.tmp/u0-lint.log`           |
| `pnpm build` with Astra API URL            | PASS across workspace                                                                                          | `.tmp/u0-build.log`          |
| Clean `pnpm db:migrate:deploy`             | PASS; all 69 migration directories applied                                                                     | `.tmp/u0-migrate.log`        |
| Clean `pnpm db:seed`                       | PASS on serial unrestricted retry; 16 option templates                                                         | `.tmp/u0-seed-serial.log`    |
| API Vitest `--maxWorkers=1`                | 77 files passed, one suite failed collection; 345 tests passed                                                 | `.tmp/u0-api-tests.log`      |
| Root `pnpm test`                           | Interrupted after unbounded web workers produced timing failures; no success claim                             | `.tmp/u0-tests.log`          |
| Web Vitest `--maxWorkers=1`                | In progress at initial checkpoint; observed timing failures retained                                           | `.tmp/u0-web-serial.log`     |
| Real browser baseline                      | Six authenticated screenshots, desktop 1440×1000 and mobile 390×844; no horizontal overflow in captured states | `docs/evidence/u0-baseline/` |

Web entry chunk: 515.79 kB minified / 155.85 kB gzip. This is a build measurement, not a performance acceptance result.

## Failures distinguished from application regressions

1. Root ESLint does not ignore `.tmp`; its results depend on local ignored files. Node globals are also missing for the tracked `.mjs` audit script. A source-only run is recorded separately; do not represent temporary-script failures as thousands of product defects.
2. The seed runner initially failed in the Windows sandbox at `os.userInfo` (`uv_os_get_passwd` ENOMEM), before seeding. An unrestricted attempt during resource-heavy tests hit a five-second transaction timeout. Serial unrestricted retry passed without source changes. This does not justify changing seed transaction policy yet.
3. `apps/api/src/plans/reconciliation.integration.test.ts:20` only permits a URL containing `:5445/credit_strategy_astra`. It rejects the new isolated U0 test database during collection. Its tests were NOT among the 345 passing tests.
4. Web failures observed at default timeouts include source reconciliation recovery, reviewed-source fingerprint continuity and Plan draft hydration. Root unbounded run also showed Goals, document and account-security failures. Preserve logs and reproduce affected tests before diagnosing product regressions.
5. Live Astra database/Redis containers were stopped on arrival. The audit's direct Compose invocation omitted `--wait`, then the launcher exited with PostgreSQL `57P03` (database starting up). After `pg_isready`, only those verified-exited Astra processes were restarted. `/ready` returned 200. Correction: the documented `pnpm runtime:up` already includes `--wait`; this was an audit invocation error, not a demonstrated defect in that documented sequence.

## Provider/runtime dependencies

Current server still constructs `Phase7DeterministicProvider`, calls `createEmailProvider` without SMTP/external adapters, and uses local private document storage. Production report/AI/email delivery has not been demonstrated. Payment/calendar production credentials, external callbacks, backup/restore and deployment qualification remain later gates. No real mail, payment or external service action was performed.

## Completed diagnostic follow-up and tooling-only corrections

- Full web run completed: **57 files passed / 4 failed; 279 tests passed / 9 failed**. Five auth API cases reproduced deterministically; four Plan tests exceeded 5 seconds.
- Focused diagnostic rerun of all four failed files with `--maxWorkers=1 --testTimeout=15000`: **30 passed / 5 failed**. All four timeout cases passed. No test timeout configuration or assertions were changed.
- Auth test cause: first 401 case calls `endRequestSession`; later cases never establish a new actor. Added `beforeEach(bindRequestActor(...))` to the test fixture. The auth API and actor-boundary suites then passed **10/10**. Production auth code was not changed.
- Database guard: added only the exact loopback host, port 5446 and `credit_strategy_astra_u0` database to the existing reconciliation test allowlist. Previously uncollected suite passed **9/9** there. Combined API evidence is **354 passing tests across 78 files**, from the broad baseline plus the isolated suite rerun, not a second full run.
- ESLint: source-only baseline had one missing Node-global error. Added `.tmp/**` ignore and Node globals limited to `scripts/**/*.mjs`; root lint now passes. No application lint rules were disabled.
- Shared package has no tests (configured pass-with-no-tests); runtime **3/3**; worker **17/17** across six files. Initial worker invocation omitted database/Redis environment; configured rerun passed against U0 services. This invocation error is not a product defect.
- Ten real browser screenshots now cover Home/shell, no-profile Center, published Center, Plan and expanded saved Action at both widths. Viewing/resuming did not submit or change the saved response.
- Both live Astra and U0 databases have **69 finished migrations, zero unfinished, zero file-checksum mismatches**. Verified read-only through `_prisma_migrations` against repository SHA-256 hashes. Direct CLI status attempts failed in the bundled command environment (`pnpm exec` resolution; direct Node missing root dotenv), so no successful CLI-status claim is made.

Diagnostic logs: `.tmp/u0-web-recheck.log`, `.tmp/u0-auth-fixed.log`, `.tmp/u0-reconciliation-tests.log`, `.tmp/u0-packages-configured.log`, `.tmp/u0-lint-final.log`. Logs are ignored local evidence; summarized results are retained here. No schema migrations, product behavior changes or compatibility adapters were introduced.

## Remaining U0 work

Complete per-route and shared-component classifications against final exact specifications, including missing surfaces and duplicate aliases. The generated 120-route / 47-module inventory is explicitly provisional; it is not a completed final-spec mapping. Complete remaining frozen source review needed for that reconciliation, and consolidate the final U0 acceptance checklist. U1 remains unstarted. U0 is not accepted merely because builds pass.
