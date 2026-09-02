# Sprint 9.3 — Client Plan Execution & Structured Outcomes

## Boundary

- Starting SHA: `22c99826a86257e9c64007f030d1ef7506648563`
- Implementation/report SHA: recorded by this sprint boundary commit.

## Delivered contract

- Added PORTAL-08 client Plan execution with available, locked, awaiting-verification, unable, and completed semantics plus business-language prerequisite reasons.
- Added duplicate-safe typed outcome commands. ACKNOWLEDGEMENT, STRUCTURED_OUTCOME, CLIENT_REPORT_CONSULTANT_VERIFY, CONSULTANT_VERIFY, and SYSTEM_VERIFY retain distinct authority rules.
- Structured client outcomes atomically create the Plan outcome, update the owning canonical `ClientUpdate`, transition Plan state, record audit/outbox invalidation, and unlock eligible dependents.
- Unable-to-complete records governed state and one meaningful Work Queue Attention projection without falsely completing the item.
- Client attempts to complete consultant/system milestones fail closed. Consultant verification uses capability, client scope, and MFA step-up.
- Realtime invalidation covers Plan, Home, Journey, Credit Center, CRM Builder, and Work Queue consumers.
- Client projection positively excludes hidden paths and consultant-only fields; execution is limited to the authenticated client's active Plan.

## High-risk proof

- Locked dependent action cannot execute.
- Duplicate acknowledgement/outcome retries create one outcome/effect set.
- Structured outcome creates one canonical `ClientUpdate`.
- Completion deterministically unlocks dependents independent of UI order.
- Client cannot self-complete an authoritative milestone; consultant verification succeeds.
- Unable state remains incomplete and creates one Attention projection.
- Focused execution suite: 1 file / 3 tests passed.
- Workspace typecheck passed.

## Immediate CI

This boundary is pushed immediately and its exact-head GitHub Actions result is recorded before Sprint 9.4 begins.

## Scope confirmation

Broad reconciliation/Nurture lifecycle and Phase 10 card/catalog behavior were not implemented.
