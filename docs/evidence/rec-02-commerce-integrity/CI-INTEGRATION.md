# CI integration correction

Base: `4ba2e8655806f81e3806875f7f927fd2d951b723`; local and remote matched before editing, with a clean worktree.

Inspected failed GitHub Actions run 35803564650 / job 106999172754. Lint failed on 35 no-undef errors in three reference/evidence JavaScript scripts; typecheck, tests and build were consequently skipped. The same 35 errors reproduced locally. Narrow file-specific browser/Node environments fix their root cause; no lint rule is disabled and no production JS globals are broadened.

The ordinary API test command explicitly excludes the destructive REC-02 suite. A named test:commerce-integrity command runs it, and CI explicitly creates/migrates credit_strategy_rec02_com01a and overrides DATABASE_URL only for migration and that suite. The ordinary credit_strategy database and test command remain separate. Both existing URL-name and current_database() guards are unchanged. No skip/passWithNoTests or arbitrary-target bypass was added.

Local verification: repository lint and workspace typecheck passed. All 69 migrations applied to the isolated disposable database; the new scoped command executed 6/6 passing cases. Negative guard check with credit_strategy failed before any cases or fixture writes, as intended. Effective ESLint configuration still reports no-undef severity 2, with DOM globals absent from unrelated production JS.

The corrective commit changes CI/test routing and lint configuration only, plus this record. R1/R2/R3 production implementations, approved theme, financial policy, and principal branches are unchanged. GitHub run/results are reported with the pushed commit; any newly exposed inherited failure is reported separately rather than silently broadening scope.
