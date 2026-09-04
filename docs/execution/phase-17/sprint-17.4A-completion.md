# Sprint 17.4A — Retention & Cleanup Operations

Status: complete

Implementation boundary: `c826b53b610dae90cf66b2615401a260955f9f08`

Added durable retention policies/run evidence, disabled idempotent seed policy, preview-first Admin UX, and one explicitly allowlisted execution target: expired sessions older than the configured retention window. Audit/security events are structurally excluded. Execution requires enabled policy, Admin `settings.manage`, recent step-up, confirmation, idempotency, and atomic audit/outbox evidence. Prisma generation, API/Web typechecks, and lint passed.
