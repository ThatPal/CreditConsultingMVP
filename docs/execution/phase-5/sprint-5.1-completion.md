# Sprint 5.1 — Service Products, Purchases & Entitlements

Package: Continuous Rapid-Build Contract & Codex Package  
Rapid branch: `rapid/phase4-5-client-commerce`  
Accepted base: `5b9317640ec1cad35569ff0dc72b5e70b545d297`  
Boundary SHA: this completion-report commit

## Outcome

Sprint 5.1 is complete on the persistent Phase 4–5 rapid branch. The existing commerce persistence was reconciled into a provider-neutral, versioned product catalog with immutable historical purchase terms, canonical entitlements, and an append-only Review Credit ledger. Client, scoped CRM, and step-up-protected administration surfaces now query those same foundations.

No payment-provider checkout, fake payment success, refund/dispute workflow, scheduling, or Sprint 5.2 behavior was added. The rapid branch remains separate from `ai-enabled`; `main` and `baseline/current-non-ai` were not modified.

## Existing-foundation reconciliation

| Existing concept                     | Decision                       | Result                                                                                                                                               |
| ------------------------------------ | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ServiceDefinition`                  | ADAPT / compatibility          | Preserved for accepted operational callers and system-seeded alongside canonical products; no longer the catalog truth for the new screens.          |
| `ServicePurchase`                    | ADAPT                          | Preserved, linked to an immutable product version, given a frozen JSON terms snapshot, and made provider-neutral.                                    |
| `ServiceEntitlement`                 | ADAPT                          | Preserved as canonical access truth; linked to product version and protected by a unique effect source key.                                          |
| `ReviewCreditTransaction`            | ADAPT                          | Preserved as the append-only Review Credit ledger; linked to source/version/correlation and used to derive balances.                                 |
| `Payment` and gateway contracts      | DEFER                          | Preserved untouched as a later provider foundation; Sprint 5.1 creates no provider payment or success path.                                          |
| Hard-coded client catalog projection | REMOVE from production routing | Production Prisma routing now uses the governed catalog; the old injectable router remains only for its accepted isolated characterization contract. |

## Material implementation

- Added `ServiceProduct` and immutable `ServiceProductVersion` with stable keys, explicit lifecycle, client-facing terms, exact `Decimal(12,2)` prices, currency, entitlement mapping, included quantity, included Review Credits, prerequisites, eligibility copy, and version history.
- Added two forward-only migrations. The first preserves and backfills existing definitions, purchases, entitlements, and ledger entries; the second supplies database-side UUID/update defaults required by direct and nested product creation. All earlier migrations remain unchanged.
- Extended the idempotent system/reference seed with three draft governed products and compatibility definitions. Demo/synthetic commerce data remains separate.
- Added `grantVerifiedPurchaseEffects`, which requires an already verified `PAID` purchase and atomically commits one canonical entitlement, an optional Review Credit ledger grant, one audit event, one outbox event, and the idempotency result. A failure rolls all business effects back.
- Added deterministic client catalog, active service/derived balance, and frozen purchase-history queries; consultant Client 360 uses the same scoped projection.
- Added step-up-protected product administration for searchable/paginated listing, detail/version history, draft product creation, immutable next-version creation, validated activation, and deactivation. Deactivation never removes history or existing entitlements.
- Added an idempotent Credit-only review scenario with a current v2 catalog, a historical v1 purchase, active entitlement, and Review Credit ledger grant.

## Route classification

| Route                                           | Classification                          | Authorization / truth                                                                                |
| ----------------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `GET /app/services`                             | PORTAL-21 available services            | Client self-scope; active canonical version only; checkout is honestly unavailable until Sprint 5.2. |
| `GET /app/services/active`                      | PORTAL-22 credits and active services   | Client self-scope; entitlement records plus balance derived from ledger deltas.                      |
| `GET /app/services/history`                     | PORTAL-23 purchase history              | Client self-scope; frozen purchase terms and deterministic newest-first ordering.                    |
| `GET /crm/clients/:clientId`                    | CRM-08 Client 360 services panel        | Consultant role, canonical `client.read`, and effective assignment/grant scope.                      |
| `GET /admin/services`                           | ADMIN-05 product list/editor            | Admin, canonical `commerce.manage`, verified MFA and current step-up.                                |
| `GET /admin/services/:serviceProductId`         | ADMIN-06 product detail/version history | Same admin gate; purchase counts are factual per immutable version.                                  |
| `/api/v1/client/services*`                      | Client query API                        | Client ID only from authenticated principal; no caller-supplied cross-client scope.                  |
| `/api/v1/consultant/clients/:clientId/services` | CRM query API                           | Shared canonical client-access middleware; fails closed.                                             |
| `/api/v1/admin/service-products*`               | Admin query/command API                 | Admin plus `commerce.manage` and step-up; mutations require idempotency keys.                        |

## Authorization, audit, outbox, and privacy

- `commerce.manage` is a canonical platform capability assigned to the Admin system role only. Every admin route also requires verified staff MFA and a current step-up session.
- Client queries derive scope from the authenticated principal. Consultant queries require canonical `client.read` plus assignment or a live, unrevoked grant. Focused denial tests prove both client-to-admin and out-of-scope consultant denial.
- Consequential catalog commands use the shared atomic idempotency/audit/outbox pattern. Product activation validates all required client terms and entitlement mappings before mutation.
- Commercial grant replay cannot duplicate entitlement, credits, audit, or outbox effects. The transaction rollback test deliberately collides the outbox key and proves that entitlement, ledger, and audit writes do not escape.
- API responses omit provider secrets, internal configuration, unrelated client data, and fabricated provider status. Money is serialized as exact decimal strings.

## Verification

- Persistent database: `credit_strategy_phase4_5_block` on Credit PostgreSQL port `5433`; migrated forward in place without reset.
- Persistent migration deploy: **PASS**, 33 migrations discovered and both Sprint 5.1 migrations applied.
- Clean migration-chain proof: **PASS**, all 33 migrations applied to fresh isolated `credit_strategy_sprint51_clean_20260901`.
- Idempotent system/reference seed: **PASS**, 16 option templates, 18 role capabilities, 2 document types, 2 notification templates, 8 support categories, 1 integration, and 3 canonical service products. Repeated focused execution remained idempotent.
- Focused commerce/domain/authorization/high-risk API gate: **PASS**, 21/21.
- Affected Web regression: **PASS**, 58/58 across 10 files.
- API and Web typecheck: **PASS**.
- Changed-workspace lint: **PASS**.
- API and Web production build: **PASS**. The established non-blocking Vite large-chunk advisory remains.
- Initial risk-based GitHub CI: **BOUNDED FAILURE** — run `33555768251` proved install, clean migration, double seed execution, lint, and typecheck, then exposed one stale seed-result contract assertion after the intentional addition of `serviceProducts: 3`. The assertion was corrected and its focused seed/commerce gate passed 9/9.
- Corrective risk-based GitHub CI: **PENDING** at correction-report commit time; final task handoff supplies the run result and URL.

## Acceptance proofs

| Required proof                                             | Result                                                                                                    |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Historical terms remain frozen after catalog change        | PASS — unit proof plus persistent v1-purchase/v2-catalog scenario.                                        |
| Review Credit balance is derived, not mutable cached truth | PASS — ledger reduction proof and API projection.                                                         |
| Duplicate idempotency key creates no duplicate effects     | PASS — exactly 1 entitlement, 1 credit entry, 1 audit, and 1 outbox event.                                |
| Business + ledger + audit + outbox are atomic              | PASS — forced outbox collision leaves 0 entitlement, 0 credit entry, and 0 success audit.                 |
| Money precision                                            | PASS — `149.10` remains an exact decimal string.                                                          |
| Product activation validation                              | PASS — seven incomplete/invalid-term blockers and HTTP 409 route proof.                                   |
| Deactivation preserves history/access records              | PASS — only product availability/current-version state changes; no destructive relation operation exists. |
| Client/staff authorization boundaries                      | PASS — principal self-scope, canonical consultant client scope, and MFA/step-up Admin gate.               |

## Review environment

- Portal: `http://localhost:5184/app/services`
- Active services and credits: `http://localhost:5184/app/services/active`
- Purchase history: `http://localhost:5184/app/services/history`
- Admin products: `http://localhost:5184/admin/services`
- CRM client directory: `http://localhost:5184/crm/clients`
- API: `http://localhost:3007`
- Client: `client@credit.local` / `DemoAccess2026!`
- Consultant: `consultant@credit.local` / `DemoAccess2026!`
- Admin: `admin@credit.local` / `DemoAccess2026!`

Staff routes retain the accepted QR-based MFA enrollment and step-up flow. The local environment uses only the Credit PostgreSQL instance on port `5433`, Credit Redis on `6380`, and the persistent `credit_strategy_phase4_5_block` database.

## Deferred ownership and risks

- Sprint 5.2 owns payment-provider checkout, verified provider event ingestion, refunds, disputes, reconciliation, and any purchase state machine expansion.
- Scheduling/appointment fulfillment remains in its later owning phase. Product eligibility copy is informative and does not fabricate fulfillment readiness.
- Existing compatibility `ServiceDefinition` callers remain until their owning workflows migrate to canonical product versions; the new catalog and all new commercial history use `ServiceProductVersion`.
- The portal intentionally disables purchase action rather than simulating a successful payment.

## Final handoff

The exact final Sprint 5.1 SHA and successful risk-based CI evidence are supplied in the task handoff after the branch push. No merge into `ai-enabled` is performed.
