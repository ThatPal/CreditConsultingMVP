# Audit scope, evidence and limits

Date: 2026-09-10. Repository: [CreditConsultingMVP](https://github.com/ThatPal/CreditConsultingMVP). Baseline `ee3b8648b4a61ab76d4b56bd1cfd307b83bd8eb0`, copied from the latest referenced Sol worktree into independent `codex/astra-production`.

## Sources

- [Credit Consulting Business Strategy](https://chatgpt.com/c/6a8674b6-8234-83ea-9c77-c8be83c2ec9f): all 30 retrieval pages, 299 turns, paginated to the end. Seven assistant messages are explicitly truncated by the tool's 20,000-character maximum; no user messages were reported truncated. Attempting a larger limit was rejected by the tool. Therefore this is **not** a claim that every character of the original conversation was available.
- [Sprint 3.4 Review Status](https://chatgpt.com/c/6a95daa3-6144-83ea-aff6-9cf0497eb8a0): all 13 retrieval pages, 124 turns, paginated to the end, no reported truncated messages.
- [Google Drive project](https://drive.google.com/drive/folders/1aRR5Mqbn_ZtAlK0TvKzEw4qD3UvRvQoI): inventoried current folder structure and retrieved 30 current documents/reference files: core numbered build specs, current business/operations/legal/readiness material, and POAR screen/journey/decision documents. The seed spreadsheet was fetched as readable text, not a complete formula/layout audit. Historical archives and every sprint attachment/completion packet were not exhaustively re-read.
- [Source manifest](source-manifest.json): local snapshot SHA-256 hashes, titles/URLs, byte counts, retrieval counts, and truncation indicators. Raw conversation/Drive snapshots are private ignored local inputs under `sources/`; they are not included in the Git commit or pushed.

Source authority and recovered conflicts are in REQUIREMENTS.md. Document completion claims are used as historical evidence, not certification. Important details retained from current Drive 13 are carried into the 110-screen register rather than replaced by a short feature list.

## Code and screen coverage

- Parsed the actual React route tree: **120 route declarations**, including parent/index routes, aliases, development routes and fallbacks. This is not 120 distinct product screens. See [route inventory](route-inventory.csv).
- Mapped **110 canonical screen contracts** from Drive 13, including states embedded in larger pages. The [screen register](SCREEN-REGISTER.md) and [CSV](screen-register.csv) label browser/source/missing coverage individually.
- Inspected central runtime assembly, environment, authentication, document/AI processing, shared components/theme, query invalidation, Journey/Plan projections, strategy/live/calendar, commerce/provider interfaces, Admin operations and existing test/acceptance material. Schema contains 121 model declarations; migration chain contains 66 migrations. These counts indicate scope, not correctness.
- Browser review used only a newly seeded Astra database with synthetic clients/cards/reports/payments. Initial inspection covered intake/login/Home and Credit Center overview/Profile/Analysis. The route helper then recorded 44 observations across 43 distinct paths, with additional settled-state DOM reads and screenshots. These are representative screen/state inspections, not complete end-to-end certification.
- Client browser coverage included Home/mobile, Journey/goals, Credit Center/report/history/completed Review, Cards/Explore/Wishlist, services/credits/purchase history, active Round sections, historical results/follow-up/Analysis, all five Major tabs, documents, support, notifications and account/security. Schedule was reached but its initial loading observation is not counted as completed scheduling coverage.
- Consultant browser coverage included normal local sign-in/MFA, Dashboard, Work Queue, Clients, Client 360, Review source tab, Plan authoring, Strategy sections, live console and Calendar. The latter was re-read after loading, showing configured availability and appointments. Live connection recovered to “Live”; the temporary “Reconnecting” display is not reported as a persistent network defect.
- Desktop screenshots and a 390×844 mobile Home screenshot were inspected. The viewport override was reset. No comprehensive accessibility, tablet, touch, visual-regression or all-state test was performed during this audit.

## Validation run

| Check | Actual outcome |
|---|---|
| Isolated dependency installation | Frozen-lockfile install succeeded. Offline attempt lacked an eslint tarball; network-enabled retry completed. |
| Prisma generation | Passed. |
| Fresh Astra migration deployment | All 66 migrations applied successfully to `credit_strategy_astra` on port 5445. |
| System and synthetic demo seeds | Passed in Astra. Initial sandboxed tsx seed hit a Windows environment error; authorized retry completed. |
| Workspace production build | Passed for web/API/worker/packages. Main web chunk approximately 1,321.39 kB minified /342.36 kB gzip; shared chunk approximately 335.54/100.81 kB. |
| Frontend baseline | 29 files passed, 1 failed; 121 tests passed, 1 timed out at 5 seconds. The timeout was `SupportPages.test.tsx` → “opens a safe thread and presents the complete create form.” |
| Focused Support retry | All 8 tests passed in 13.13 seconds. No test timeout was increased and no test implementation was changed. The broad baseline remains recorded as a failed run; the focused result suggests sensitivity to run conditions, not a confirmed functional defect. |
| API compile after cookie isolation | Passed. The only application-code edit is a cookie prefix configuration for version isolation, not a product feature fix. |
| Cookie isolation runtime check | Restarted only the recorded Astra API after verifying its PID and port. Synthetic client sign-in produced `credit_astra_sid.session_token`; `/api/me` authenticated the CLIENT role; that test session was signed out. No cookie values were recorded. |
| API readiness | `/ready` returned ready for PostgreSQL and Redis on Astra API port 3015. Readiness does not certify external adapters. |
| Artifact inventory | 110 unique screen IDs; 120 parsed route declarations; source manifest generated. |

No full API integration suite, live payment, external mail delivery, real credit report, external calendar, public deployment, production load test, penetration test, or regulatory review was performed. Existing tests were examined where useful, but their old pass reports were not rerun or adopted wholesale.

## Initial approval-review limitation — resolved

Automatic approval review initially rejected enrolling MFA for the isolated synthetic administrator, reasoning that it changes administrator security state during a read-only audit. The rejection was not bypassed. Admin review initially continued through code/specifications. The user subsequently explicitly authorized enrollment, and the ordinary enrollment/TOTP flow succeeded. Consultant fixture MFA had already completed through the ordinary flow; no existing real staff account or other version's data was changed.

The follow-up completed 36 observations over 31 distinct implemented Admin paths, selected forms/details, a cancelled settings confirmation and retention preview. Desktop Reports and mobile Dashboard screenshots were inspected. The screen register now identifies observed Admin surfaces; missing detail experiences and untested consequential mutations remain explicit. See [Admin browser evidence](ADMIN-BROWSER-AUDIT.md) for findings F21–F24 and the limits of this pass. No full production acceptance is claimed.

## What this audit establishes

The report establishes specific defects, scope gaps, source conflicts, architectural priorities and a complete screen/workflow delivery plan. It does not prove the absence of additional defects. The next waves require exact field/command/state contracts and evidence-backed closure; all screens remain unqualified for production until those gates are met.
