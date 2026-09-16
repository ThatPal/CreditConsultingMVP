# U1 batch 25 — Completed Actions and mobile navigation accessibility

Baseline fa645ce. Independent Astra branch codex/astra-production. U1 NOT PASSED.

The mobile navigation trigger now exposes its expanded state and controlled, named modal dialog. Browser testing found focus was not reliably placed in the drawer or returned to its trigger. Transition callbacks now explicitly focus the first navigation control after opening and the trigger after closing; the existing modal focus trap is retained. Plan focus and collection headings are h2, with individual detail steps h3, independently of their visual typography. CollectionSurface accepts an optional semantic heading level while retaining existing defaults elsewhere.

## Evidence

- 12 browser scenarios: completed Action and no-Profile fixtures across Home, Credit Center and Plan at 1440/390 widths. They use authenticated synthetic baseline reads, the production Plan summary/focus functions and controlled response fixtures. No-Profile is deliberately combined with retained published Plan history: unavailable current credit facts do not erase saved work.
- Completed Plan Actions show zero remaining, one completed and no client completion/help form. Existing component test completes an Action, sees the new server focus and response history, and verifies the form disappears; extended assertions cover the semantic headings.
- Six mobile checks open the drawer with Enter, wait for opening/focus placement, traverse 18 Tab stops within the dialog, dismiss with Escape, and verify focus returns to the trigger. All 12 screens have one h1, one main landmark and no horizontal overflow. Reviewed completed Plan mobile capture retained with normalized results in docs/evidence/u1-completed-states/.
- Initial regression run: 26 tests across PlanPages, ShellPages and CollectionSurface. Changed Plan test and final shell changes rechecked separately. Full five-package build and root lint pass.
- The first browser attempt hit a stale Vite module export and blank sign-in page; invalidating only the Astra file watcher restored the preview. No other process or checkout was changed. A timing-aware drawer rerun still reproduced missing focus placement, leading to the explicit transition repair above.

These are presentation/interaction checks, not persisted completion or publication lifecycle qualification. Broader contrast, dialogs and account/notification focus checks remain under V3. T3 available-action/blocker contracts, T4 full recovery matrix, V1 final reference comparison and V4 Decisions/Nurture disposition remain open. No U1 completion report or production acceptance is claimed.
