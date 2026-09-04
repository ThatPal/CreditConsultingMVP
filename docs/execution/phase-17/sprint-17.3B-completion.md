# Sprint 17.3B — AI Process & Model Configuration

Status: complete

Implementation boundary: `36d3bb755e99ee8903ad0dea94d3ce7bf9e0ca6b`

Delivered an Admin view of immutable AI process versions and a governed creation path for new versions. Configuration stores only validated model-profile references, schema/instruction versions, bounded retries, classification, allowed context, and consumer. It rejects secret-like configuration, hard-codes the existing factual-only authority level, creates disabled drafts by default, and blocks direct activation when schemas change. Creation requires Admin + `settings.manage` + recent step-up and records idempotency, audit, and outbox atomically. Existing jobs retain their original process-definition relation.

Verification: API and Web typechecks plus repository lint passed. No migration was needed because the canonical versioned `AIProcessDefinition` model was preserved.
