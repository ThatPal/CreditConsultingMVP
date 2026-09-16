# U1 compatibility reads

`service.ts` composes existing client-scoped sources into a shared read projection. It creates no state or command authority. Callers enforce authentication and client/consultant access before calling it. `projection.ts` explicitly selects public fields rather than spreading internal domain rows.

- PublishedCreditReview + CreditProfileState → Profile currentness and source basis. U3 removes this adapter in favor of final Profile/Analysis/Recommendation reads. Expiration never edits publication content. Preserve boundary, missing-basis and immutable-history tests.
- PlanVersion/PlanItem → Action summary and next available client step. U4 replaces with global CreditPlan/PlanItem. Guidance/Milestones never increase Action progress; submission is not verification. Preserve private draft exclusion and dirty-response/live-update tests.
- NurturePeriod and ApplicationCycleStage → legacy fallback context only. U4/U6 remove these inputs; do not extend their lifecycle. CreditCardRound is queried directly by client scope. Final Live/Major precedence remains outstanding.

`generatedAt` describes read time; source IDs/version numbers/state timestamps identify basis. Parallel reads and independent surface requests are not a globally atomic snapshot. Commands continue to revalidate source versions, actor scope and eligibility. The optional supplied Plan/publication inputs are internal reuse of the same caller-selected basis, never request-body input.

Evidence: workspace/projection tests, Plan service integration, Review publication integration, Plan page/response/live-update tests and BATCH-U1-02. No final DTO or U1 acceptance claim.

U1-15: ApplicationSession is a U6 read adapter. Open session status/id/version supplies return-to-session navigation, never execution permission. Scope is clientId plus endedAt null and explicit open statuses; only safe source fields are selected. Projection tests and Plan service composition tests cover this boundary; persisted full-session fixtures remain outstanding.

U1-16: Major case/restriction compatibility reads supply safe coordination focus and exact-case navigation. Uncleared restrictions use the same client scope as existing command guards. No permission or lifecycle changes; clearing remains subject to command revalidation. Final scheduling and comprehensive action contracts remain outstanding.

U1-17: Appointment focus uses the injected server clock and existing session window constant. It is appointment navigation only; command guards remain authoritative. Contextual schedule route is a U6 compatibility surface; continuously idle boundary refresh and final preparation contracts remain open.

U1-20: refreshAt is a future read boundary from current publication expiry and appointment timing. It grants no authority and stores no lifecycle state. Browser refetch uses server-relative duration; Plan snapshot/recovery protection remains active.

U1-22: live.integration.test.ts now verifies the previously outstanding persisted source chain, exact client scope/lifecycle filtering, Center agreement and Major restriction clearing via real commands. Synthetic test DB only; full application/provider/concurrency qualification remains outside this bounded read-adapter verification.
