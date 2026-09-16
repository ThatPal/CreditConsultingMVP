# U1 compatibility reads

`service.ts` composes existing client-scoped sources into a shared read projection. It creates no state or command authority. Callers enforce authentication and client/consultant access before calling it. `projection.ts` explicitly selects public fields rather than spreading internal domain rows.

- PublishedCreditReview + CreditProfileState → Profile currentness and source basis. U3 removes this adapter in favor of final Profile/Analysis/Recommendation reads. Expiration never edits publication content. Preserve boundary, missing-basis and immutable-history tests.
- PlanVersion/PlanItem → Action summary and next available client step. U4 replaces with global CreditPlan/PlanItem. Guidance/Milestones never increase Action progress; submission is not verification. Preserve private draft exclusion and dirty-response/live-update tests.
- NurturePeriod and ApplicationCycleStage → legacy fallback context only. U4/U6 remove these inputs; do not extend their lifecycle. CreditCardRound is queried directly by client scope. Final Live/Major precedence remains outstanding.

`generatedAt` describes read time; source IDs/version numbers/state timestamps identify basis. Parallel reads and independent surface requests are not a globally atomic snapshot. Commands continue to revalidate source versions, actor scope and eligibility. The optional supplied Plan/publication inputs are internal reuse of the same caller-selected basis, never request-body input.

Evidence: workspace/projection tests, Plan service integration, Review publication integration, Plan page/response/live-update tests and BATCH-U1-02. No final DTO or U1 acceptance claim.
