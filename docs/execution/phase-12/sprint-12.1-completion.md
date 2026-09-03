# Sprint 12.1 Completion — Strategy Workspace & AI Proposal Foundation

- Branch: `rapid/phase9-12-plan-cards-strategy`
- Starting boundary: Phase 11-C1 report head.
- Introduced versioned `RoundStrategy` and immutable-source `StrategyVersion` foundations without a parallel card catalog.
- Frozen inputs identify the Round, Goal/version, Profile, Review, shared Plan version, Client Cards, prior applications, and major-application check; a deterministic fingerprint detects material drift.
- AI content is explicitly `PROPOSAL_ONLY`, with themes, opportunities, cautions, and research prompts. Human selection and approval remain mandatory, and a manual fallback is preserved.
- Registered the governed durable AI process definition `round_strategy.propose@1` for future provider execution; the stored draft never becomes an approval decision.
- Added CRM-scoped strategy read/manage routes and client-safe read projection. Admin role alone receives no strategy capability.
- Migration chain extended additively to 49 migrations; historical migrations were not changed.
- Verification: migration deploy, Prisma generation, and API typecheck passed against the dedicated Credit Phase 9–12 database.
