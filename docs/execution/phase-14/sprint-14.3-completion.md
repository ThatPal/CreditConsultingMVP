# Sprint 14.3 Completion — Initial, Updated & Final Round Analysis

Starting SHA: `0c805b2`

Implementation SHA: recorded by the commit containing this report.

Added append/version-based `RoundAnalysis` with Initial, Updated, and Final kinds; Draft, Approved, and Superseded states; immutable source snapshot/fingerprint; deterministic facts; client-safe content; approval actor/time; and preserved version history. Preparing uses deterministic canonical summary facts and an explicit manual fallback draft. AI is not allowed to author facts or silently publish, and no model metadata or chain reasoning reaches client projections.

Consultant preparation and approval require canonical `client.manage` plus client scope. Approval rejects stale source fingerprints and concurrent/repeated claims, supersedes the prior approved version without rewriting it, and emits audited/outbox publication effects. Later application or follow-up changes make the prior analysis visibly stale/update-needed.

Added client PORTAL-33 and consultant CRM-20 analysis routes with loading/error/empty/draft/stale/history states and governed approval controls. The client endpoint returns approved content only and strips internal/source snapshot data. One additive migration creates the analysis enums/table; historical migrations were preserved.
