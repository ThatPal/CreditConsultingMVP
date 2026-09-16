# U1 batch 19 — One authoritative Plan focus

Baseline 5c5b50c; independent codex/astra-production worktree. Web reference-slice changes only.

The Plan hero previously displayed workspace focus but could also promote summary.nextClientItem as a second primary action. Live/Major/appointment focus could therefore compete with an unrelated Plan step, and help-only forms lost the server's specific action wording. The hero now uses only the server currentFocus destination and actionLabel. Same-item navigation still restores keyboard focus. The roadmap and individual response availability remain intact; a focus choice does not invent new response permissions.

The unpublished Plan state previously returned before rendering workspace guidance. It now displays the same CreditNextStep component as Credit Center, retaining the server-selected next step and saved response library. The existing Center component was extracted without changing its source, counts, styling or command behavior.

## Evidence

- 29 web tests pass across PlanPages, PublishedCreditCenterPages and SavedPlanResponse. New cases cover Live and Major precedence, exact help-only action wording, one hero link, and next-step visibility without a Plan publication.
- Broader test run found an existing expiry assertion still matching retired copy. Updated it to assert current expiry wording and unchanged approved analysis; all four Center tests pass.
- Five-package build and root lint pass.
- Six isolated browser response fixtures (Live, Major, no published Plan at desktop1440/mobile390) verify one hero CTA, exact server destination and no overflow/page errors. Empty fixture counts adjusted to reflect no publication. Private captures under .tmp/astra-runtime/u1-focus-*; mobile empty state inspected.
- Real synthetic Plan desktop/mobile recovery check: roadmap/exact-step navigation, saved-response resume, keyboard focus and unchanged values with collection storage blocked, reduced motion/touch targets, no overflow or page errors. All non-read requests blocked after login.

No API restart, schema change, real service mutation or other-version change. Vite serves the tested web changes. U1 NOT PASSED: final source/action contracts, full persisted scheduling/Live lifecycle evidence, complete reference-state/accessibility acceptance and later-wave domain reconciliation remain outstanding.
