# Credit Strategy Platform

A client portal and consultant console for coordinating credit profiles, goals, services, cards, and the global Credit Plan. The monorepo includes independently buildable web, API, worker, shared-contract, and server-runtime packages.

## Prerequisites

- Node.js 24+
- pnpm 11+
- Docker Desktop with Compose

## Structure

- `apps/web` — React, Vite, MUI, Router, and TanStack Query frontend
- `apps/api` — Express REST API with validated configuration, structured logs, and safe errors
- `apps/worker` — job-free worker process boundary with dependency readiness and graceful shutdown
- `packages/shared` — browser-safe API contracts only
- `packages/runtime` — server-side environment, Redis, and structured logging primitives
- `prisma` — PostgreSQL schema, migrations, and seed entrypoint

## Local setup

1. Copy `.env.example` to `.env`. The example contains development-only values.
2. Install dependencies: `pnpm install --frozen-lockfile`
3. Start PostgreSQL and Redis and wait for healthchecks: `pnpm runtime:up`
4. Generate Prisma Client: `pnpm db:generate`
5. Apply migrations: `pnpm db:migrate`
6. Apply the idempotent system/reference seed: `pnpm db:seed:system`
7. Start web, API, and worker: `pnpm dev`

Web runs at http://localhost:5173 and API at http://localhost:3001. `/health` proves the API process is alive; `/ready` returns 200 only when PostgreSQL and Redis are reachable. The worker logs structured dependency-ready and worker-ready events after both services respond. Use `pnpm dev:web`, `pnpm dev:api`, or `pnpm dev:worker` to run one process. Stop local infrastructure with `pnpm runtime:down`.

## Verification

Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm format:check`, and `pnpm build`. `pnpm test:integration` runs the API HTTP tests. Database commands are `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:migrate:deploy`, and `pnpm db:seed:system`. The system seed is deterministic and safe to rerun. Optional demo fixtures are separate behind `pnpm db:seed:demo` and are never required for a canonical environment.

## Environment and security

The API and worker validate `DATABASE_URL`, `REDIS_URL`, `NODE_ENV`, and `LOG_LEVEL`; API-specific settings remain validated separately. The browser only receives `VITE_` variables. Never commit `.env` files or real credentials. Compose defaults are development-only. CORS accepts the configured web origin only, errors suppress internal details, and structured logs redact common credential fields and URLs.

## Frontend design system

Theme values live in `apps/web/src/theme/designTokens.ts` and are consumed through the centralized MUI theme. Shared cards, metrics, statuses, feedback states, headers, and `FocusSurface` live in `apps/web/src/components/common`. Use the dark surface variants for normal product chrome and operational content. Reserve `FocusSurface` for dense, decision-critical, or report-like information; it is not a general light-theme card.

The development showcase is available at `/client/design-system`. Client and consultant routes use the existing authentication and authorization boundaries; the design-system route remains a development reference.

## Troubleshooting

- **Environment validation fails:** create `.env` from `.env.example` and run commands from the repository root.
- **Port 5433 is unavailable:** stop the conflicting service or change both the Compose mapping and `DATABASE_URL`. The local stack uses 5433 to avoid common system PostgreSQL conflicts; CI uses 5432 in its isolated runner.
- **Database is not ready:** inspect `docker compose ps` and `docker compose logs postgres`, then retry after the healthcheck passes.
- **Redis is not ready:** inspect `docker compose ps` and `docker compose logs redis`. API `/health` can remain healthy while `/ready` correctly returns 503; the worker exits with a structured startup failure instead of pretending to be ready.
- **Worker exits during startup:** verify both `DATABASE_URL` and `REDIS_URL`, then confirm PostgreSQL and Redis are healthy with `docker compose ps`.
- **Generated Prisma imports are missing:** run `pnpm db:generate` before typecheck/build.
- **Docker config access warning on Windows:** verify Docker Desktop is running and that the current account can read its Docker configuration.

Sprint 1.1 adds no business schema or queue/job semantics. Redis and the worker are foundational runtime boundaries only.

## Transaction foundation

Consequential database writes that need idempotency, audit evidence, and durable event intent use `executeConsequentialCommand` in `apps/api/src/transactions`. Its documented contract commits business state, append-only `AuditEvent`, `OutboxEvent`, and the completed idempotency result atomically, or rolls the business/audit/outbox effects back together. `OutboxEvent` is durable intent only; no publisher or queue behavior exists yet.
