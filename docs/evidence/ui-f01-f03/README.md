# UI-F01–UI-F03 visual review

Branch: `ui/portal-shell-credit-center-overview`. Scope stops at Overview. Visual approval is pending.

## Implementation

- **UI-F01:** client-only persistent desktop rail; More expanded by default; exactly Home, Journey, Credit Center, Cards, More in mobile bottom navigation. More opens the utility sheet; no duplicate client hamburger drawer. Existing auth, notification counts/actions, account/security routes and sign-out are reused. Secure workspace remains informational. CRM/Admin navigation and feature interiors are preserved.
- **UI-F02:** persistent six-area desktop navigation with icons/current indicator; compact dated Review context; mobile Section control and six-area sheet. Review context is preserved on section links. Historical full-workspace switching remains unavailable, so no disabled historical choices are advertised. Existing historical deep-link guard still withholds current consequential actions.
- **UI-F03:** responsive three-column composition becomes one semantic mobile page: Snapshot → Baseline/Changes → Matters Now → Assessment → Priorities → Progress → Explore. Factual/professional content is explicitly labelled. The assessment uses the existing warm reading-plane tokens within the dark Portal shell. Unknown facts stay unknown; known zero remains zero. Findings and priorities are capped at three. No generated advice, invented score rating, readiness percentage, future milestone or sample value is inserted into production data.

## Screenshots

These use a separately authenticated synthetic local client. No user browser session or production data was copied. All post-login browser API traffic was restricted to reads. Notification counts and published values in live captures come from the existing local server.

| Evidence | Source/state |
| --- | --- |
| [Desktop viewport](desktop.png) / [full desktop composition](desktop-full.png) | 1440px; live published first Review, partial metadata, no immediate Plan action; More expanded |
| [Mobile viewport](mobile.png) / [continuous mobile page](mobile-full.png) | 390px; same live baseline, More closed; full-page image includes the fixed bar at its viewport position |
| [Mobile More open](mobile-more-open.png) | Seven destinations/actions, account grouping, non-clickable reassurance |
| [Mobile Section open](mobile-section-open.png) | Six Credit Center areas; current section checkmark |
| [Desktop detail/light plane](desktop-detail-light-plane.png) | Existing Analysis content, unchanged; proves parent shell inheritance |
| [Mobile detail/light plane](mobile-detail-light-plane.png) | Existing Analysis deep link and mobile shell |
| [Desktop new client](desktop-no-review-fixture.png) / [mobile new client](mobile-no-review-fixture.png) | **Controlled read-response fixture:** no publication. No fake score/assessment/Plan cards or database writes |
| [Review in progress](desktop-review-in-progress-fixture.png) | **Controlled read-response fixture:** unpublished active Review. No draft facts/advice |

Baseline and no-current-action evidence are the live desktop/mobile captures, not artificially populated sample dashboards.

## Targeted verification

- Five targeted test files: Overview model/rendering, client navigation, Credit Center navigation, shell, and published Credit Center page compatibility.
- Browser results: [browser-results.json](browser-results.json). All six Credit Center routes maintain their global parent; mobile Section navigation and browser Back work. More traps keyboard focus; More and Section support Escape and restore focus. One H1, no horizontal page overflow at 390/768/1199/1200/1440px, no page errors.
- TypeScript/web production build and changed-file ESLint checked separately. Exact final results are in the reconciliation completion record.
- No full web regression, API suite, 60-state matrix, provider/domain regression, or production qualification was run.

## Visual-authority comparison / remaining differences

UI-F01 controls global navigation and surfaces; UI-F02 controls feature header/navigation; UI-F03 controls Overview ordering/composition. Written corrections override the image's hamburger, missing mobile Section selector, sample copy and unsupported metrics.

- Existing branding/icons are reused; illustrative photography/mountain artwork and fictional user portraits were not reproduced.
- Existing publications omit score model/range. Scores use neutral unfilled frames with an explicit limitation, not the illustrative colored rating arcs or inferred labels. Numeric comparison arrows are withheld without comparable source metadata.
- Live client has its first published Review and no remaining Plan actions: Baseline and a truthful no-action state replace the image's sample changes/priorities.
- The light assessment plane deliberately reuses the approved UI-F01 reading-surface system; no inner Analysis/Profile redesign was performed.
- Settings routes to existing account security/session settings. No new settings backend or global search was fabricated.
- Atomic publication, complete historical composition and unavailable metadata remain backend dependencies; see the reconciliation record. This evidence does not certify those capabilities.

Stop: UI-F04 Credit Profile and later sections have not begun.
