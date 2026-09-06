# APC Wave 5 — Admin Product Completion

Status: **COMPLETE — READY FOR PRODUCT-OWNER REVIEW**  
Branch: `rapid/phase17-18-operations-public`  
Accepted base: `e59cfcb332fd3597d42bfab1a7882116f40b4ab2`  
Primary implementation boundary: `446e806`  
Browser-discovered correction boundary: `237280b`

## Outcome

Wave 5 completes the authenticated Admin operating experience without expanding Admin into consultant professional authority. Identity, access, immutable audit/security history, commerce, catalog inspection, AI operations, sources, workflows, notifications, integrations, jobs, retention, reporting, settings and system health now use the shared Wave 2 context, recovery, vocabulary, collection and governed-action patterns.

Operational Reports render understandable aggregate cards and tables instead of raw JSON. Sensitive metadata uses a recursively safe record renderer. Consequential actions consistently disclose impact and require confirmation; reason-bearing actions collect a reason. The Admin catalog remains inspectable, while professional CardInsight approval remains consultant-only.

## Independent findings and disposition

| Finding | Severity | Evidence | Disposition |
| --- | --- | --- | --- |
| CAPC-W5-001 | P1 | Operational Reports exposed implementation-shaped JSON instead of an operator-readable report. | Closed: period controls, metric summaries and readable grouped tables replace the raw view. |
| CAPC-W5-002 | P1 | Re-running the deterministic demo seed disabled staff MFA, invalidating authenticated review sessions. | Closed: staff MFA is preserved by default and changes only when `RESET_REVIEW_STAFF_MFA=true` is explicitly supplied. |
| CAPC-W5-003 | P2 | Audit metadata and AI source-version details used raw/debug presentation. | Closed: shared secret-filtering, human-readable record rendering is used. |
| CAPC-W5-004 | P2 | Multiple consequential Admin actions used browser-native confirmation or immediate mutation. | Closed: shared governed-action dialogs now cover role, MFA, sessions, grants, payments, gateways, sources, jobs, retention and settings. |
| CAPC-W5-005 | P2 | Notification delivery operations lacked bounded outcome filtering and continuation. | Closed: outcome filter plus cursor-based “load older” behavior added. |
| CAPC-W5-006 | P2 | System Health presented only durable outbox counts despite safe domain health summaries already being available. | Closed: commerce, AI, catalog, integrations, jobs, security, products and outbox signals link to owning modules. |
| CAPC-W5-007 | P1 | Admin could review/revoke scoped grants but could not create a governed time-bounded grant. | Closed: bounded staff/client selectors and typed scope, capability, duration and purpose inputs added. |
| CAPC-W5-008 | P2 | Admin audit history linked client records into the consultant-only CRM surface. | Closed: the invalid cross-authority navigation was removed. |
| CAPC-W5-009 | P1 | Live browser review showed Admin Card Catalog and Card Insights rendering only authorization recovery because platform routes invoked client-scoped authorization without a client ID. | Closed in `237280b`: all platform catalog operations now use canonical platform capability checks; denial still fails closed and professional approval remains consultant-only. |

No additional P0 finding was discovered.

## Product and authority boundaries

- Admin inspection and platform governance do not grant consultant professional approval authority.
- Audit and security histories remain immutable; metadata is filtered before display.
- Payment actions retain original-provider routing and idempotency behavior.
- Settings, kill switches and other governed mutations retain step-up and audit enforcement.
- Source operations retain URL/SSRF controls; integrations never render stored secrets.
- Retention remains preview-first and protected categories remain excluded.
- AI output remains draft/advisory until the owning human-authority workflow approves it.

## Deterministic review data

The persistent review database contains realistic volume without real secrets, including 472 users, 443+ audit events, 190+ security events, 165 notification deliveries, 30 access grants, 26 AI jobs, 16 catalog candidates, 5 disabled workflow rules, payment/refund/dispute states, integrations and scheduled-job definitions. The Wave 5 catalog/workflow fixtures are deterministic and non-authoritative.

Fresh-database verification used `credit_strategy_apc_wave5_gate_20260906`. All 66 historical migrations applied cleanly. System seed ran twice and demo seed ran twice without duplication or staff-MFA reset.

## Browser proof

Authenticated Admin review was completed at `http://localhost:5185` in the actual Codex browser at a 440px narrow viewport. Verified routes include:

- Operations overview, Users & Staff, user detail/session/MFA controls and Access Grants editor/history
- Audit History and Security Events
- Payments/Gateways
- Card Catalog and Card Insights, including populated deterministic states and consultant-only approval wording
- AI Jobs and Processes, Sources and Workflow Rules
- Notification Operations, Integrations and Scheduled Jobs
- Retention, Operational Reports, Settings/Kill Switches and System Health

Governed dialogs were opened and cancelled without performing destructive actions. The shell remained usable at the narrow viewport, with the navigation drawer and page context available. Operational Reports contained no `<pre>`/raw JSON presentation. The post-fix live browser showed populated Catalog candidates and the in-review CardInsight.

## Verification

- Focused Admin UI/API tests: green
- Canonical catalog-route authorization regression: 3/3 green
- Web: 25 files / 102 tests green
- Runtime: 1 file / 3 tests green
- Shared: no test files, pass-with-no-tests green
- API: 69 files / 273 tests green
- Worker: 6 files / 16 tests green
- Typecheck: all 5 workspace projects green
- Lint: green
- Build: all 5 workspace projects green (existing Vite chunk-size advisory only)
- Migration chain: 66/66 clean on fresh Credit-only database
- Double system seed and double demo seed: green

The first narrowly invoked API command accidentally passed an extra `--` through pnpm, causing the complete API suite to start without `REDIS_URL`; its environment-required realtime cases correctly refused to run. The authoritative accumulated gate was then rerun with both the dedicated Credit `DATABASE_URL` and Credit Redis URL and passed in full as recorded above.

Exact-final-head CI is triggered only after the report commit is pushed; its run URL and result are recorded in the product-owner handoff so the tested SHA exactly matches the synchronized branch head.

## Review environment

- Web: `http://localhost:5185`
- API: `http://localhost:3008`
- Database: `credit_strategy_phase1316_checkpoint` on the Credit PostgreSQL service
- Redis: Credit Redis on port `6380`

The environment remains running for manual review. Seeded review credentials remain in the existing approved out-of-band handoff and are intentionally not duplicated in this repository report.

## Boundary

Wave 6, Phase 18/public/deployment work and merge into `ai-enabled` were not started.
