# REC-02 / COM-01A — review checkpoint

Packet: version 1.0 (22 September 2026). **Ready for technical review; not merged or product-approved.**

## Baseline and preservation

- Pinned candidate (before the review commit): `1daf6eb58f5e33bc7b0673f0a5bf0f2ee26e629d`.
- Isolated branch: `fix/astra-commerce-integrity`, newly created from that pin. The user authorized committing and pushing fixes, tests and this report on this isolated branch for GitHub review. This is not merge or product approval.
- Worktree: `C:/Users/morde/Desktop/Projects/Credit/.worktrees/astra-commerce-integrity`.
- Original Astra checkout was clean at the pin. Complete history: not shallow, no promisor/partial-clone configuration. All three inspected source blob IDs match the packet.
- At pre-publication verification, all 35 GitHub heads matched the manifest; all corresponding objects exist locally and are ancestors of/equal to the candidate. The nine commits after `bef53dc` are present; see `candidate-commits.txt` and `baseline-refs.json`.
- `refs-before.txt` and `refs-after.txt` are identical pre-publication snapshots; publication adds only the isolated review branch. `remote-heads-after.txt` was read from GitHub, not inferred from cached tracking refs.

| Protected ref | Before and after remote SHA | Local distinction |
|---|---|---|
| main; baseline/current-non-ai | 642112202adee802b7d206bfe364dd779b33448c | Same locally |
| ai-enabled | e27b741637c84d9bc1a873b083664404bfd32dae | Local branch remains becce2d268263c6c196cc524cb62526f0c65aec1, 106 commits ahead of that remote |
| codex/astra-production | bef53dcbae9b6ae090f90cdeef56cdc0d73740e5 | Same locally |
| ui/credit-profile | 1daf6eb58f5e33bc7b0673f0a5bf0f2ee26e629d | Same locally; approved theme preserved |

The local Overview branch is `33610fa`, one commit ahead of its remote `488471a`. The local-only `sprint/0.2-structural-reconciliation` branch and detached legacy `5c73bede` worktree are preserved. Before the review commit, all local branch commits were reachable through some existing remote ref (`git rev-list --count --branches --not --remotes=origin` = 0); this does not mean each same-named branch was pushed. Detached legacy `5c73bede` is an ancestor of the candidate. No ref deletion or merge is recommended. Other checkout files were not changed.

The packet overrides AGENTS.md's older fixed-worktree/branch and next-roadmap instructions for this bounded repair. Other security/isolation rules remain in force. No owner-document change or broader feature requirement was assumed.

## Findings

### R1 — REPRODUCED → FIXED

Baseline `updateGatewayMetadata` dropped capabilities on save; the ordinary Admin list refresh then replaced operator fields with capabilities alone. Evidence: `r1-r2-baseline.txt` and `r1-refresh-baseline.txt` (expected failures).

Both writers now merge metadata within the existing field. A per-provider transaction advisory lock serializes their read/modify/write operations so refresh cannot race a deliberate edit and lose its fields. Health/capabilities continue updating. Operator edits retain version, audit and outbox semantics; refresh does not increment the edit version. The validated API editor remains limited to displayName/accountReference.

Verified actual route/function save, default resolution, list, connection-test path, degraded health refresh, capability updates, audit/version behavior, enabled/default preservation, and denied client/capability/step-up edits. The fake capability store runs through the real canonical authorization service and middleware. No production permission changes.

### R2 — REPRODUCED → FIXED

Baseline: failed A order creation persisted the purchase/payment; changing the persisted default to B caused replay to call B. An unavailable A still returned 200 by falling back to B. Existing-attempt replay also incorrectly re-evaluated current product availability. See `r1-r2-baseline.txt`.

The route now looks up the authenticated caller's idempotency record first, validates the original product/version/hash and ownership, then resumes that recorded attempt. New commands still use current pricing/availability/default selection. Provider invocation always comes from the persisted payment, with matching environment, existing health/configuration policy, enabled status and resumable payment state. Unavailable attempts retain their identity and error/recovery state; no fallback, paid state or grants. Key conflicts return a 409 at the checkout boundary.

Verified same IDs/terms/amount/currency/provider/environment; no duplicate payment; no entitlements or Review Credits; new request uses B; disabled/unhealthy/changed-environment A makes no checkout call; successful replay stability; inactive product replay; mismatched product rejection; other-client isolation. Existing original-provider refund/reconciliation and payment-domain regression files pass.

The two instrumented transports are completely fake and use `SANDBOX`, not `TEST`, to avoid `ensureGatewayConfigs` resetting the persisted default. They contain no network or SDK calls. No forged provider events were introduced. Existing deterministic financial-domain tests remain synthetic software validation.

### R3 — REPRODUCED → FIXED

Baseline visible page-one search changes and delayed-query regression fail (`r3-baseline.txt`). Normalized search now participates in both URL query construction and query identity.

A focused follow-up reproduced input unmount/focus loss on a replacement query after adding the missing key (`r3-loading-focus-reproduction.txt`). A non-data placeholder keeps the existing controls mounted while withholding old rows/counts. The existing progress control is used inside the ledger; no-match/pagination wait for real results. Initial full-page loading and error/retry behavior remain. No reload or global cache reset.

Four component tests cover A→B with counts changing 1→2, whitespace normalization, clear, Back, URL restoration, visible provider/state controls, delayed old responses, no-match recovery and keyboard focus. Component tests explicitly stub responses; primary browser evidence below uses real isolated API/DB data.

## Environment and safety

Node 24.16.0; pnpm 11.19.0; Prisma 7.9.1; Vitest 4.1.11. Dependencies installed offline with the frozen lockfile and no upgrades. Lockfile SHA-256: A82E2DA105B11AB432BBB00F752AED5CA340333727E04670CBBF75BB4160B86A.

Disposable Docker container `credit-rec02-com01a-db`, PostgreSQL 17-alpine, tmpfs data, host binding only `127.0.0.1:5547`. Final DB name: `credit_strategy_rec02_com01a`. All 69 existing migrations were applied; no schema/migration changes. The first disposable DB name was rejected by the existing database safety guard; it was renamed, not bypassed. See `database-check.txt`, `generate.txt`, `migrate.txt` and `browser-migrate.txt`.

No existing .env, demo database, bank credentials or client reports were copied. The destructive fixture checks current_database() before creating records or clearing gateway configs. Tests run sequentially. No worker/email sender launched. No external provider payments/refunds/API calls. Synthetic checkout URLs use `.invalid` and were not followed. Provider-event/verification implementation files did not change; broader live/provider suites were not run.

Browser API/web used dedicated loopback ports 3017/5197. The harness is read-only after synthetic setup. It supplies a test staff principal/capability store; **login, session establishment and real MFA are not verified by these screenshots**. Payment records/search/counts come from the actual payment router and disposable PostgreSQL, without response stubs. Production authentication code is unchanged. Test services/container are stopped after evidence collection.

## Verification and artifacts

- Required four existing API suites plus the scoped suite: **24/24 passed** (`api-fixed-final.txt`). Final strengthened scoped suite: **6/6 passed** (`acceptance-final.txt`), included within the same 24 cases.
- Web: **4/4 passed** (`r3-fixed-final.txt`).
- API/web typecheck, web build and targeted lint: passed; corresponding text files contain actual tool output.
- Baseline regressions intentionally fail; interim failures are retained. `api-fixed.txt` records an overly strict connectionVerified check that rejected the existing hosted-form contract, subsequently removed. `api-fixture-reset-failure.txt` records test-state contamination, corrected by creating a fresh fixture before each scoped case. No baseline or interim failure is counted as a pass.
- Browser: desktop 1440×1000 and mobile 390×844 at `/admin/payments`; A→B, no-match, clear recovery, no horizontal overflow, no browser script errors. `browser-results.json` records actual request URLs/statuses and the identity-fixture limitation.

| State | Desktop | Mobile |
|---|---|---|
| Nonempty | [desktop-nonempty.png](desktop-nonempty.png) | [mobile-nonempty.png](mobile-nonempty.png) |
| No match | [desktop-no-match.png](desktop-no-match.png) | [mobile-no-match.png](mobile-no-match.png) |
| Clear recovery | [desktop-clear-recovery.png](desktop-clear-recovery.png) | [mobile-clear-recovery.png](mobile-clear-recovery.png) |

Screenshots use the feature working tree based on the candidate above. The existing composition and approved theme are unchanged. `browser-api.ts` and `browser-check.mjs` preserve the local-only reproduction harness; they are not imported into production.

## Changed files

Production: `paymentOperations.ts` (metadata ownership), `paymentRoutes.ts` (recorded checkout replay), `AdminPaymentsPages.tsx` (effective query identity/loading continuity). Tests: `commerceIntegrity.fixture.ts`, `commerceIntegrity.integration.test.ts`, `AdminPaymentsPages.test.tsx`. Evidence: this directory. No other production files; no theme, Credit Center, ACH, schema, publication or entitlement architecture changes.

## Limits and stop

No real-provider credentials/connectivity, live payments/refunds, real-bank operations, full authentication/MFA flow, or whole-product acceptance claimed. No new unrelated defect was repaired. The R3 focus correction is a directly reproduced consequence of this query binding and stays within R3. Concurrency coverage for R1 is provided by the shared transaction lock implementation but no dedicated overlapping-write stress test was run.

All requested findings are reproduced and repaired; no execution blocker remains. Changes are prepared for GitHub review on the isolated branch in the commit containing this report. Principal refs, repository visibility and the approved theme remain unchanged. **STOP: no merge, principal-ref advancement, ACH or next feature.**
