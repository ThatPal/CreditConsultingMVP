# Sprint 5.5 — Gateway Selection, Refunds, Disputes & Reconciliation

Status: COMPLETE — pending exact-boundary GitHub CI at initial commit time  
Package: Continuous Rapid-Build Contract & Codex Package, retrieved 2026-09-01  
Branch: `rapid/phase4-5-client-commerce`  
Accepted base: `efe7f4b1babf152a62edd098363f5ed0dac9f6c1`  
Implementation/final boundary: recorded after commit and CI below

## Delivered outcome

Phase 5 now has persistent, provider-neutral Commerce operations for PayPal, Stripe, and Bank of America Merchant Services. New checkout resolves only the canonical enabled/default gateway. Existing payment operations always resolve the immutable `Payment.provider`; no automatic or cross-provider fallback exists.

Admin can inspect configured/connected/enabled/default state and capabilities, test a connection without charging, update safe non-secret metadata, enable/disable a non-default gateway, select a new default, search/page payments, inspect refunds/disputes/reconciliation, issue a refund, and reconcile a historical payment. The client checkout remains provider-neutral.

## Schema, migration, and synthetic data

- Added `PaymentGatewayConfig`, `PaymentRefund`, `PaymentDispute`, and `PaymentReconciliation` plus governed state enums and Payment relations.
- Migration: `20260902000000_gateway_refund_dispute_reconciliation`.
- Database partial unique index permits at most one `defaultForCheckout = true`; a check constraint requires that default to be enabled. Admin mutations additionally serialize on a PostgreSQL advisory transaction lock.
- Configuration JSON is limited to non-secret references/display metadata. Provider secrets stay in environment/secret stores.
- Demo setup now supplies three gateway states, PayPal partial refund, Stripe historical dispute while disabled for new checkout, and BofA blocked reconciliation evidence.
- Clean proof: all 35 migrations deployed and the canonical system seed completed on disposable `credit_strategy_sprint55_migration_proof`; the database was removed afterward.

## Commerce authority and historical routing

- Browser input cannot select a provider. Checkout reads the persistent canonical default and verifies configured/healthy/enabled state.
- Default changes affect future checkout only. Historical `Payment.provider` is never updated.
- Refund and reconciliation acquire the adapter from the historical payment provider, even when another provider is current default or the historical provider is disabled for new checkout.
- Disabling the current default is blocked until another default is selected. Unhealthy default checkout fails closed; no failover occurs.

## Refund, entitlement, dispute, and reconciliation behavior

- Full and partial refunds record provider/reference, amount/currency, actor/source, reason, status, and immutable Payment/Purchase linkage.
- Per-payment transaction locks plus serializable reservations prevent concurrent over-refunds. Same-key retries reuse one refund; a failed provider call leaves no ledger/entitlement/audit/outbox/notification effect and may retry to exactly one success.
- Successful full refunds transition Purchase/Payment, cancel unused active/reserved entitlements, and append a negative Review Credit adjustment only for remaining available credit. Consumed credit is not silently restored or deleted.
- Successful refund audit/outbox and one client notification are idempotent.
- Verified dispute events upsert one canonical dispute and apply monotonic status rank; duplicate/reordered events cannot duplicate or regress terminal state.
- Reconciliation retrieves through the original adapter, applies only the existing monotonic payment-event pipeline, never rewrites provider identity, and records an idempotent attempt/result.

## Provider capability/evidence

| Provider | Checkout | Refund | Reconciliation | Evidence/limitation |
|---|---|---|---|---|
| PayPal | Redirect | Provider-neutral adapter uses official capture-refund endpoint and request idempotency | Order retrieval | Deterministic contract and real-DB canonical-effect tests passed. No external sandbox refund was claimed because credentials were not present. |
| Stripe | Hosted Checkout redirect | Provider-neutral adapter uses PaymentIntent refund and idempotency key | Checkout Session retrieval | Signature/payment/dispute contract and real-DB canonical-effect tests passed. No external test-mode refund was claimed because credentials were not present. |
| BofA Merchant | Secure Acceptance hosted form | Explicitly blocked | Explicitly blocked | Hosted-profile Sprint 5.4 boundary is preserved. No JWT/MLE REST credentials exist, so no refund/retrieval is simulated and no fallback occurs. |

## Security, audit, outbox, realtime, and privacy

- Admin read/mutations require canonical `payment.read`/`payment.manage`, Admin role, and current MFA step-up.
- Refund amount/reference and provider are server-owned; payment/client IDOR and cross-role mutations fail closed.
- Consequential gateway/refund/dispute/reconciliation changes create safe audit/outbox events using existing realtime invalidation domains.
- DTOs, audit metadata, fixtures, and UI contain no PAN, CVV, signing secret, private key, or unrestricted raw provider payload.

## Verification

- Focused Phase 5 Commerce/provider/domain/API/authorization: **11 files, 39 tests passed**.
- Final focused gateway/refund route correction: **2 files, 10 tests passed**.
- Affected web checkout/auth/session: **2 files, 13 tests passed**.
- API typecheck: PASS.
- Web typecheck: PASS.
- Workspace lint: PASS.
- API build: PASS.
- Web build: PASS (existing non-blocking Vite chunk-size advisory only).
- Persistent migration deploy and demo scenario refresh: PASS.
- Clean migration + system seed: PASS.
- GitHub CI: PENDING final push.

## Requirement reconciliation

| Package group | Status | Evidence/qualification |
|---|---|---|
| 1. Canonical gateway configuration | PASS | Persistent records, unique/check constraints, serialized mutations. |
| 2. Admin gateway commands | PASS | Inspect/test/safe configure/enable/disable/default with step-up, audit, outbox. |
| 3. New checkout selection | PASS | Persistent enabled/default/health selection; browser provider rejected. |
| 4. Historical provider routing | PASS | Payment provider is immutable adapter authority for events/refund/reconcile. |
| 5. Refund domain/state | PASS | Canonical partial/full state, amount reservation, replay/concurrency proof. |
| 6. Entitlement/Review Credit policy | PASS | Unused state revoked/adjusted append-only; consumed credit not restored. |
| 7. Provider refund operations | PARTIAL | PayPal/Stripe implemented and deterministically verified; external sandbox calls unavailable. BofA truthfully blocked. |
| 8. Dispute domain/events | PASS | Canonical visible dispute and monotonic duplicate-safe event application; broad evidence workflow intentionally excluded. |
| 9. Reconciliation | PASS | Original-provider retrieval, monotonic shared pipeline, attempt history; BofA blocked. |
| 10. Admin payment operations | PASS | Scalable payment/refund/dispute lists, detail/actions, gateway controls. |
| 11. Client surfaces | PASS | Provider-neutral checkout and existing safe service projections retained. |
| 12. Realtime/outbox/notification | PASS | Canonical invalidations plus one meaningful refund-success notification. |
| 13. Security/privacy | PASS | Canonical capability/step-up and safe data boundaries tested. |
| 14. Failure/concurrency | PASS | Default race, refund retry/over-refund, event duplication, BofA block tested. |
| 15. Synthetic/review data | PASS | Three providers and refund/dispute/reconciliation/blocked scenarios seeded. |

## Known limitations / defects

- P0/P1: none known.
- P2: Real PayPal/Stripe sandbox refund/reconciliation calls were not executed because credentials were absent. Adapter contracts and canonical DB effects are covered deterministically.
- P2: The BofA hosted profile cannot perform authenticated refund/status/reconciliation. This is an explicit capability block pending provisioned BofA REST JWT/MLE credentials, not a simulated success.
- P3: Admin gateway safe-metadata editing is API-complete; current UI prioritizes status/default/enable-disable/test controls rather than a broad metadata form.

## Environment and boundary confirmation

- Credit-only database: `credit_strategy_phase4_5_block` on PostgreSQL port 5433; Redis port 6380.
- Existing local review environment and ports were reused.
- No valid prior test was weakened or deleted to obtain a pass.
- The rapid branch was not merged into `ai-enabled`.
- Phase 6 was not started.
