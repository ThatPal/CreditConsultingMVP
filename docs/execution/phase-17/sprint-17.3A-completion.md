# Sprint 17.3A — AI Job Operations

Status: complete

Implementation boundary: `8eb92b723769fcd174b453632fd060356406489e`

Delivered a bounded, cursor-paginated Admin AI-job console and detail diagnostics over the canonical PostgreSQL runtime. Inputs are redacted; source versions, attempts, failure categories, outputs, and artifact counts remain observable. Retry and cancellation are narrow state-machine transitions protected by Admin role, `settings.manage`, recent step-up, idempotency, atomic audit/outbox recording, and confirmation UI. Retry re-enters the existing durable reconstruction/queue path. These controls cannot approve AI content or mutate Review/Strategy authority.

Verification: API and Web typechecks passed; repository lint passed; no schema/migration change. The mandatory environment-aware CI is pending an authorized rapid-branch push.
