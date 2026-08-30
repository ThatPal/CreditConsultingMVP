# Credit Strategy Platform

A client portal and consultant console for coordinating credit profiles, goals, services, cards, and the global Credit Plan. This repository currently contains the Sprint 0.1 technical foundation; product workflows begin in later reviewed sprints.

## Prerequisites

- Node.js 24+
- pnpm 11+
- Docker Desktop with Compose

## Structure

- `apps/web` — React, Vite, MUI, Router, and TanStack Query frontend
- `apps/api` — Express REST API with validated configuration, structured logs, and safe errors
- `packages/shared` — browser-safe API contracts only
- `prisma` — PostgreSQL schema, migrations, and seed entrypoint

## Local setup

1. Copy `.env.example` to `.env`. The example contains development-only values.
2. Start PostgreSQL: `docker compose up -d postgres`
3. Install dependencies: `pnpm install`
4. Generate Prisma Client: `pnpm db:generate`
5. Apply migrations: `pnpm db:migrate`
6. Run the seed check: `pnpm db:seed`
7. Start both apps: `pnpm dev`

Web runs at http://localhost:5173 and API at http://localhost:3001. Check the API with `Invoke-WebRequest http://localhost:3001/health` on PowerShell or `curl http://localhost:3001/health` elsewhere. Use `pnpm dev:web` or `pnpm dev:api` to run one app.

## Verification

Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm format:check`, and `pnpm build`. `pnpm test:integration` runs the API HTTP tests. Database commands are `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:migrate:deploy`, and `pnpm db:seed`.

## Environment and security

The API validates `DATABASE_URL`, `PORT`, `LOG_LEVEL`, and `WEB_ORIGIN`; the browser only receives `VITE_` variables. Never commit `.env` files or real credentials. CORS accepts the configured web origin only, errors suppress internal details, and request logs redact common credential fields.

## Frontend design system

Theme values live in `apps/web/src/theme/designTokens.ts` and are consumed through the centralized MUI theme. Shared cards, metrics, statuses, feedback states, headers, and `FocusSurface` live in `apps/web/src/components/common`. Use the dark surface variants for normal product chrome and operational content. Reserve `FocusSurface` for dense, decision-critical, or report-like information; it is not a general light-theme card.

The development showcase is available at `/client/design-system`. Client and consultant placeholder routes intentionally contain no business behavior or mock authorization; real authentication begins in Sprint 1.1.

## Troubleshooting

- **Environment validation fails:** create `.env` from `.env.example` and run commands from the repository root.
- **Port 5433 is unavailable:** stop the conflicting service or change both the Compose mapping and `DATABASE_URL`. The local stack uses 5433 to avoid common system PostgreSQL conflicts; CI uses 5432 in its isolated runner.
- **Database is not ready:** inspect `docker compose ps` and `docker compose logs postgres`, then retry after the healthcheck passes.
- **Generated Prisma imports are missing:** run `pnpm db:generate` before typecheck/build.
- **Docker config access warning on Windows:** verify Docker Desktop is running and that the current account can read its Docker configuration.

Sprint 0.1 intentionally defines no product tables or feature endpoints. Prisma 7 supports an empty schema, avoiding premature domain invention; the first domain sprint will add its own reviewed migration.
