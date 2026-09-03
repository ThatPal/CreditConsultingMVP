# Sprint 13.4 Completion — Card Release, Apply, Skip, Help & Structured Result

Starting SHA: `1593f8416633ea695fad2429f75fe6b8a24c8b3c`

Implementation SHA: recorded by the commit containing this report.

Implemented canonical `CreditApplication` plus append-only `CreditApplicationEvent`, preserving exact ApplicationSession, Round, frozen StrategyVersion, Strategy occurrence, CardProduct, and frozen CardOfferVersion references. Consultant-only `ReleaseApplication` revalidates LIVE state, current client and assigned-consultant leases, current pre-live confirmation/source fingerprint, exact Strategy membership, approved planned role, sequence, and absence of an unresolved release inside one transaction. Unique occurrence/session storage and shared idempotency make concurrent retries converge.

Client projection exposes only the current released card's display identity, frozen offer facts, approved client-safe reason, state, and allowed actions. It excludes future/alternative candidates, internal rationale, execution rules, AI output, and source internals. Apply records issuer handoff opening without collecting credentials. Skip is its own append-only event and never an application outcome. Help dedupes a canonical urgent Attention projection.

Structured results distinguish APPROVED (known or explicitly unknown limit), DECLINED, PENDING, APPLICATION_NOT_COMPLETED, TECHNICAL_ISSUE, and OTHER. Only a known positive approved limit contributes to the amount; Pending and technical states contribute zero. Business state, event, audit, outbox, and idempotency record share the command transaction, so injected failure rolls back the entire effect family and retry is safe.

Focused proof covers normalized result arithmetic, Skip separation, stale/unapproved/out-of-sequence release denial, DTO privacy by construction, shared rollback/retry semantics, API/web typecheck/build/lint, clean migration deployment, and immediate exact-boundary CI.
