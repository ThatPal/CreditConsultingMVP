# Phase 4–5 Visual & Interaction Maturity Wave

Status: **IMPLEMENTED — PRODUCT OWNER REVIEW PENDING**

Branch: `rapid/phase4-5-client-commerce`
Accepted starting head: `b32b22a815963850e69581d0b2f7a2f30c407fbc`

## Audit method

The healthy Credit-only review environment was audited browser-first at wide desktop (1440×900), representative mobile (375×812), and narrower layouts. The audit used the governed sample data to exercise populated lists, empty states, filters, pagination, detail navigation, loading states, forms, staff MFA, and consequential commerce controls. Client, Consultant CRM, and Admin production routes were reviewed; honest foundation routes were classified without inventing future functionality.

## Findings and dispositions

| ID | Role / route | Severity | Category | Before | After / disposition |
| --- | --- | --- | --- | --- | --- |
| V01 | Client `/app/application-rounds` | P1 | Product honesty | A production route exposed `Reset cycle (dev)` and “Full roadmap.” | Removed the developer mutation/control; renamed the customer-facing section “Application journey.” **Corrected** |
| V02 | Client links across Goals, Readiness, Reviews, and cycles | P1 | Navigation | Actions used legacy `/client/*` paths and depended on redirects; Review paths could leave the canonical shell. | All affected actions now target canonical `/app/*` routes directly. **Corrected** |
| V03 | CRM `/crm/reviews` | P1 | Navigation / task completion | “Open guided Review” linked to an unregistered `/consultant/reviews/*` route and returned the user to the dashboard. | Link now opens `/crm/reviews/:clientId/:reviewId`; verified in the running browser. **Corrected** |
| V04 | Client `/app` and `/app/journey` | P1 | Information architecture | Home repeated the entire Journey page, including cycle and history sections. | Home now presents focus/foundation summary plus one clear Journey CTA; Journey remains the timeline owner. **Corrected** |
| V05 | Admin `/admin/services` | P1 | Operational hierarchy | A long create-product form dominated the page before the product catalog. | Creation is collapsed behind an explicit page action and closes after success; catalog is the default working view. **Corrected** |
| V06 | Admin payment list/detail/integrations | P1 | Terminology / navigation / safety | Raw provider and environment codes were exposed; payment detail lacked return navigation; gateway enable/disable lacked confirmation. | Human-readable provider/environment labels, a Back to payments action, and explicit historical-routing-aware confirmation were added. **Corrected** |
| V07 | Client `/app/credit-center` | P2 | Long-page scanability | The complete profile/review history is a long single surface without local section navigation. | Current hierarchy remains usable and truthful. A sticky section index is **deferred** because it is a high-touch restructuring beyond this consolidated correction wave. |
| V08 | Admin `/admin` | P2 | Operational density | The landing surface is intentionally sparse and uses generic “Open” actions. | **Deferred**; no fabricated aggregate metrics were introduced. A later Admin operations package may add authoritative counts. |
| V09 | CRM `/crm/sessions`, `/crm/calendar` | P3 | Honest foundation | Routes contain honest unavailable-state guidance rather than fake schedules. | **Accepted / deferred by roadmap.** |
| V10 | Client/CRM/Admin responsive shells | P1 validation | Responsive behavior | Risk of dense controls overflowing narrow viewports. | Representative Client, CRM Work Queue, and Admin Payments views were checked at 375 px with no horizontal overflow. **Verified** |
| V11 | Worker outbox runtime | P1 | Environment isolation / startup reliability | BullMQ discarded the Redis database selected in `REDIS_URL`, and startup could publish before the worker was ready. This made isolated regression environments share the live queue and exposed a real startup race. | BullMQ now preserves the configured Redis database and awaits worker readiness before the first outbox batch. A regression test covers database selection. **Corrected** |

## Route coverage

- Client: `/app`, `/app/journey`, `/app/credit-center`, `/app/credit-center/review`, `/app/readiness`, `/app/cards`, `/app/application-rounds`, `/app/goals`, `/app/services`, `/app/services/active`, `/app/services/history`, `/app/documents`, `/app/notifications`, `/app/support`, `/app/account`, `/app/account/security`.
- Consultant CRM: `/crm`, `/crm/work-queue`, `/crm/clients`, a real `/crm/clients/:clientId`, `/crm/reviews`, a real `/crm/reviews/:clientId/:reviewId`, `/crm/readiness`, `/crm/support`, `/crm/sessions`, `/crm/calendar`, `/crm/account`, `/crm/account/security`.
- Admin: `/admin`, `/admin/services`, a real `/admin/services/:serviceProductId`, `/admin/payments`, a real `/admin/payments/:paymentId`, `/admin/integrations/paypal`, `/admin/integrations/stripe`, `/admin/integrations/bofa`, `/admin/account`, `/admin/account/security`.

## Regression protection

- `VisualMaturity.test.tsx` proves Home no longer owns timeline/history content and the Consultant Review queue produces the canonical CRM detail URL.
- Existing shell, document, support, notifications, work-queue, commerce, authorization, and route tests remain the accumulated regression boundary.

## Verification

- Browser-first audit: **PASS**
- Responsive overflow checks: **PASS**
- Focused visual-maturity regression: **PASS**
- Web typecheck: **PASS**
- Web production build: **PASS** (existing chunk-size advisory only)
- Complete accumulated suite: **PASS** — Web 78/78, runtime 3/3, API 136/136, worker 11/11. The realtime revocation test was also rerun serially (3/3) after one resource-contention timeout in the combined local gate.
- Lint / root typecheck / root build: **PASS** (existing Vite chunk-size advisory only)
- Final CI: **PENDING FINAL RUN**

Two existing web tests exceeded the five-second timeout during the first concurrent full-web run (`DocumentsPage` and `SupportPages`); both passed in the focused serial run and the subsequent complete Web run. The local CI-equivalent seed command encountered a host `ENOMEM` while the live review environment and browser audit were retained; migration, test, lint, typecheck, and build gates completed against an isolated Credit-only database. GitHub CI remains the clean-host final authority.

## Manual review handoff

- Web: `http://localhost:5184`
- API health: `http://localhost:3007/api/health/live`
- Client: `client@credit.local` / `DemoAccess2026!`
- Consultant: `consultant@credit.local` / `DemoAccess2026!`
- Admin: `admin@credit.local` / `DemoAccess2026!`
- Staff MFA: the final handoff resets temporary staff MFA so each staff account presents QR-based enrollment after password sign-in.

No merge into `ai-enabled` was performed. Phase 6 was not started.
