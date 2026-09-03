# Sprint 15.3 Completion

- Starting boundary: `cf77b6d`
- Branch: `rapid/phase13-16-live-major-support`

## Restriction matrix

| Scope | Server command boundaries |
|---|---|
| CYCLE | Start/resume Cycle; create Round |
| STRATEGY | Create/prepare Strategy draft; approve Strategy |
| SCHEDULING | Book/reschedule appointment |
| LIVE_EXECUTION | Start Application Session; release card application |

`CoordinationDecision` is immutable/versioned and requires a current consultant-approved recommendation. The consequential decision transaction supersedes the prior decision, clears its restrictions, writes the new decision and four scoped restrictions, audit, outbox, timeline, and case pointer atomically. Idempotency and a case advisory lock make retry/concurrent attempts converge. Client projection contains only approved client-safe explanation and effective restriction scopes; internal rationale and AI metadata remain private. Admin role alone has no route authority.

Restriction release is governed, audited, realtime-propagated, and marks old draft/approved Strategies stale; it never restores validity. Focused tests cover all four fail-closed scopes and cleared-state behavior. Immediate exact-boundary CI is recorded in the Phase 15 gate report.

Exact implementation SHA is the commit containing this report.
