# Pass 23: Consultant message recovery batch

Unsent consultant response messages previously survived filter changes but disappeared on reload, and their verification return link dropped the selected Plan/step.

## Delivered together

- Tab recovery for unsent messages, keyed by consultant, client and Plan. Records retain the exact item, evidence ID, title and update time. Copies expire after 24 hours and are cleared by existing logout/session-loss cleanup. No server save or client-visible message is implied.
- Local recovery status, browser-storage failure warning, browser-close warning and existing in-app navigation protection.
- Unsent-message drawer retains earlier/unavailable item text for inspection and explicit discard, without transferring it to another response.
- Changed evidence blocks sending recovered wording until the consultant explicitly reviews the latest response. Editing the wording does not silently update its evidence binding. Successful decisions clear only the submitted item's local copy.
- MFA return links preserve the selected Plan and stable response-step key.

## Verification

Four relevant web suites passed (30 cases), followed by the expanded response-review suite (10 cases), totaling 32 distinct cases across runs. New coverage includes reload recovery, changed-evidence send gating, successful-send cleanup, consultant isolation, orphan recovery/discard, expiration, storage denial and sign-out cleanup. The consultant/editor and navigation suites remain green.

One web build at the grouped batch boundary passed, with the existing bundle-size warning. Scoped lint and whitespace checks pass. API code is unchanged; no API rebuild, migration or runtime restart was needed. Other branch heads remain unchanged. This is component evidence, not authenticated consultant visual/accessibility qualification; that still needs MFA completion.

## Remaining

These copies are browser-tab recovery, not cross-device drafts or durable server storage. Closing the tab, signing out, expiration or cleared browser data ends recovery. Orphan notes are not automatically migrated between versions. Published-Plan handoff policy and broader A5/roadmap qualification remain open. A1/A2/A5 stay in progress; continue grouped feature batches.
