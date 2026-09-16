# U1 batch 18 — Plan action availability agreement

Baseline f5e3b36; independent Astra branch only.

Shared Plan summary now retains safe action disposition on the selected next item and considers response-form configuration when choosing it. A usable completion step takes priority over a help-only misconfigured form. If only the latter remains, shared focus offers Ask for help with this step with an exact item link and explains why completion cannot be submitted. Raw form diagnostics are excluded from the summary. Stale Plan, restriction and Live precedence remain intact.

The response form now honors explicit server canRespond/canSubmitCompletion/canRequestHelp denials both in buttons and the submit handler, preventing keyboard form submission from bypassing disabled completion. Help remains possible when allowed. Existing page-level fail-closed availability checks remain. Optional flags in the reusable response component retain compatibility for consultant preview/test callers; this is not the final global availableActions DTO.

## Verification

- 55 API projection/availability tests pass, including usable-step priority, help-only exact-item navigation and diagnostic exclusion.
- 31 API integration tests pass on isolated DB5446/Redis6396: Plan service and execution, publication/recovery/verification behavior.
- 25 web tests pass: response flags including direct form submit, allowed help, saved drafts and Plan pages.
- Five-package build and root lint pass.
- Isolated browser desktop/mobile regression: exact-step navigation, saved response resume, keyboard focus and unchanged values under blocked collection storage, empty Guidance, no overflow or page errors. Non-read requests blocked after synthetic login. Captures retained privately in .tmp/astra-runtime/u1-availability-browser; no visual redesign claimed.
- Only ownership-verified Astra API restarted after successful checks.

U1 remains NOT PASSED. Comprehensive final-domain action/blocker contracts, full persisted scheduling/Live lifecycle coverage and reference-state/accessibility acceptance remain open. No new lifecycle or permission policy, no deployment, and no changes to other branches/resources.
