# Sprint 17.1B — CRM Dashboard, Clients & Client 360 Completion

Status: **COMPLETE**

- Starting/report parent SHA: `e84fd5803290e4379a92c3a63ca8384b9d5a97bf`
- Implementation SHA: `1ec25cc74f6057b3f70cb03553c0f0d904dda91d`
- Report boundary: the commit containing this file

## Delivered contracts

- CRM-01 now consumes the canonical Consultant dashboard projection, shows current Work Queue, due-today, authorized-client, Review and Readiness counts, refreshes safely, and states that Work Queue remains the action source.
- CRM-03 directory supports URL-stable search, status, sort and pagination with deterministic final ID ordering, current assignment/grant context and active-item counts.
- Client 360 adds owning-module links plus a bounded, immutable canonical timeline projection composed from `AuditEvent` history. The projection excludes event metadata and links only to authorized CRM destinations.
- Existing Journey, Credit Center, Cards, Services and Support composition remains canonical and participates in shared refetch invalidation.
- Direct timeline and Client 360 access remain both capability- and client-scope protected.

## Verification

- Client-context API suite: 1 file / 6 tests passed, including deterministic pagination, expired/revoked grant exclusion, canonical capability denial, timeline redaction and cross-client denial.
- CRM UI suites: 2 files / 3 tests passed, including volume controls, canonical counts, Client 360 timeline/deep links and Dashboard-vs-Work-Queue presentation.
- Affected API/web typechecks passed; repository lint passed.

## Schema and deviations

- No schema or migration change; the unified timeline reads append-only canonical audit history.
- No professional Review, Plan, Strategy, Live or Major decision behavior changed.
- Browser evidence is deferred to the accumulated Phase 17 review environment after all destination modules exist.
