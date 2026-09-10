# Workflow and architecture plan

Keep a modular monolith with explicit domain boundaries. The accepted React/Vite/Express/PostgreSQL stack can support the intended product. The immediate architectural task is to eliminate contradictory projections, fixture-only runtime paths and UI-authored business truth—not to introduce microservices or change frameworks.

## Domain authority

| Domain | Owns | Must not own |
|---|---|---|
| Identity and access | User/session/MFA, assignment/grant/capability, current resource authorization | Professional decision or paid service eligibility |
| Client relationship | Lifetime client, business/financial relationships, Journey, goals and revisions | Copies of application outcomes or Plan completion |
| Commerce | Product/price versions, purchase/payment/refund/dispute, credits and entitlements | Credit-review findings or professional eligibility inferred from payment |
| Document and Review | Immutable uploaded source, validated report, extraction/evidence/exceptions, verified Profile and published Review | Overwriting report facts with current client updates |
| Portfolio and Catalog | Current owned cards and changes; canonical products/offers/sources/insights with independent versions | Unapproved client-specific recommendations in Explore |
| Plan | Actions/Guidance/Milestones, dependencies/conditions, completion/verification and reconciliation | Separate copies for Major, Round and Nurture |
| Round and Strategy | Season/Round state, frozen goal/context, approved selected offers/sequence/branches and source dependencies | Treating a legacy cycle-stage enum as the complete next-action authority |
| Scheduling and Live | Internal appointments, availability, presence, released card, supervised decisions, immutable application events | External calendar as the transaction authority; hidden auto-submission to issuers |
| Outcomes and Major Readiness | Structured results/reconsideration/CLI, verified totals/Analysis; Major decisions and restrictions | Generic “complete” markers in place of financial outcomes |
| Support and Operations | Scoped conversations, attention/work ownership, delivery/jobs/rules/retention diagnostics | A second business-state machine inside Work Queue or Admin UI |

## One read contract for next action

Create a domain projection such as `ClientNextAction` with `context`, `status`, `owner`, `title`, `explanation`, `action`, `blockers`, `sourceVersions`, and `computedAt`. These are proposed contract fields, not existing schema claims.

Resolve precedence explicitly: current security/access restrictions → active live safety state → Major coordination restrictions/material source changes → active Review/Plan/Strategy work → scheduling/outcomes → Nurture/next cycle. The exact business precedence is ratified with recovered rules in A1/A2. Client Home, CRM Client 360, Journey, Round and service summaries consume the same projection. Separate “record exists,” “published,” “current,” “actionable,” and “completed.”

Show a valid next owner even when the client has nothing to do. An empty Plan is not an empty relationship. Counts specify unfinished Actions, waiting verification, Guidance and Milestones separately; never count Plans as Actions.

## Workflow contracts and acceptance scenarios

| Workflow | Complete transaction path | Required failure/recovery evidence |
|---|---|---|
| W01 · Lead → client | Goal-first entry → saved intake → registration/consent → actual verification → bind intake once → client next action | Duplicate email/intake, interrupted registration, expired link, resend, cross-account token binding, mobile resume |
| W02 · Paid Review access | Eligible newer report → available credit or order → provider-verified payment → reserve access → upload/validate → submit → consume according to policy | Duplicate callbacks, cancellation, failed/late payment, invalid report/date, retry/reupload, no double reserve/consume |
| W03 · Review → published foundation | Real source → durable extraction → normalized evidence → portfolio/changes reconciliation → consultant verification → recommendation/Plan → atomic publish | OCR uncertainty, unsupported/missing bureau, worker restart, invalid AI output, source replacement, concurrent publish, client-safe exclusion |
| W04 · Plan execution | Approved current Plan → relevant item → typed factual outcome → verification/domain update → dependency reconciliation → shared next action | Unable-to-complete, invalid schema, locked deep link, concurrent edit, branching reorder, old draft/new source, approval after edit |
| W05 · Catalog → strategy evidence | Controlled source retrieval → normalize/dedupe → field/source diff → offer/insight approval → published catalog → impact detection | Changed/discontinued product, conflicting source, unavailable image/source, stale offers, wrong client scope, safe human override |
| W06 · Round strategy | Goal/Review/Plan/portfolio/history/Major/access context → AI brief/candidates → compare → shortlist → sequence/rules → validate → approve frozen version | Missing branch, duplicate product, stale context, unsupported offer, restricted activity, AI outage/manual fallback, concurrent approval |
| W07 · Schedule → supervised live | Valid strategy → current availability/external busy → collision-safe booking → reminders → join/presence → final changes check → release | DST/timezone, provider failure, booking race, reschedule/cancel, expired step-up, no consultant, material change, reconnect |
| W08 · Live progression | Released approved card → Apply/Skip/Help → structured outcome → durable application event → approved branch or intervention → next release | Duplicate result, two tabs, stale sequence, reordered events, disconnection, supervision lost, unexpected outcome, simultaneous pause/release |
| W09 · Follow-up → final Round | Pending/reconsideration/CLI → verified outcome revision → recalc totals → updated Analysis → consultant publish/finalize → shared Nurture | Result changed after publication, unresolved required work, declined reconsideration, partial CLI, retries, no double-counting of incremental credit |
| W10 · Major readiness | Intake/access → source review → approved recommendation/restrictions → shared Plan → material-change reassessment → coordinated closure | Simultaneous live activity, old guidance during new draft, missing source, restriction revoked/changed, stale client deep link |
| W11 · Support and notifications | Contextual request → scoped queue/owner → conversation/evidence → resolution → correct deep-linked notification | Cross-client request, role/grant revocation, unread/read consistency, email failure/retry, draft preservation and live-help routing |
| W12 · Admin operations | Effective configuration → typed proposed version → validation/diff/test → approved activation → actual runtime effect → audit | Stale edit, duplicate mutation, disabled provider, partial deployment, failed test, retry/dead-letter, rollback preserving history |

These scenarios define evidence work, not an instruction to run real transactions during the audit. Existing domain tests and transactional utilities are a starting point; add missing scenarios rather than duplicating trivial component assertions.

## Command and event boundaries

Consequential commands should accept validated identity/scope, expected version and a stable request id. Authorization and relevant eligibility are rechecked against current data. Within one transaction: lock/check mutable state, write canonical records and immutable history, record command result/idempotency and outbox event. Publish only after commit. Duplicate retry returns the prior committed result; it must not create new payment, entitlement, release or outcome events.

Audit where this already exists through `transactions/consequentialCommand.ts`, domain services and outbox code; preserve it. Standardize gaps incrementally. A frontend must not invent source version 1, increment a source version as a substitute for retrieval, or reconstruct business dependencies from display order.

Use typed event envelopes and shared query-key factories. Existing Redis fan-out/SSE bridge is present. Verify the full path from committed domain event to authorized browser refetch, including published Credit Center keys and revocation. Do not rely on direct in-memory publish for durable delivery guarantees. Realtime informs/refetches; server state remains authoritative.

## Runtime and adapters

| Capability | Baseline | Required production proof |
|---|---|---|
| Report processing | Synthetic marker/fixture parser is wired | Real supported PDF corpus, safe upload/scan, extraction/evidence, correction/recovery and measured accuracy |
| AI | Deterministic provider/stock strategy proposal | Selected real provider, source-grounded typed results, evals, cost/latency budget, human authority, redacted diagnostics |
| Email | Interfaces exist; production adapters absent in entrypoints | SMTP and external delivery from running worker, verification/reset/notifications, bounce/failure and retry |
| Payments | Provider/ledger machinery exists; no real provider test here | All three merchant configurations, signature validation, capture/settlement, refund/dispute, reconciliation and entitlement replay |
| Bank of America | Hosted adapter explicitly lacks status retrieval/refund methods | Confirm contracted merchant API/product and supported reconciliation/refund operating path; do not advertise operations that throw unsupported |
| Calendar | `noOpCalendarProvider` is the default in appointment services; route calls do not inject a real provider | Real busy retrieval/mirror/sync, permission scope, outage semantics, internal collision checks and explicit degraded availability behavior |
| Documents | Local private storage plus provider abstraction | Authorized content, path/size/type safety, malware handling, retention/holds, backup/restore; future S3 adapter/migration tested when introduced |
| Jobs/outbox | Durable infrastructure and worker packages exist; API also starts AI worker | Explicit process responsibilities, leases, retries/dead letters, restart/replay, queue lag, health and deploy/drain behavior |

Separate web request serving from background AI execution during production assembly unless a measured deployment design justifies co-location. A clean API restart should not accidentally redefine worker ownership. Keep interfaces narrow and make unavailable configuration explicit at startup and in Admin. Production refuses demo seed/fixture adapters.

## Frontend structure

Organize by domain feature: projection/query keys, commands/forms, state presenters, route composition. Share typed API contracts, money/date/status formatting and accessibility patterns. Keep product copy separate from internal enum labels. Retire duplicate legacy state paths only after usage and migration evidence.

Authoring surfaces need draft/server version state, debounced autosave, explicit failure/conflict recovery, and an approval operation against the exact saved version. Preview uses the real client-safe renderer. Display ordering, business dependencies and professional rationale are independent fields.

Use a small set of genuinely different page compositions. Client pages prioritize one action and context. CRM prioritizes scan density and side-by-side evidence. Admin prioritizes effective state, operational consequence and precise diagnostics. A status word should not be styled like a large currency metric.

## Migration and release safety

Preserve existing immutable source, publication, offer, Strategy, application and payment history. Add schema changes with explicit forward migration and backfill/reconciliation. Never “repair” old data by silently overwriting professional decisions. Run schema changes against an isolated representative dataset; snapshot/restore first for destructive transformations, then verify counts, monetary totals, source references and permissions.

Release candidate must prove: fresh install and upgrade; end-to-end workflows; provider configuration and real sandbox/certified test evidence; performance/accessibility/security review; backup restore and rollback; monitoring/alerts and operational runbooks; approved business content and agreements. This audit does not certify legal compliance or security absence of defects.
