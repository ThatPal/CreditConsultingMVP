# A5 implementation pass 3: typed responses and consultant verification

Continued on 10 September 2026 after the user's instruction to continue. Work remains isolated on `codex/astra-production`. This is another functional Plan slice; A5 and production qualification remain open.

## Delivered

- The client Plan renders defined text, numeric, whole-number, Yes/No, and choice questions. Required fields, numeric bounds, and text limits are enforced by the server. Zero and false are valid answers. Arbitrary extra fields, unsupported constraints, and malformed schema definitions are rejected.
- Consultants can author questions, labels, descriptions, answer types, required answers, choices, and numeric bounds in the Plan editor. This produces a bounded object-schema dialect rather than a generic free-text `clientReport` payload for every structured step. Completed/in-progress/awaiting-verification work retains its protected response contract.
- Publication requires a valid response schema for structured outcomes. Existing client-report/consultant-verification steps without a schema retain a required written report. Invalid legacy structured forms show a configuration message and keep help requests available; they are not silently treated as valid generic forms.
- Submission errors retain the client's answers. Retrying the same payload reuses its idempotency key, preventing duplicate outcomes after an uncertain response. Help requests require a specific explanation. Removed the duplicate Content-Type override that prevented the old client form from reaching Express's JSON parser correctly.
- Each step exposes its most recent 20 response/decision events, with dates and readable values. History includes the same stable step's earlier published versions; private drafts and consultant rationale are excluded. Truncation is labeled. The full underlying records are retained.
- The consultant workspace shows pending work from the published Plan, displays submitted evidence, and allows verification or a correction request. Review submits the exact latest evidence ID and rejects stale evidence. A client-report step cannot be verified before the client submits it.
- Correction requests require a client-visible message, preserve the original submission, and return the step to `IN_PROGRESS`. The client sees the requested correction above prefilled answers and can resubmit. This preserves the progress-protection contract while enabling corrections.
- Verification writes a durable history event, completes the step, resolves its Attention work, and unlocks eligible dependent steps. Corrected/resubmitted evidence and verification remain separate events. Client and consultant query roots refresh after decisions; the published execution query also participates in Plan realtime invalidation.
- The client owner label now points to the consultant while verification or help is pending.

## Verification

- API and web production builds pass; targeted ESLint and whitespace checks pass.
- 29 API tests pass across the five Plan suites. Coverage includes malformed schemas, extra/missing/wrong-type answers, zero/false, concurrent duplicate submission, correction/resubmission, stale evidence rejection, dependent-step unlocking, history continuity, earlier revision protection, and source checks.
- 15 web tests pass across five focused suites, including typed response serialization, idempotent retry, retained answers on failure, configuration/help state, correction-message requirements, evidence-bound review requests, builder continuity, and realtime roots.
- Real browser/API review used the existing isolated `Astra QA Plan review` fixture and a separately created synthetic client identity. The original Jordan demo Plan was not changed. Exercised submission of numeric zero and boolean No, waiting state, consultant correction, client prefill and correction message, resubmission with Yes, consultant evidence review and verification, and the active-work count returning to zero.
- The mobile response and review surfaces were inspected at the existing 440px browser size (425px content viewport), with no horizontal page overflow. This is not a complete accessibility, device, or screen-reader qualification.
- No database migration was needed. Existing PlanItemOutcome records now also store verification and correction events using their existing kind/data fields. No external email, payment, deployment, push, or merge occurred.
- Existing web bundle-size and pg concurrency-deprecation warnings remain.

## Important limits and next work

1. Add private document attachments with ownership checks, download evidence, and correction/replacement handling. This pass collects scalar answers; it does not claim attachments or real report extraction are complete.
2. Finish outcome history pagination/export and immutable field-label snapshots. The current recent-history view maps historical field keys to the current stable response contract. Benchmark the per-step history queries before production scale.
3. Complete richer response-schema features only with matching validation and rendering. Nested objects/arrays, arbitrary JSON Schema constraints, and automatic verification are not supported by this bounded dialect. Legacy forms must be reviewed and configured before republication.
4. Extend the full client preview to render response controls, and prove new-question authoring/save/publication in a browser alongside the validated client execution flow. Current browser coverage inspected the persisted question definitions and exercised execution; it did not exhaust every authoring option.
5. Finish help-request resolution/reopening, full path lifecycle, every completed/cancelled/stale transition, and review across multiple concurrently active Plan purposes. The current execution workbench follows the same selected published Plan as the client view.
6. Add durable drafts/navigation recovery and prove worker/SSE propagation with independent simultaneous sessions. Browser verification here switched roles sequentially; it is not proof of complete two-session realtime delivery.
7. Continue the wider A1/A2 contracts and A3 onward from ROADMAP.md. This pass does not replace the remaining provider, AI, report, email, payment, scheduling/live, Admin, security, and operational work.
