# Astra implementation pass 9: Plan response navigation protection

Date: 14 September 2026. Continues pass 8 on `codex/astra-production`.

## Delivered

- Router navigation away from a Plan response now prompts when answers are unsaved or a save/upload/submission is running. The form remains mounted and autosave continues while the dialog is open.
- Clients can stay, explicitly leave without the latest unsaved edits, or continue to the selected destination once changes are saved. Leaving is disabled while a write/upload is active. Failed saves retain the existing retry flow and require an explicit leave decision.
- One shared blocker aggregates mounted responses, so one step cannot clear another step's protection. Path and query changes are covered; same-page hash navigation remains available.
- Replaced the BrowserRouter host with a wildcard data-router host retaining the existing App routes, authorization providers and live updates. Uses the supported [React Router blocker API](https://reactrouter.com/api/hooks/useBlocker) instead of patching browser history.

## Verification

- 26 focused web tests pass across seven suites: existing 22 Plan tests plus four navigation tests covering stay/answer retention, pending-save exclusion, successful save and destination continuation, failed-save Back/discard, clean navigation, and independent response registrations. One initial assertion needed to await the dialog exit animation; its suite passed after correction.
- Web production build and targeted ESLint pass. Existing bundle-size warning remains. No backend changes or migrations; API tests were not rerun.
- Mobile browser with an isolated synthetic QA Plan: edited and immediately followed the Credit Center link, observed blocked navigation, watched autosave complete in the dialog, stayed with the exact answer intact, edited again and continued to the requested destination after saving. Inspected the dialog screenshot and accessible name/description. Restored the regular demo session; no Jordan Plan data changed.
- Browser login and nested Plan/Credit Center routes worked under the new router host. Back/discard, concurrent response and pending-write cases are component/router integration evidence, not a full browser/device matrix.

## Remaining scope

- This guards router transitions for mounted Plan responses. Existing unload warnings remain for hard reload/close; forced session expiry, browser/process crashes and unmounts from live domain changes do not provide offline recovery.
- Consultant authoring is not yet registered: add durable draft recovery, conflict handling and navigation integration there next. Upload recovery, draft version review and retention/discard controls remain open.
- Complete response-aware preview, path/multi-Plan lifecycle, independent-session realtime proof and the full production roadmap. This is not a production acceptance checkpoint.

All work remains in the Astra checkout, branch, runtime and synthetic data. No push, merge, deployment or external notification occurred.
