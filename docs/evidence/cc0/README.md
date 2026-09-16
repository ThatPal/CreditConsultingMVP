# CC-0 visual review

Authority: [CC-0 micro-slice specification](https://docs.google.com/document/d/1KhSgUGeBgzHvwFTyhoZEwpzV0lWANBGtvP229ofyBE8/edit), read completely, revision modified 2026-09-16 16:26:23 UTC. Baseline: `5bcec00578ef1133ec68ac3a5ff0efdd64d75367`, independent `codex/astra-production` checkout.

**Ready for human visual review. Product approval remains pending. CC-1 has not started.**

## Requested captures

All captures use the existing synthetic local client account in an isolated browser context. No credit values or Review records were seeded for CC-0. Non-read API requests were blocked after login.

| Required view | Evidence |
| --- | --- |
| Desktop Overview, 1440px | [Overview](desktop-overview.png) |
| Desktop detail, 1440px | [Credit Profile](desktop-profile.png) |
| Desktop Review selector or current-only state | [Current-only assessment](desktop-current-only.png) |
| Mobile Overview, 390px | [Overview](mobile-overview.png) |
| Mobile Profile, 390px | [Credit Profile](mobile-profile.png) |
| Mobile area sheet, 390px | [Area sheet](mobile-area-sheet.png) |
| Mobile direct Plan link, 390px | [Plan](mobile-plan-deep-link.png) |
| Historical desktop/mobile | Deferred: no complete historical Credit Center contract; no fabricated screenshot |

The actual account has one distinct published Review, so the context label deliberately has no dropdown affordance. Multiple publications of the same Review are not misrepresented as separate Review choices. When different prior Reviews exist, the selector presents their real publication/report dates as disabled snapshot-only rows, explains the limitation, and links to full History.

## Changed files

Paths below are relative to the repository root.

| File | Focused change |
| --- | --- |
| `apps/web/src/features/credit-center/CreditCenterShell.tsx` | Shared identity/provenance header, Review context, historical/unavailable guard, outlet wrapper |
| `apps/web/src/features/credit-center/CreditCenterNavigation.tsx` | Persistent mobile area selector/sheet; retained desktop route tabs; explicit Review query preserved across area links |
| `apps/web/src/App.tsx` | One shared shell around six areas and legacy Plan route |
| `apps/web/src/pages/PublishedCreditCenterPages.tsx` | Remove redundant client shell/header; consultant header and inner components retained |
| `apps/web/src/pages/PlanPages.tsx` | Remove redundant area navigation; preserve Plan title and controls under the shell with h2 semantics |
| `apps/web/src/components/common/PageHeader.tsx` | Optional heading element; existing default/appearance unchanged |
| `apps/web/src/components/common/ReferenceQueryState.tsx` | Pass optional heading element for nested loading/error content |
| `apps/web/src/features/credit-center/CreditNavigation.test.tsx` | Six-area mobile selector and desktop selection/context tests |
| `apps/web/src/features/credit-center/CreditCenterShell.test.tsx` | Current-only, prior Review limitation, truthful absence, metadata, area retention and historical Plan guard tests |
| `docs/evidence/cc0/` | This report, seven PNGs and scoped browser results |

No Home, credit data adapter, score/Profile/report/Analysis/History component, Plan command/response logic, API, schema, provider, or domain implementation was changed. The Plan page diff is limited to header/navigation integration. The shared heading prop preserves defaults outside Credit Center.

## Targeted verification

- Targeted navigation/shell/App tests: **48 distinct tests passed across 3 files** (App 23, navigation 13, shell 12). The combined run passed 47 tests; the final shell-only run passed 12, including one additional unknown-Review metadata test. These overlapping run totals are not added together. Final exact-dialog-name check included.
- Web typecheck/build: passed with `pnpm --filter @credit/web build`.
- Changed-file ESLint: passed; diff whitespace check passed.
- Browser: six mobile sections switch through the persistent selector; desktop Overview/Profile tabs, direct Plan and legacy `/app/plan` retain orientation; Escape closes the sheet and returns focus; one h1, no horizontal overflow or page errors. [Measured results](checks.json).
- Header measured **204px desktop / 206px mobile**, excluding the intentional content gap. No sticky header was introduced.
- Required screenshots were visually inspected, including the area sheet and Plan direct link.

Only Level A/B scoped checks ran. No full web regression, API suite, U1.5 state matrix, or unrelated provider/domain/security test suite ran for CC-0. Early iteration corrected strict optional-prop typing, one unused import, a stale Vite export, and dialog label IDs; final checks supersede those attempts.

## Historical dependency and safe behavior

The existing endpoint exposes immutable publication snapshots, but its workspace and Plan projections describe current state. **U3/U4 must supply assessment-scoped composition and Plan history before historical context switching can be enabled.** No parallel records or invented historical facts were added.

The shell can recognize a supplied publication identifier in `?review=`. For a prior identifier with available metadata it shows the calm historical notice and original publication/report dates. For an unknown identifier it says the requested assessment is unavailable. In both cases it withholds the current child experience, including consequential Plan controls, and provides Return to current plus History access. Area links retain this identifier; Return to current retains the area. This is an explicit unavailable shell contract, not a claim that historical inner pages are implemented. Tests use bounded synthetic input to verify this guard; the normal selector keeps unavailable historical choices disabled.

## Acceptance

Engineering checks pass for stable shell, ordered desktop tabs/active state, mobile selector on all six areas, truthful Review choices, context-preserving area links, deep-link orientation, unchanged inner behavior, and targeted validation. Historical full composition is explicitly deferred under the specification's permitted unavailable behavior.

**Human approval remains open** for premium/coherent appearance, hierarchy, tabs, mobile discoverability, Review-context clarity, and vertical space. Historical notice styling has component coverage only; review it with real historical composition when its owning contracts are available.

Stop here for visual approval. Do not begin CC-1 or additional Credit Center design work.
