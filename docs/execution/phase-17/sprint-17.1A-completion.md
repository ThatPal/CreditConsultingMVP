# Sprint 17.1A — Admin Dashboard & Operational Composition

Status: **COMPLETE**

- Starting SHA: `becce2d268263c6c196cc524cb62526f0c65aec1`
- Implementation SHA: `4e35c6a701373b0f6775c32de5e1dd0723442c46`
- Report boundary: the commit containing this file

## Delivered contracts

- `GET /api/v1/admin/dashboard` is an Admin-only, read-only composition query over canonical payment, dispute, AI-job, catalog-candidate, integration, security-event, service-product and outbox records.
- Each module settles independently. A failed module returns a bounded `degraded` section without leaking errors or blanking healthy sections.
- Scheduled jobs are represented honestly as unavailable until Sprint 17.3G owns that operational contract.
- ADMIN-01 now renders responsive operational metrics, partial-degradation states, loading/error treatment and deep links to owning modules. It refreshes every 30 seconds and participates in the existing global realtime invalidation flow.
- Viewing the dashboard performs no mutation and creates no WorkItem, Attention, notification or shadow operational state.

## Authority and security

- Direct API access is restricted to `ADMIN`; Consultant access is denied.
- The dashboard grants no Consultant professional authority and contains no configuration or action-copy controls.
- Provider/module errors and secrets are not returned in the projection.

## Verification

- API: `adminDashboard.test.ts` — 3/3 passed, including composition, partial degradation and Consultant denial.
- Web: `ShellPages.test.tsx` — 1/1 passed, including rendered metrics, degraded state and owning deep link.
- Affected API and web TypeScript checks passed.
- Repository lint passed.

## Schema, deviations and follow-up

- No schema or migration change.
- No material deviation. Scheduled-job metrics deliberately remain unavailable until their authoritative 17.3G implementation.
- Browser evidence is accumulated at the Phase 17 end-of-run gate after all Admin destinations exist.
