# U1 batch 11 — Shared action progress and Home summary

Baseline `ea9ce4c`; independent Astra branch. Continues the user-requested richer visual direction. RECOMPOSE Home summary; REPLACE Plan's split desktop/mobile progress renderers with one shared presentation; KEEP canonical server counts, focus, drafts and commands.

## Changes

- Home financial summary becomes one continuous data surface, with Profile, Plan and conditional appointment columns separated by dividers and meaningful icons.
- Remaining Plan actions stay a distinct count. The server's existing `progressPercent` field is now explicitly consumed on Home and shown beside that count.
- Shared ActionProgressDisplay uses a gradient outer ring and fine inner ticks. Plan uses the same graphic on desktop/mobile; Home uses its compact variant. No percentage is calculated from client-side Plan items or submissions.
- Missing, nonfinite and out-of-range percentages omit the graphic. Zero is explicitly zero; no fabricated completed segment. Completion percentage has an accessible text equivalent.

## Evidence

28 tests pass: Home, Plan page, Plan live-update recovery and new progress boundary cases. Home regression deliberately supplies a server percentage inconsistent with count fields to prove it is consumed, not recomputed. Root lint and five-package build pass.

Isolated synthetic browser checks under `docs/evidence/u1-progress/`: Home, Center and Plan at desktop/mobile; scoped primary/secondary navigation; shared focus/count agreement; Plan exact-step destination, saved response keyboard behavior, reduced motion and blocked storage. Non-read API calls blocked after login; no submissions. Dedicated Home-summary captures inspect the changed below-fold section.

No API/schema/data changes or other-checkout edits. Existing server workspace adapter remains the owner; removal boundaries remain U3/U4/U6. This is F08 reference-slice progress with F04/F07 consistency preserved, not full finding closure. U1 remains NOT PASSED; blocker/action/Live/Major contracts and remaining reference-state acceptance are still open.

The extra desktop/mobile resize used for summary captures initially sampled overflow before the final mobile layout settled. Waiting two animation frames after resizing produced a clean repeat of all six viewport checks; no product assertion was removed.
