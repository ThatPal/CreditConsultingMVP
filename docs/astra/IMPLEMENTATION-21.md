# Pass 21: Queue-to-Plan navigation and review continuity

Grouped navigation repairs address legacy work items that opened the default Plan and response links that selected an unrelated first step.

## Delivered

- Work-queue read projection resolves PlanItem/PlanVersion sources in two batched reads for the page. Each resolved source is matched back to its row's client. Malformed IDs are excluded from UUID queries; absent/mismatched sources return unavailable navigation rather than an old/default link. Other work families are unchanged. Historical records are not rewritten.
- PlanItem links include the stable step key, so a newer version's different item ID does not break focus. New Plan response work items use the same URL form.
- Response review opens the linked step in All steps, including completed work. A missing/hidden step explains that it is unavailable rather than silently selecting another response. The Plan editor remounts response review when the requested step changes, after normal router navigation protection.
- Consultant messages remain in local component state when changing review filters or steps. Unsent notes and pending review writes participate in navigation protection. These notes are not autosaved or durable across reloads in this pass.
- Work Queue disables unavailable source actions, including the highest-priority shortcut.

## Evidence

All seven Plan API suites pass: 51 tests. New resolver unit coverage checks batched reads, legacy URLs, encoding, malformed IDs, cross-client mismatches, unrelated work and no mutation of input records. This is helper coverage, not full queue-route integration proof. Twelve distinct web cases pass across runs: response review, work queue and navigation. Added stable step focus, missing step behavior, retained notes/navigation guard and unavailable queue actions.

API and web each built once in one grouped build run; both passed. Scoped lint and whitespace checks pass. Existing pg deprecation and bundle warnings remain. No migration. Verified Astra API alone restarted; readiness checked separately. Protected branch heads remain unchanged. No new authenticated consultant browser or accessibility evidence; MFA qualification remains open.

## Remaining

Published-Plan handoff/replacement policy is still open; this pass does not supersede Plans or change client publication selection. Durable consultant-note recovery, broader route integration/browser evidence and other A5/roadmap work remain. A1/A2/A5 remain in progress. Continue in grouped feature batches with builds at the boundary.
