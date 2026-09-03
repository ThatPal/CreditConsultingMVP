# Phase 11-C1 Completion — Seasonal Cycle Review Route Runtime Correction

## Boundary

- Branch: `rapid/phase9-12-plan-cards-strategy`
- Accepted Phase 11 head: `69e415772fb68184212f1770bc0518d694cef7cf`
- C1 implementation commit: `80f630eebe6d8b5e5c33fd004e1f7f397c67b297`
- Phase 12 product work was not started before this correction was completed.

## Reproduction and diagnosis

The seeded client route `http://localhost:5184/app/application-rounds` was reproduced in the actual Codex browser. The authenticated application shell loaded, while `GET /api/v1/client/seasonal-cycle` returned `404 NOT_FOUND` and the page rendered its generic load failure.

The request, session, seed, and database were healthy. Port `3007` was still owned by an older API process. Starting the current review environment launched a second API process, which exited with `EADDRINUSE`; the launcher nevertheless printed that the environment had started. The stale process did not contain the Phase 11 router.

## Correction

- The Phase 9–12 review launcher now records and stops its own API, worker, and web process IDs before restart.
- It refuses to claim success when either review port remains occupied.
- It starts Vite directly so the recorded PID owns the web listener.
- It checks child-process survival and waits for the current API health contract before reporting success.
- An authenticated application-route regression now proves `/api/v1/client/seasonal-cycle` is registered and returns current Goal, Profile, Cycle, and Round context.

## Verification

- Focused Phase 11 API integration: **5 passed**.
- API typecheck: **passed**.
- API build: **passed**.
- Repository lint, scoped to the correction command: **passed**.
- Live API log: authenticated `/api/v1/client/seasonal-cycle` returned **200** from the current server.
- Actual Codex browser: seeded client saw the current Goal and Profile, started **Fall 2026**, exercised **Start paid card round**, and reached the useful **Credit Card Round** view with entitlement, profile, preparation, major-check, and Plan navigation state.
- Canonical session-loss handling remains centralized in the shared API/AuthProvider contract; a `401` does not use the seasonal-cycle generic load-error path.

## Environment

- Credit-only database: `credit_strategy_phase9_12_block` on port `5433`.
- Review web: `http://localhost:5184`.
- Review API: `http://localhost:3007`.
- No merge to `ai-enabled`; `main` and `baseline/current-non-ai` remain untouched.
