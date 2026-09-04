# Sprint 17.4C — Typed Settings & Governed Kill Switches

Status: complete

Implementation boundary: `813e681f329ca03d61d8276333a4a3aec67d40d1`

Added immutable, typed setting versions for four allowlisted boolean safety controls. Unknown keys and non-boolean values are rejected/fail closed; absence preserves the prior enabled behavior. Active-version changes require Admin, `settings.manage`, recent step-up, confirmation, idempotency, and atomic audit/outbox evidence. Commerce checkout and durable AI enqueue now enforce their switches centrally. Disabling blocks only new work and cannot alter authorization, historical records, audit/security history, professional decisions, paid effects, or in-flight durable work.

Focused switch tests: 3 passed. Prisma generation, API/Web typechecks, and repository lint passed before the implementation boundary. The accumulated exact-head gate follows in the Phase 17 gate report.
