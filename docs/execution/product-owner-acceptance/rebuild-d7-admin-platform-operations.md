# POAR Rebuild D7 — Admin Platform Operations

Status: **COMPLETE — pending exact-head CI at report commit**  
Branch: `rebuild/authenticated-product-poar`  
Accepted start: `807a5165e860d59c9675d9a9e039c373d405f8f7`  
Implementation boundary: `f6197eb`

## Scope and audit disposition

D7 was executed as an independent audit followed by one consolidated correction wave. D0–D6 behavior and authority boundaries were preserved. No D8, Phase 18, public-site, deployment, or `ai-enabled` work was performed.

| Surface | Audit result and completed disposition |
| --- | --- |
| AI jobs and processes | Durable jobs and process versions are now bounded, keyboard-navigable operational histories. Retry/cancel previews state present state, requested state, scope, worker timing, reversibility, and audit evidence. AI output remains advisory and unapproved. |
| Source Registry | Reviewed sources use a bounded registry and version-safe governed enable/disable preview. HTTPS/allowlist and immutable provenance language remains explicit; no credentials are rendered. |
| Workflow Rules | Typed rule versions use a bounded historical collection. Draft creation remains disabled-by-default and does not claim execution controls the API does not provide. |
| Notification Operations | Template versions and provider delivery history are separate bounded collections with outcome filtering and load-more history. Safe provider/failure categories are retained without credential-bearing samples. |
| Non-payment Integrations | Integrations use a bounded registry. Governed previews distinguish configured/effective state from queued or running work and preserve the Commerce payment boundary. |
| Scheduled Jobs | Canonical scheduler definitions and recent durable runs use a bounded operations collection. Manual enqueue previews worker claim timing, scope, retry history, and audit evidence. |
| Retention / Governance | Policy coverage is bounded and execution previews state recalculation timing, allowlisted scope, exclusions, irreversibility, and retained audit evidence. The UI does not promise that preview equals final deletion count. |
| Operational Reports | Existing factual aggregate cards, source/as-of language, safe readable records, bounded sections, and no raw JSON were revalidated. No fabricated trends or export were added. |
| Settings / Kill Switches | Typed effective capability controls use a bounded configuration workspace. Change previews distinguish new work from queued/running work and preserve immutable version history. |
| System Health | Rebuilt around the Observability Cockpit archetype with factual current snapshot, freshness, durable backlog, dependency grid, and owning remediation links. Health projection defects were corrected server-side. |

## Independent findings

| Finding | Severity | Disposition |
| --- | --- | --- |
| `CPOAR-D7-001` — High-volume D7 collections still relied on stacked cards and unbounded page flow. | P1 | **Closed.** AI jobs/processes, sources, workflow versions, templates/deliveries, integrations, scheduler definitions, retention policies, and settings now use explicit bounded/history collection contracts with sticky controls/footer where applicable and arrow-key row navigation. |
| `CPOAR-D7-002` — Consequential D7 controls did not satisfy the D6 mature change-preview contract. | P1 | **Closed.** AI recovery, sources, integrations, scheduled runs, retention, and kill switches now show current/proposed state, exact scope, effective timing, reversibility, and audit effects. |
| `CPOAR-D7-003` — System Health reported `healthy` while canonical failed-outbox count was non-zero. | P0 | **Closed.** Dashboard health now derives degraded state and a safe reason from factual exception counts for platform, AI, commerce, catalog, integrations, security, and scheduler modules. |
| `CPOAR-D7-004` — System Health stated scheduled-job operations were unavailable even when canonical definitions existed. | P1 | **Closed.** The Admin dashboard now reads enabled definitions plus queued/running and failed runs and links to the owning scheduler surface. |
| `CPOAR-D7-005` — Several configuration APIs support only disabled draft/version creation, not direct activation. | P2 | **Truthful deferral.** D7 keeps the UI explicit about disabled drafts and does not invent unsupported activation or retroactive in-flight behavior. |

No additional P0 exposure was found after the correction wave.

## Interaction, content, and authority proof

- Every governed D7 action names current state, proposed state, exact affected module/record, future versus in-flight timing, reversibility, and audit consequence.
- Collections preserve scroll state, bound desktop height, become natural-flow on narrow screens, and expose focusable rows with Arrow Up/Down navigation.
- States are stated as configured/effective, queued/running, failed/degraded, disabled, or historical from canonical fields. No future configuration is described as retroactively mutating claimed work.
- AI remains draft/advisory; source and integration secrets are represented only by safe presence/count metadata; reports and health use only current stored aggregates.
- Payment gateways remain under Commerce → Payments and are not duplicated in non-payment integrations.

## Populated browser proof

Admin browser review on `http://localhost:5185` used the deterministic Credit-only review environment and authenticated Admin session.

- `/admin/ai/jobs`: 36 populated durable jobs; process, attempt, status, and inspect path verified.
- `/admin/sources`: populated official allowlisted source with 16 candidates; governed state control verified.
- `/admin/notification-operations`: populated template versions and provider delivery history verified.
- `/admin/scheduled-jobs`: three canonical definitions and truthful disabled/manual-run behavior verified.
- `/admin/settings`: four typed capability controls with effective/default language verified.
- `/admin/reports`: factual 30-day aggregates for payments, refunds, disputes, AI jobs, support, and notifications; no raw JSON.
- `/admin/system-health`: current durable backlog, failed count, freshness, dependency states, and owning remediation links verified.

Representative collection rows are keyboard-focusable; collection arrow-navigation is covered by the shared D1 contract and D7 regression. Responsive behavior uses single-column natural flow below the desktop breakpoint, with bounded internal collection scrolling only on desktop.

## Verification

Completed locally:

- focused API dashboard regression: 3/3 passing;
- focused D7 web regression: 3/3 passing;
- repository typecheck: passing;
- production builds for web, API, worker, runtime, and shared packages: passing;
- populated Admin browser review: passing.

The first accumulated web run reported one unrelated timing-only timeout in the pre-existing Goal Preferences test while 120/121 tests passed; that test is outside D7 and no product failure was observed. Exact-head CI is the authoritative clean-environment gate.

An isolated local migration attempt was blocked before execution because the shared Windows Prisma engine binary resolved through an older worktree and Windows returned `spawn UNKNOWN`; no schema or product migration failed and D7 adds no schema changes. Fresh migration and double-seed verification remains required in exact-head Linux CI and is not represented here as locally passed.

## Boundaries and deviations

- No secrets, tokens, cookies, raw credentials, provider payloads, fabricated time series, forecasts, or unsupported provider capabilities were added.
- No schema migration or demo-seed change was required: the canonical review database already contains deterministic populated D7 scenarios and the system seed contains scheduled definitions.
- Direct activation/edit controls were not invented where the canonical API exposes disabled version creation only.
- `main`, `baseline/current-non-ai`, `ai-enabled`, and all earlier accepted rebuild boundaries remain untouched.

Final acceptance is contingent on synchronized branch head and successful exact-head CI recorded in the handoff.
