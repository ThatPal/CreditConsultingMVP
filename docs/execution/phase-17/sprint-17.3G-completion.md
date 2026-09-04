# Sprint 17.3G — Scheduled Job Operations

Status: complete

Implementation boundary: `c7fb8856f5b3cb965590d684b24e1f3c0592a79d`

Added durable scheduled-job definitions and bounded run history, idempotent system seeds, an Admin operational view, and a step-up-protected manual enqueue command. Manual execution emits an outbox request rather than running work inside HTTP. An active unexpired RUNNING lease blocks overlap; histories are deterministic and bounded. Definitions seed disabled. Prisma generation, API/Web typechecks, and lint passed.
