# Astra implementation pass 15: Paths and version lifecycle batch

Continues pass 14 on `codex/astra-production`. The user requested related features be developed continuously rather than stopping after each small checkpoint.

## Delivered together

- Path authoring: create named inactive paths, edit labels and lifecycle status, see membership counts/names and remove only unused paths. Existing step-membership editing is connected to these controls. Client-side validation explains the one-active-path rule, required-step reachability and protected progress visibility. Changes remain private until normal save/approval.
- Server progress protection: a revision cannot hide a previously visible step with recorded progress by making its paths inactive or retired. This is checked when saving and again at approval under the existing Plan lock. Client progress arriving after draft creation therefore cannot be silently hidden on publication.
- Version history: consultant/client-scoped, descending cursor pagination in batches of five, with dates and status. The drawer retains loaded versions on pagination failure and offers retry. Historical snapshots can be inspected with the readiness/form preview and compared to the current working copy without restoring, saving or approving them.
- Publication context: the builder reports the same published Plan selected for the client, including its version and stale state, separately from the private working version. Copy identifies paused source review and a different published Plan when applicable.
- Loading boundary: removed the consultant workbench re-export from the client page and lazy-loaded the consultant route with a loading fallback. The production build emits a separate workbench chunk (about 48 KB minified / 15 KB gzip). Other shared chunks remain part of startup, so the reduction in the index file alone is not a total loading-performance measurement.

## Verification

- All six Plan API suites passed (37 tests), followed by the expanded seven-test revision suite including the additional late-progress approval race and publication-context assertion (38 distinct API cases across runs). History coverage traverses seven approved versions, checks cursor boundaries and client isolation, and verifies progress remains intact.
- Affected web suites passed across runs: 44 Plan/navigation cases and four client-product cases. New coverage includes path creation/removal rules, reachability warnings, history pagination failure/retry, retained inspection, comparison without writes and distinct paused publication copy. The broader run exposed stale test fixtures missing consultant auth and current client response/draft DTOs; those were updated, and the asynchronous two-form test now waits for both forms to load.
- API/web production builds, targeted lint and whitespace checks pass. Existing bundle-size and pg query-concurrency warnings remain. No database migration occurred.
- Live client Plan inspected and fully reloaded after the loading-boundary change; Jordan's completed Plan still renders correctly. Astra API alone was restarted after PID/port/environment ownership checks. Other branch heads remain at their protected baselines.
- Authenticated consultant browser/visual/accessibility qualification still needs the MFA challenge completed; it is not implied by the API/component evidence. No MFA settings were reset or bypassed.

## Remaining work

Full multi-Plan selection and cancellation/replacement operations; source/readiness policy integration; broader graph/schema conflict resolution; cross-device/offline recovery and retention; independent-session realtime and operational qualification; consultant responsive/keyboard review. Path/status rules retain the existing server policy (available paths visible, at most one active path, required path-specific items on the active path); broader policy changes require source-grounded review.

A1/A2/A5 remain in progress and no production wave is declared complete. All code, synthetic test data and runtime changes stay in Astra. No push, merge, deployment or external customer action occurred.
