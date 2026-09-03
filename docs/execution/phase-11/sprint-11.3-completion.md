# Sprint 11.3 — Pre-Strategy Major Application Check

## Boundary

- Starting/report SHA from Sprint 11.2: `54bdbd0`
- Implementation SHA: `ad4223d187e85ad0c186b39749fb0cbd8b283e1c`
- Report boundary: the commit containing this report

## Delivered contract

- Added immutable/versioned `RoundMajorApplicationCheck` submissions for No, Mortgage, Auto, Student, Other Major Financing, and Not Sure.
- Yes/Not Sure requires an approximate timing window and accepts only concise optional context; the UI explicitly warns against lender credentials, account numbers, or full application data.
- Each accepted command is idempotent by client/Round/key/request hash and atomically records the version, audit, and outbox event.
- A PostgreSQL transaction-scoped advisory lock serializes version assignment and consultant-work reconciliation for the same Round.
- Yes/Not Sure creates one deduped `MAJOR_READINESS` Attention/WorkItem only when no active canonical context exists. Existing context is referenced/prefilled rather than duplicated.
- No satisfies only the major-check gate. Yes/Not Sure records coordination-needed context; neither creates a `CoordinationDecision`, restriction, recommendation, or professional safe-to-proceed assertion.
- PORTAL-26 is functional at `/app/rounds/:roundId/major-check`, with progressive timing/context fields, prior-submission state, validation, safe-language explanation, and return to PORTAL-25.
- PORTAL-25 refetches immediately through canonical query invalidation/realtime topic updates.

## Focused proof

- No produced a completed check without consultant decision/work.
- Mortgage and Not Sure created versioned history; exact-key replay created no duplicate version.
- Proof counts after three distinct accepted submissions: 3 check versions, 3 audits, 3 outbox events, exactly 1 active coordination WorkItem.
- Expected major-context creation no longer falsely marks the captured non-major Round sources stale.
- Cross-client Round read/submission ownership remains fail closed.
- API focused suite: 4/4 passed. Web PORTAL suite: 3/3 passed. API/web typecheck passed.

## Deviations and exclusions

- No Phase 12 `RoundStrategy`, candidate, sequence, approval, or publication record exists.
- No Phase 15 professional coordination decision, recommendation, restriction, or override authority was introduced.
- Major Readiness purchase is offered through existing product/navigation ownership; this sprint does not force a purchase.
