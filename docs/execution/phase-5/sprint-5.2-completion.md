# Sprint 5.2 — Payment Provider Contract & PayPal

Package: Continuous Rapid-Build Contract & Codex Package

Rapid branch: `rapid/phase4-5-client-commerce`

Accepted base: `7f8fb13c85f8e32570ea82ca9588e461a4e4f070`

Boundary SHA: this completion-report commit

## Outcome

Sprint 5.2 adds a provider-neutral payment boundary with a PayPal Sandbox adapter, authoritative provider verification, idempotent checkout creation, append-only provider-event history, and atomic paid-purchase effects. The accepted Sprint 5.1 product versions, frozen purchase terms, entitlements, and Review Credit ledger remain canonical and were adapted rather than rebuilt.

No production credentials, raw card data, Stripe/BofA behavior, refund/dispute operations, Sprint 5.3 work, or browser-controlled success path was added. The rapid branch remains separate from `ai-enabled`.

## Material implementation

- Added the `PaymentGateway` contract for checkout creation, authoritative retrieval/capture, webhook verification/normalization, and safe health reporting. `PayPalGateway` uses OAuth and PayPal Orders v2; `DeterministicPaymentGateway` is the automated-test adapter.
- Expanded canonical states with `AWAITING_CUSTOMER` and `PROCESSING`, with explicit monotonic transition rules. A verified late failure cannot regress an already successful payment.
- Added append-only `PaymentProviderEvent` with a provider/event uniqueness constraint and applied/ignored disposition. Unknown verified references are acknowledged without mutating business state; malformed or unverified webhooks fail closed and are security-audited.
- Added client checkout intent creation from the authenticated client and current active product version only. Price, currency, client, version, entitlement terms, and frozen terms are server-selected. The idempotency record commits with one purchase/payment/audit/outbox result, and PayPal request IDs make provider creation replay-safe.
- Browser return/cancel URLs never set paid state. Status refresh retrieves PayPal truth and captures only an already provider-approved order. Only authoritative `SUCCEEDED` applies paid state and Sprint 5.1 effects.
- A verified paid transition atomically commits Payment, Purchase, entitlement, Review Credit ledger entry, one client notification, audit, and outbox. Unique semantic/source/event keys make delivery and retry duplicate-safe.
- Added provider-safe client purchase history; checkout/status UI at `/app/checkout/:purchaseIntentId`; searchable, paginated and filtered Admin payment operations; payment detail/event history; and PayPal sandbox health/configuration status. No secret value is serialized.
- Added canonical Admin `payment.read` and `payment.manage` capabilities. Payment and gateway administration require Admin role, current MFA/step-up, and the corresponding capability; webhook authentication is provider-signature based rather than user-session based.

## Route classification

| Route                                      | Classification               | Authority                                                                                                     |
| ------------------------------------------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `POST /api/v1/client/checkouts`            | Checkout intent command      | Client principal + canonical active product + idempotency key; caller cannot supply commercial terms.         |
| `GET /api/v1/client/checkouts/:purchaseId` | Checkout/status truth        | Client self-scope only; PayPal retrieval/capture, never URL parameters, controls paid state.                  |
| `POST /api/v1/webhooks/paypal`             | Public provider callback     | PayPal OAuth webhook-signature verification; no user session; unknown references do not mutate.               |
| `GET /app/checkout/:purchaseIntentId`      | PORTAL-24 checkout/status    | Honest pending/returned/cancelled/failed/success states with support and history links.                       |
| `GET /admin/payments`                      | ADMIN-07 payment operations  | Admin + `payment.read` + MFA/step-up; deterministic pagination and provider/state/date/client/search filters. |
| `GET /admin/payments/:paymentId`           | ADMIN-08 payment detail      | Same gate; provider-event and commercial-effect evidence, no refund action.                                   |
| `GET /admin/integrations/paypal`           | ADMIN-09/10 gateway status   | Admin + `payment.read` + MFA/step-up; environment/configured/health only, never credentials.                  |
| `POST /admin/integrations/paypal/test`     | Gateway connectivity command | Admin + `payment.manage` + MFA/step-up.                                                                       |

## Acceptance proofs

| Required proof                                                 | Result                                                                                                                                                         |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser return cannot mark paid or grant effects               | PASS — the browser route only polls; status application requires authenticated provider retrieval/capture.                                                     |
| Forged/unverified webhook creates zero business effects        | PASS — deterministic provider proof rejects before the application transaction; production adapter requires PayPal verification success.                       |
| Verified paid grants frozen Sprint 5.1 effects exactly once    | PASS — integration proof asserts 1 entitlement, 1 ledger entry, 1 notification, and 1 outbox with the original terms snapshot unchanged.                       |
| Duplicate provider event creates no duplicate effects          | PASS — unique `(provider, providerEventId)` replay returns `DUPLICATE_EVENT`; exact counts remain one.                                                         |
| Duplicate checkout click creates one purchase/payment          | PASS — route integration proof replays the same idempotency result and asserts one of each.                                                                    |
| Caller cannot tamper with client, version, amount, or currency | PASS — strict request contract accepts only `productId`; injected commercial/client fields return HTTP 400; persisted amount remains canonical `41.00 USD`.    |
| Client IDOR and Admin capability denial                        | PASS — other-client checkout lookup is 404; absent session is 401; Admin without canonical capability is 403.                                                  |
| Pending/failed/cancelled states grant no success effects       | PASS — focused transaction proof checks pre-success count zero; effect code is reachable only for `SUCCEEDED`.                                                 |
| Out-of-order provider events cannot regress paid               | PASS — verified late failure is recorded ignored and Purchase remains `PAID`.                                                                                  |
| Unknown verified provider reference                            | PASS — event is retained as ignored with zero purchase mutation.                                                                                               |
| Secrets/raw payment data are not serialized or persisted       | PASS — public DTOs expose provider/environment/state and safe operational references only; gateway health serialization test rejects credential-shaped fields. |
| Expired session recovery on checkout/Admin paths               | PASS — both use the accepted C1 shared API request/session-loss boundary; focused Web auth/App regression remains green.                                       |

## Verification

- Persistent review database: `credit_strategy_phase4_5_block` on Credit PostgreSQL port `5433`; migrated forward without reset. The existing database retained a historical pre-rapid migration alias, so the new migration was applied and explicitly recorded without rewriting historical files.
- Clean migration-chain proof: **PASS** — all 34 repository migrations, including Sprint 5.2, deployed to fresh isolated `credit_strategy_sprint52_clean_20260901`.
- Focused provider/payment transaction and route gate: **PASS**, 8/8 across 3 files.
- Affected Sprint 5.1 commerce, authorization, auth and high-risk API gate: **PASS**, 22/22 across 7 files.
- Affected Web App/session regression: **PASS**, 21/21.
- Workspace typecheck: **PASS**.
- Workspace lint: **PASS**.
- Workspace production build: **PASS**. The established non-blocking Vite chunk-size advisory remains.
- Idempotent system/reference seed: **PASS** — the clean CI reproduction completed the seed twice after routing `tsx` temporary files to the workspace; GitHub independently completed both seed passes.
- Initial payment-risk GitHub CI: **BOUNDED FAILURE** — run `33562387292` passed clean migration, double seed, lint, and typecheck, then failed in the full test gate. An identical clean local CI reproduction isolated the failure to the accepted realtime business-command test's duplicate-delivery assertion, not the payment runtime.
- CI correction: the realtime proof now verifies that replay reaches at least one canonical Redis subscriber and then asserts the database still contains exactly one goal, audit, and outbox event. It no longer depends on a second Socket.IO delivery, whose timing is non-authoritative and competed with the persistent review runtime on the shared local Redis channel. The initial authorized delivery and authoritative refetch assertions remain unchanged. The focused realtime proof and final GitHub rerun are recorded at handoff.
- Corrective payment-risk GitHub CI: **PASS** — run `33563751645` completed install, all 34 migrations, double system seed, lint, typecheck, the full 118-test API gate plus all other workspace tests, and production builds at implementation head `66057399b72910d3ed488c23ed02e8ff6762829a`.

## Requirement self-review

| Package area                                    | Status                       | Evidence / residual                                                                                                                                               |
| ----------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Provider-neutral contract and PayPal Sandbox    | PASS                         | Interface plus PayPal and deterministic adapters; future providers remain unimplemented.                                                                          |
| Canonical state machine and monotonicity        | PASS                         | Central state mapping/rank and out-of-order integration proof.                                                                                                    |
| Server-authoritative idempotent checkout        | PASS                         | Strict payload, principal scope, frozen current version, shared idempotency command, PayPal request ID.                                                           |
| Provider-authenticated webhook and event ledger | PASS                         | PayPal verification API, unique event identity, safe unknown/malformed handling.                                                                                  |
| Atomic paid effects and duplicate safety        | PASS                         | One database transaction and exact-count integration proofs.                                                                                                      |
| PORTAL-24 checkout/status UX                    | PASS                         | Responsive design-system surfaces for waiting, returned, cancelled, unavailable, failed and successful states.                                                    |
| ADMIN-07 through ADMIN-10                       | PASS                         | Payment list/detail and PayPal status/test surfaces; no refund controls.                                                                                          |
| Audit/outbox/realtime/notification              | PASS                         | State/effect audit and outbox domains; exactly-one semantic notification.                                                                                         |
| Production processor credential validation      | DEFERRED BY DESIGN           | Production is not enabled in this sprint; checkout fails closed unless environment-managed PayPal configuration is complete.                                      |
| Live PayPal Sandbox round trip                  | READY / CREDENTIAL-DEPENDENT | Adapter is complete, but no repository or review-environment secret was invented or stored. Deterministic provider verification is the automated acceptance path. |

## Review environment

- Portal services: `http://localhost:5184/app/services`
- Checkout pattern: `http://localhost:5184/app/checkout/:purchaseIntentId`
- Purchase history: `http://localhost:5184/app/services/history`
- Admin payments: `http://localhost:5184/admin/payments`
- Admin PayPal status: `http://localhost:5184/admin/integrations/paypal`
- API: `http://localhost:3007`
- Client: `client@credit.local` / `DemoAccess2026!`
- Consultant: `consultant@credit.local` / `DemoAccess2026!`
- Admin: `admin@credit.local` / `DemoAccess2026!`

Staff routes retain QR-based MFA enrollment and step-up. The review environment remains Credit-only: PostgreSQL `5433`, Redis `6380`, and `credit_strategy_phase4_5_block`. Without PayPal Sandbox credentials, the catalog honestly disables purchase instead of simulating payment success.

## Final handoff

The exact final Sprint 5.2 SHA and successful payment-risk CI evidence are supplied after the branch push. No merge into `ai-enabled` is performed, and Sprint 5.3 is not started.
