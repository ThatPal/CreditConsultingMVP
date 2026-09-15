# Pass 55: Goals editor continuity and valid saves

## Delivered

The Goals editor now retains the goal version the client opened. Same-version refreshes preserve local edits; changed IDs or revisions require an explicit confirmation before replacing them. A failed background read retains the editor and exposes a retry, while blocking a save based on unavailable current data. Unsaved navigation and browser unload are guarded. Controls, including custom MUI selects and sliders, are disabled during submission and its follow-up operations.

The existing update request included priority, which the strict PATCH route rejects. Updates now omit that creation-only field. Exact targets are checked for whole-dollar values between $5,000 and $250,000, with visible guidance matching the existing API contract. Shared navigation wording now applies to both Goals and Plan responses without instructing Goals users to find a nonexistent Save draft button.

## Verification

Ten web component tests passed across Goals continuity, canonical preferences and shared navigation protection. Three goal API route tests passed. Scoped lint, whitespace checks, API compilation and the web production build passed.

A fresh isolated synthetic client signed in through the real browser. An authenticated API request created its goal, another request updated it while local browser wording was unfinished, and a visibility event triggered normal query refresh. The page retained local wording, blocked stale saving, allowed cancellation of the replacement dialog, and loaded the newer values only after confirmation. A subsequent browser save persisted the final wording at version 3. The mobile form screenshot was visually inspected. Fixture records were removed with client-scoped cleanup.

The initial fixture creation omitted required canonical preference fields and correctly returned 400; the fixture was corrected. Initial component failures came from a mock returned as a beforeEach cleanup and an assertion ahead of mutation notification; the test setup now resets mocks and awaits pending state. The real browser check qualifies goal persistence, while failed reads and navigation protection were component-tested.

## Remaining

Save recovery is still incomplete: the goal update, follow-up read and application-cycle confirmation currently share the success handler. A successful write followed by a failed read/confirmation can therefore appear as a failed operation. The next batch should distinguish those outcomes, retain a stable retry identity where necessary, and verify cycle confirmation separately. Unsaved edits are protected while this page is mounted; durable restoration after closing/reloading is not delivered here.

Review publication content still needs reconciliation with the approved business sources. Goals, A1/A2/A5 and the broader roadmap remain in progress. Other worktrees and branch heads remain untouched. No API source changes, migrations, runtime restart, push or deployment occurred.
