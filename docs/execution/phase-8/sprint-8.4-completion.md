# Sprint 8.4 completion

- Start boundary: `c9654264ddd63a12d1d49d8f70543b8fb0a7402a`
- Implementation: `4e76496d07def3cead371d3e5e1edaf19fe70740`

Completed the published-review experience from the immutable `PublishedCreditReview` source. The client Credit Center now has distinct overview, profile, secure report, approved analysis/recommendation, and deterministic history routes. Unpublished reviews never enter this read model; when no publication exists the UI shows an honest empty state and never substitutes illustrative scores.

The CRM-06 projection at `/crm/clients/:clientId/credit-center` uses the same client-safe read model and enforces canonical `client.read` plus client scope. The canonical MFA-protected publication command is exposed at `POST /api/v1/reviews/consultant/:clientId/:reviewId/publish`. Report access continues through the authenticated document endpoint. The source projection positively selects supported credit-profile fields and excludes internal notes, AI provider/model/confidence/provenance, raw evidence and approval mechanics.

Focused proof passed: 7 API analysis/publication/read-model tests and all 82 web tests. API/web typecheck, affected builds, repository lint and diff validation passed. The idempotent demo seed now provides a published review plus a separate active unpublished review to prove the privacy boundary; it succeeded twice against the persistent Credit-only build-block database.

Manual review:

- Client: `http://localhost:5184/app/credit-center`
- Client profile/report/analysis/history: append `/profile`, `/report`, `/analysis`, or `/history`
- Consultant projection: `http://localhost:5184/crm/clients/0b9fa844-101d-46d2-b390-492f4699b0e1/credit-center`
- Credentials: `client@credit.local`, `consultant@credit.local`, or `admin@credit.local` with temporary development password `DemoAccess2026!`

Final accumulated Phase 8 gate and exact-final-head CI are recorded in the Phase 8 end-of-run report.
