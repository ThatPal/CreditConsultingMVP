# Sprint 17.3D — Workflow Rule Administration

Status: complete

Implementation boundary: `bd868decc9e626f6439d4697e7598a1bd39537db`

Added the append-only/versioned `WorkflowRule` foundation and migration plus Admin list/create UI. The server accepts only enumerated triggers, discriminated typed conditions, and discriminated safe actions; there is no script/free-form execution field and no action can mutate professional, payment, entitlement, or security authority. New versions default disabled, activation retires the prior active version, and creation is step-up protected, idempotent, audited, and outboxed. Prisma generation, API/Web typechecks, and lint passed. Immediate exact environment CI remains pending the authorized rapid-branch push.
