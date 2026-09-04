# Sprint 16.2 — AI-Assisted Support

Status: COMPLETE

## Delivered

- Registered `support.classify`, `support.summarize` and `support.draft_reply` as governed definitions in the canonical durable AI runtime.
- Support AI requests create durable PostgreSQL-backed AIJob/AIJobOutput records and are processed by the existing BullMQ worker/recovery path.
- Successful outputs materialize immutable SupportAIArtifact proposals with job/output IDs, provider/model provenance, prompt version and source message count.
- Classification, summary and reply-draft schemas require `ADVISORY_ONLY` and `requiresHumanReview: true`.
- Regeneration creates a new proposal; only untouched proposals are superseded. Edited, accepted and sent artifacts are not overwritten.
- Provider unavailable behavior returns an explicit manual-fallback state. No autonomous Support allowlist or autonomous send path exists.
- AI artifacts remain staff-only through consultant `support.manage` routes. Client Support projections do not include them.
- AI requests and staff edit/accept decisions are audited.

## Authority proof

The provider can classify, summarize and draft. It cannot update Support status/assignment, send a SupportMessage, or mutate Review, Profile, Strategy, Round, Major/Coordination, commerce, entitlement or security records. Sending remains an explicit human-authored Support command.

## Verification

- Prisma client generation: PASS (Credit-only database configuration).
- API typecheck: PASS after the final implementation pass.
- Focused structured-output, leakage and autonomous-authority rejection tests added in `supportAI.test.ts`.
- Exact focused/accumulated execution is included in the Phase 16 final CI gate.
