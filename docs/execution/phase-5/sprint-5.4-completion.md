# Sprint 5.4 — Bank of America Merchant Services Adapter — Completion Report

## Boundary

- Branch: `rapid/phase4-5-client-commerce`
- Accepted base: `7b662b9038b8a5625a029563b85ea96a0349b94b`
- Execution mode: Continuous Rapid-Build Block, high-risk payment-provider boundary
- Schema/migrations: unchanged; `BOFA_MERCHANT` and the existing canonical Payment/Purchase model were reused
- Implementation/final SHAs: recorded after the sprint boundary commits
- Final payment-risk GitHub CI: pending exact-boundary push

## Official provider discovery and chosen path

Current official Bank of America Merchant Services documentation was reviewed before implementation:

- The [BofA REST setup guide](https://developer.merchant.services.bankofamerica.com/docs/bofa/en-us/platform/developer/all/rest/rest-getting-started.html) recommends JWT for new REST integrations and documents the September 2026 migration away from HTTP Signature, plus message-level-encryption requirements.
- The [official API reference](https://developer.merchant.services.bankofamerica.com/api-reference-assets/index.html?stage=beta) identifies the sandbox host as `https://apitest.merchant-services.bankofamerica.com` and requires provisioned merchant authentication.
- The [BofA secure integration overview](https://developer.merchant.services.bankofamerica.com/accept-payments/secure-integration-methods.html) identifies hosted/drop-in Unified Checkout and hosted fields as the approaches that keep sensitive card data away from merchant servers.
- The current [Secure Acceptance hosted-payment documentation](https://developer.cybersource.com/docs/cybs/en-us/sa/developer/all/sa-hosted/secure-acceptance.html), which underlies the BofA gateway platform, documents server-side HMAC-SHA256 signing, the test hosted endpoint, signed merchant POST notifications, and direct provider collection of card data.

No provisioned BofA sandbox MID, JWT/MLE key material, Secure Acceptance profile, or certificate was available in the environment. A direct REST implementation could therefore not be authenticated or honestly verified. Sprint 5.4 implements the documented Secure Acceptance hosted-payment profile boundary: server-signed form POST to `https://testsecureacceptance.cybersource.com/pay` and signature-verified merchant POST notification. It does not claim a live sandbox connection.

The hosted profile does not provide an authenticated status/refund/reconciliation REST client by itself. Those capabilities are explicitly reported as unsupported by this configured adapter rather than simulated. A future provisioned JWT+MLE BofA REST connection can extend the same adapter behind the provider-neutral contract; no operator workflow was pulled forward from Sprint 5.5.

## Implementation summary

- Added `BankOfAmericaGateway` under the existing `PaymentGateway` and `PaymentGatewayRegistry` architecture.
- Corrected `DeterministicPaymentGateway.health()` to return `this.provider`; deterministic Stripe and BofA instances now report their actual provider.
- Added `BOFA_MERCHANT` to the bounded environment-governed default-provider selection for new checkout while historical retrieval still resolves from persisted `Payment.provider`.
- Added server-side HMAC-SHA256 signing of every canonical hosted form field. Commercial fields come only from canonical ServiceProduct/Purchase/Payment state.
- Added authenticated client launch regeneration at `POST /api/v1/client/checkouts/:purchaseId/launch`; it returns only provider-required signed form fields and the browser posts directly to BofA/Cybersource.
- Added public provider-authenticated merchant notification endpoint `POST /api/v1/webhooks/bofa` using form decoding and timing-safe signature comparison.
- Normalized hosted decisions: `ACCEPT → SUCCEEDED`, `REVIEW → PROCESSING`, `CANCEL → CANCELLED`, `DECLINE/ERROR → FAILED`, unknown safe states → `PENDING`.
- Verified notifications enter the same unique provider-event ledger, monotonic state machine, and `applyVerifiedPaymentEvent` transaction used by PayPal and Stripe.
- Added safe BofA Admin health/capability route and screen at `/admin/integrations/bofa`. “Configured” is distinguished from externally verified connectivity.
- Kept PORTAL-24 as one provider-neutral checkout surface. BofA uses a server-generated hosted form without adding any card inputs to Credit.

## Configuration and secret handling

- `PAYMENT_DEFAULT_PROVIDER=BOFA_MERCHANT` selects BofA for new checkout only when configured.
- `BOFA_ACCESS_KEY`, `BOFA_PROFILE_ID`, and `BOFA_SECRET_KEY` are environment-only hosted-profile inputs.
- `BOFA_HOSTED_URL` defaults to the documented test endpoint; `BOFA_ENVIRONMENT` defaults to `SANDBOX`.
- No shared secret, certificate, private key, JWT assertion, authorization header, PAN, CVV, or full provider payload is written to logs, audits, normal database JSON, or client/Admin DTOs.
- The hosted-profile access key/profile ID and request signature are provider-required browser form fields and are returned only by the self-scoped launch command; the HMAC secret used to produce the signature is never returned.
- Unconfigured BofA fails before the consequential checkout command, creating no Payment, Purchase, or paid effects.

## Status, event, refund, and reconciliation behavior

- Authoritative success: a correctly signed merchant POST with decision `ACCEPT`.
- Browser return/direct navigation: never authoritative and cannot grant effects.
- Duplicate notification: unique `(provider, providerEventId)` handling returns duplicate without additional effects.
- Reordered late decline after paid: retained as ignored and cannot regress canonical success.
- Provider status retrieval: explicit `BOFA_STATUS_RETRIEVAL_UNSUPPORTED_WITH_HOSTED_PROFILE`; merchant notification is the configured asynchronous authority.
- Refund primitive: explicit `UNSUPPORTED` for this hosted-profile-only adapter.
- Reconciliation primitive: explicit `UNSUPPORTED` for this hosted-profile-only adapter.
- Live BofA REST status/refund/reconciliation requires a provisioned sandbox MID plus current JWT/MLE credentials and is environment-dependent, not claimed as automated evidence.

## Verification

- Focused BofA/PayPal/Stripe provider, payment, transaction, route, domain, webhook/notification gate: **PASS**, 24/24 across 7 files.
- Real PostgreSQL BofA notification proof: **PASS** — forged signature produced zero effects; signed `ACCEPT` plus duplicate delivery produced exactly one provider event, entitlement, Review Credit transaction, notification, paid audit, and paid outbox event.
- BofA checkout/idempotency proof: **PASS** — unconfigured default produced zero records; configured repeated canonical key produced one Purchase/Payment and one stable hosted transaction identity.
- BofA reordered event proof: **PASS** — late decline after paid was ignored without state/effect regression.
- Deterministic provider health cleanup: **PASS** for Stripe and `BOFA_MERCHANT` identities.
- Affected API application/authentication/canonical-authorization gate: **PASS**, 8/8 across 2 files.
- PORTAL-24 BofA hosted-form and accepted Web session/return-path gate: **PASS**, 19/19 across 5 files.
- API typecheck: **PASS**.
- Web typecheck: **PASS**.
- Workspace lint: **PASS**.
- API production build: **PASS**.
- Web production build: **PASS**; the established non-blocking chunk-size advisory remains.
- Migration proof: **NOT APPLICABLE** — no schema or migration changed.
- Live BofA sandbox transaction: **NOT RUN / ENVIRONMENT-DEPENDENT** — no merchant sandbox account or secret/certificate material was supplied.
- Mandatory final GitHub payment-risk CI: **PENDING** until the exact sprint boundary is pushed.

## Requirement reconciliation

| Material requirement                         | Status                                  | Evidence / limitation                                                                                                                                           |
| -------------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sprint 5.3 deterministic-health cleanup      | PASS                                    | Health returns the instance provider; Stripe/BofA proof added.                                                                                                  |
| Provider-neutral BofA adapter                | PASS                                    | Registry, canonical checkout, shared Payment/Purchase and effects transaction.                                                                                  |
| Current official capability discovery        | PASS                                    | Current BofA authentication, sandbox, hosted security, and MLE constraints documented above.                                                                    |
| Hosted/tokenized card security boundary      | PASS                                    | Provider-hosted form; Credit has no PAN/CVV form, transport, or persistence.                                                                                    |
| Authentication/signing configuration         | PASS                                    | HMAC profile signing and timing-safe notification verification; environment-only secrets.                                                                       |
| Server-authoritative idempotent checkout     | PASS                                    | Strict product-only command, canonical fields, stable payment transaction ID, duplicate proof.                                                                  |
| Authoritative status/capture                 | PARTIAL — PROVIDER PROFILE LIMIT        | Signed merchant notification is authoritative; hosted profile has no authenticated polling client. JWT/MLE REST was not fabricated without sandbox credentials. |
| Webhook/event verification                   | PASS                                    | Signed merchant POST endpoint, forged zero-effects proof, unknown-reference shared behavior.                                                                    |
| Exactly-once effects and monotonicity        | PASS                                    | Real PostgreSQL paid/duplicate/reordered proofs plus retained C1 rollback/retry regression.                                                                     |
| Refund/reconciliation adapter capability     | PARTIAL — PROVIDER PROFILE LIMIT        | Explicitly unsupported by hosted-profile adapter; current REST primitives require provisioned JWT/MLE connection. No fake operation.                            |
| Safe provider capabilities                   | PASS                                    | Health DTO exposes hosted form, notification, status, refund, and reconciliation capability truth.                                                              |
| PORTAL-24, Services, History                 | PASS                                    | One provider-neutral surface and canonical history; BofA hosted form composed inside checkout.                                                                  |
| Admin BofA foundation                        | PASS                                    | Safe configured/readiness/capability screen and protected health/test routes.                                                                                   |
| Authorization/privacy/IDOR                   | PASS                                    | Self-scoped client routes, capability/step-up Admin gates, provider-authenticated public callback.                                                              |
| Audit/outbox/realtime/notification           | PASS                                    | Shared canonical event/effect families and exactly-one notification.                                                                                            |
| Failure/recovery                             | PASS within hosted profile              | Unconfigured, forged, duplicate, reordered, abandonment/return, restart/database convergence are bounded by canonical truth.                                    |
| Live sandbox E2E                             | NOT IMPLEMENTED — ENVIRONMENT-DEPENDENT | Requires BofA sandbox provisioning and current merchant keys; deterministic evidence does not claim connectivity.                                               |
| Sprint 5.5 operator/refund/dispute workspace | NOT IMPLEMENTED — OUT OF SCOPE          | Sprint 5.5 was not started.                                                                                                                                     |
| Phase 6                                      | NOT IMPLEMENTED — OUT OF SCOPE          | Phase 6 was not started.                                                                                                                                        |

## Persistent review environment and boundary confirmation

Only Credit infrastructure was used: PostgreSQL `5433`, Redis `6380`, and persistent database `credit_strategy_phase4_5_block`. No reset or migration occurred. Review remains at `http://localhost:5184/app/services`, BofA Admin health is `http://localhost:5184/admin/integrations/bofa`, and the API remains on `http://localhost:3007`.

The rapid branch remains separate from `ai-enabled`. Sprint 5.5 and Phase 6 were not started.
