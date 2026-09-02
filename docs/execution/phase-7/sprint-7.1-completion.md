# Sprint 7.1 completion

- Starting boundary: `0d9b1a35923e628653a0b0c03eac312515e6f940`
- Implementation boundary: `9d77a57d50dec386fda8eb2d12708eddf776dc19`
- Branch: `rapid/phase6-8-review-golden-path`

## Delivered outcome

Added a provider-neutral, Level-1 factual AI runtime with immutable process versions, durable job/output/artifact schema, logical model profiles, source-version provenance, explicit status/retry/stale semantics, deterministic test adapter, and an isolated BullMQ queue contract. No production vendor was selected or hard-coded. Provider-disabled operation fails closed.

The runtime validates structured output before consumption, deduplicates successful output by governed job/source/process identity, supports recoverable requeue, detects stale source context, and denies cross-client reads. It cannot represent authority above `FACTUAL_LEVEL_1`.

## Schema and migration

- Forward migration: `20260902054423_ai_runtime_process_registry`
- New canonical entities: `AIProcessDefinition`, `AIJob`, `AIJobOutput`, `CreditReportArtifact`.
- Migration applied successfully to `credit_strategy_phase6_8_block`; historical migrations were preserved.

## Verification

- AI runtime focused suite: 3 passed.
- Worker AI queue contract: 1 passed.
- API and worker typecheck: passed.
- API and worker production builds: passed.
- Focused lint: passed.
- Immediate branch CI: first run exposed unrelated Prisma drift statements in the generated migration; the migration was bounded to Phase 7.1 objects and successfully deployed twice (apply + idempotent no-op). Corrected CI passed on `457c8e527896b631261fd776510c178c76002b75` ([run 33596484988](https://github.com/ThatPal/CreditConsultingMVP/actions/runs/33596484988)) before Sprint 7.2 began.

## Deviations and limitations

The production provider binding remains intentionally unconfigured because the canonical package does not approve a vendor. The deterministic adapter provides repeatable test execution. The persisted queue execution adapter will be expanded only when a configured provider is approved; durable schema plus BullMQ reconstruction contract are present now. Raw provider payloads are not logged or persisted.

Sprint 7.2 report validation/extraction was not included in this boundary.

## C1 — Durable runtime correction

- C1 starting head: `831644d8066aa43711a4cda42ac822a62af19c62`
- C1 implementation boundary: `43a635d3f4fbfb9fa7e03d6558664794289d8e97`

The production runtime is now `DurableAIRuntime`, backed by `AIProcessDefinition`, `AIJob`, `AIJobOutput`, and `CreditReportArtifact` through Prisma/PostgreSQL. The prior Map-backed implementation was renamed `InMemoryAIRuntime` and is explicitly retained only as a unit-test double.

Job intent is committed before BullMQ publication. Workers receive only a durable job ID, reload the immutable process version/input/source provenance from PostgreSQL, atomically claim eligible jobs, validate provider output, and transactionally persist one canonical output, report artifact, and terminal state. Queue publication failure or Redis loss leaves discoverable PostgreSQL intent.

Recovery rediscoveries cover queued/retryable jobs and abandoned RUNNING jobs without outputs. Duplicate deliveries and concurrent workers converge on one output/artifact. Provider-unavailable, transient, non-retryable, schema-invalid, and stale states are durable. Current-artifact consumption rejects stale or cross-client data.

C1 focused proof: 8 PostgreSQL/BullMQ integration cases passed, covering real queue delivery, fresh-instance reads, restart, Redis loss, crash-before-commit, concurrency, failure states, stale provenance, cross-client denial, and the full five-process Phase 7 chain.

C1 exact correction/report-head CI passed on `07568254f90b3908e00f1e894ad082162cde6b30` ([run 33650205892](https://github.com/ThatPal/CreditConsultingMVP/actions/runs/33650205892)).
