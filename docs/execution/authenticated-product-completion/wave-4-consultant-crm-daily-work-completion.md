# APC Wave 4 — Consultant CRM Daily-Work Completion

Status: COMPLETE WITH ONE REVIEW-FIXTURE LIMITATION

Branch: `rapid/phase17-18-operations-public`

Accepted starting head: `607c8de04efb6f9bf3ec108a89a02b1a557d3984`

Implementation boundary: `e9fe266` (`feat(apc): complete consultant daily-work foundations`)

## Independent audit findings

| Finding | Severity | Disposition | Evidence |
| --- | --- | --- | --- |
| CAPC-W4-001 | P0 | Closed | Work Queue search overwrote the authorized source-scope `OR`, allowing an unauthorized matching item to enter results. The route now composes scope and search with `AND`; a route characterization proves the matching unauthorized item is excluded. |
| CAPC-W4-002 | P1 | Closed | Plan Builder initialized starter content over an existing canonical draft. It now hydrates the latest persisted version, including item identifiers and path keys; a UI regression proves saved content wins. |
| CAPC-W4-003 | P1 | Closed | Support lifecycle filtering happened after API pagination, producing incorrect totals and incomplete pages. Filtering now happens server-side with explicit active/resolved status groups and route proof. |
| CAPC-W4-004 | P2 | Closed | Calendar and appointment failures could remain as indefinite or silent loading states. Both surfaces now expose recoverable errors; Calendar also exposes canonical consultant availability and a governed weekday availability action. |
| CAPC-W4-005 | P1 | Closed | Major Readiness projected an older approved recommendation in preference to a newer draft, hiding current consultant work. The API now returns approved and draft recommendations separately and the CRM labels client visibility explicitly. |
| CAPC-W4-006 | P1 | Closed | Review Profile allowed arbitrary field paths and unconstrained numeric values. UI and API now share a bounded field vocabulary and enforce score/utilization constraints. |
| CAPC-W4-007 | P2 | Closed | Client 360 lacked a persistent seven-domain context rail. It now provides Overview, Journey, Credit Center, Cards, Services, Timeline and Support navigation with stable client context. |
| CAPC-W4-008 | P2 | Closed | Consultant Live was not organized around the required three operating zones. The workspace now separates client/readiness, governed execution, and approved sequence/help, with a Live Help queue handoff. |
| CAPC-W4-009 | P1 | Closed | CRM Cards research was incorrectly wired to the Admin-only catalog-candidate approval endpoint. Consultants now receive read-only governed product research without save/apply or approval controls; Admin catalog operations remain separate. |

No new P0 credential, authorization, payment, or immutable-history exposure was found after CAPC-W4-001 was corrected.

## Delivered contract

- Dashboard metrics are scoped by active canonical staff assignment or active `client.read` grant and distinguish authorized clients from actionable own/unassigned work.
- Work Queue preserves assignment, priority and lifecycle filters, adds Support/Live family filtering, and keeps claim/open actions tied to canonical work items.
- Client 360 provides one stable seven-domain navigation system and populated contextual history rather than disconnected destination pages.
- Review uses a typed verified-fact vocabulary with server-side validation.
- Plan Builder resumes canonical saved drafts safely.
- Calendar exposes appointment recovery and consultant availability; Live uses three operating zones and preserves governed execution boundaries.
- Major Readiness distinguishes approved client-visible state from an editable consultant draft.
- Support performs lifecycle filtering before pagination and preserves separate client-visible reply/internal-note behavior.
- Cards research is read-only for Consultants and remains distinct from Admin candidate publication authority.

## Verification

Focused API gate:

- 4 files passed, 25 tests passed: high-risk route characterization, Major Readiness service, persisted Review workspace, and appointments.
- The broader API run also passed: 68 files, 269 tests.

Focused/UI gate:

- 5 files passed, 14 tests passed for Plan, Client 360, Work Queue, Support and visual maturity.
- Client product/Plan/Client 360 follow-up completed within the full web run: 24 files, 101 tests passed.

Workspace gates:

- `pnpm typecheck`: passed across all five workspace projects.
- `pnpm lint`: passed.
- `pnpm build`: passed; Vite emitted only its existing chunk-size advisory.

Browser proof at `http://localhost:5185` using `consultant@credit.local`:

- Dashboard: scoped metrics rendered (25 authorized clients, 13 open work items, one active Review).
- Work Queue: 12 populated attention items, three urgent, five claimed and seven unassigned; claim/open actions and filter controls rendered.
- Global client search and Client 360: Jordan Blake opened with seven context destinations and populated businesses, relationships, services, support and timeline.
- Review: submitted Review opened through guided Review, Source and Profile; durable extraction succeeded and typed verified-fact controls rendered.
- Plan: canonical saved “Credit preparation plan” version 1 hydrated without starter-content replacement.
- Support: 13 active cases and one resolved case rendered with correct server totals; reply, internal note, AI draft and macro tools remained available.
- Cards research: four governed catalog products rendered for the Consultant with research-only language and no Admin approval or client Wishlist action.
- Calendar: availability and no-appointment empty state rendered with recovery behavior and governed availability action.

The persistent Credit-only review database contains a populated round but no Appointment, ApplicationSession, MajorReadinessCase or RoundStrategy rows. Consequently, Calendar → Live, Post-Round → Analysis/finalization, and Major Readiness were verified through focused automated domain/UI coverage and browser empty/recovery states, but could not honestly be claimed as populated manual paths. This is a review-fixture completeness limitation, not a production-authority bypass; no synthetic authority-bearing records were inserted ad hoc.

## Environment and boundaries

- Review UI: `http://localhost:5185`
- API: `http://localhost:3008`
- Database: `credit_strategy_phase1316_checkpoint` on port 5433 (Credit-only)
- Redis: port 6380
- Review account: `consultant@credit.local` with enrolled MFA; the temporary development password is handed off out-of-band and is not retained in repository evidence.
- `ai-enabled` was not merged or modified.
- Wave 5, Phase 18, public-site and deployment work were not started.

Exact-final-head CI is triggered after the report boundary is pushed; the immutable workflow result is the authoritative exact-head evidence.
