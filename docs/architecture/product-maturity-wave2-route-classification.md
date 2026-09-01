# Product maturity wave 2 route classification

This inventory classifies every mounted authenticated product route as of PM-2. “Safe foundation” means the surface is intentionally bounded, contains no fabricated operational facts, and names its future owner where relevant.

| Route | Audience | Classification | Evidence / future owner |
| --- | --- | --- | --- |
| `/app` | Client | SAFE FOUNDATION | Honest launch surface linking only to real Credit Center, Documents, and Support capabilities; PORTAL-01 owns future dashboard intelligence. |
| `/app/journey` | Client | SAFE FOUNDATION | Explicit future-phase journey foundation; PORTAL-10 owns future orchestration. |
| `/app/credit-center` | Client | ACCEPTED REAL | API-backed credit profile. |
| `/app/credit-center/review` | Client | ACCEPTED REAL | API-backed client review. |
| `/app/readiness` | Client | ACCEPTED REAL | API-backed readiness workflow. |
| `/app/cards` | Client | ACCEPTED REAL | API-backed card workspace. |
| `/app/application-rounds` | Client | ACCEPTED REAL | API-backed application cycles. |
| `/app/goals` | Client | ACCEPTED REAL | API-backed goals. |
| `/app/services` | Client | ACCEPTED REAL | API-backed service requests. |
| `/app/documents` | Client | ACCEPTED REAL | Governed document upload, download, replacement, and deletion. |
| `/app/notifications` | Client | ACCEPTED REAL | Bounded, cursor-paginated retained notification history. |
| `/app/support` | Client | ACCEPTED REAL | API-backed support cases, replies, and attachments. |
| `/app/account` | Client | ACCEPTED REAL | Persisted account profile. |
| `/app/account/security` | Client | ACCEPTED REAL | Governed session inventory and revocation. |
| `/app/*` | Client | SAFE FOUNDATION | Honest not-found state; no fabricated fallback content. |
| `/crm` | Consultant | SAFE FOUNDATION | Honest consultant launch surface; CRM-01 owns future dashboard intelligence. |
| `/crm/work-queue` | Consultant | ACCEPTED REAL | API-backed attention projection and claim workflow. |
| `/crm/clients` | Consultant | SAFE FOUNDATION | Honest future-owned client directory; CRM-10 owns implementation. |
| `/crm/reviews` | Consultant | ACCEPTED REAL | API-backed review list. |
| `/crm/reviews/:clientId/:reviewId` | Consultant | ACCEPTED REAL | Authorized review workspace. |
| `/crm/readiness` | Consultant | ACCEPTED REAL | Authorized readiness workflow. |
| `/crm/support` | Consultant | ACCEPTED REAL | Authorized support queue and case workspace. |
| `/crm/sessions` | Consultant | SAFE FOUNDATION | Explicit future-phase session surface; CRM-40 owns implementation. |
| `/crm/calendar` | Consultant | SAFE FOUNDATION | Explicit future-phase calendar surface; CRM-50 owns implementation. |
| `/crm/account` | Consultant | ACCEPTED REAL | Persisted staff account profile. |
| `/crm/account/security` | Consultant | ACCEPTED REAL | Governed staff sessions and MFA boundary. |
| `/crm/*` | Consultant | SAFE FOUNDATION | Honest not-found state. |
| `/admin` | Administrator | SAFE FOUNDATION | Honest administrative foundation; ADMIN-01 owns future operational dashboard. |
| `/admin/account` | Administrator | ACCEPTED REAL | Persisted staff account profile. |
| `/admin/account/security` | Administrator | ACCEPTED REAL | Governed staff sessions and MFA boundary. |
| `/admin/*` | Administrator | SAFE FOUNDATION | Honest not-found state. |

Development-only `/dev/*` evidence routes remain gated by the development build and are not product routes.
