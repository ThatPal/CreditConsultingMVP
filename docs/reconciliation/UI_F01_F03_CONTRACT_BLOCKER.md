# UI-F01–UI-F03 implementation preflight

Date: 2026-09-17. Status: stopped at the package's architecture-conflict gate; UI implementation has not started.

## Branch and scope

Created `ui/portal-shell-credit-center-overview` in the existing isolated Astra worktree from `codex/astra-production` at `bef53dcbae9b6ae090f90cdeef56cdc0d73740e5`. A fresh remote-head lookup found no literal `astra` branch. Other worktrees and branches were not changed.

Authorized scope is Global Client Shell, Credit Center Shell, and Overview only. No Credit Profile or later-section implementation.

## Specification authorities read

- [UI-F01 — Global Client Application Shell](https://docs.google.com/document/d/11bipfEaiNFvAQaKaMK6OwUbSTBK8qeTQ6-APmyUrtXs/edit): final sections 19–22 supersede the earlier mobile drawer wording; five bottom destinations and a More sheet are required.
- [UI-F02 — Credit Center Shell](https://docs.google.com/document/d/10BfncujABxS5jYS1JnwIk1TwFLvbm8gAnVOhAZi8kwI/edit): persistent desktop tabs, mobile Section sheet, truthful current-only Review context where historical composition is unavailable.
- [UI-F03 — Credit Center Overview](https://docs.google.com/document/d/1S4Fobq7s4L1vyg1yOlxN8RVKzhu9d07agolxdJdNutg/edit): sections 15–17 approve this combined slice and supersede earlier draft/do-not-implement status. Written corrections and parent shell authorities take precedence over the generated Overview image.

## Blocking conflict: publication consistency

UI-F03 §13.15 requires a single atomic Review publication boundary for immutable Profile, published Analysis/Findings/Recommendation, applicable Plan changes, and current Journey/Plan focus. It explicitly forbids exposing a new Profile with professional/Plan content belonging to the prior publication.

The current implementation does not provide that guarantee:

1. `apps/api/src/reviews/publishCreditReview.ts`, `publishCreditReview`, transaction starting near line 30: creates `CreditSnapshot` and `PublishedCreditReview`, completes the Review, updates `CreditProfileState`, closes work items, and writes notification/audit/outbox. It does not publish a Plan version or reconcile Journey/Plan focus in that transaction.
2. `apps/api/src/reviews/publishedCreditCenter.ts`, `getPublishedCreditCenter`: selects the latest immutable Review publication, then calls `getCreditWorkspace` independently.
3. `apps/api/src/workspace/service.ts`, `getCreditWorkspace`: obtains `getClientPlan` independently alongside publication/currentness/other workflow reads. Its own comment identifies this as read-only compatibility composition with source retirement deferred to later domain phases.
4. `apps/api/src/plans/service.ts`, `publishedPlan` near line 708: selects the latest eligible client Plan version independently, without tying selection to the Credit Center Review publication. This preserves current Plan behavior but is not the publication-wide consistency contract required by §13.15.

This is not merely a difference in table naming. A UI adapter could render existing values truthfully, but it cannot establish the required atomic publication invariant. Altering Review/Plan publication and focus reconciliation would change frozen domain behavior beyond a shell/Overview presentation slice.

UI-F03 §16 explicitly instructs: “If a contradiction is found, STOP and report the exact conflict instead of silently redesigning the model.” Implementation stopped at that gate.

## Other contract gaps to reconcile (not independent reasons to invent new models)

| Package authority | Existing compatible source | Limitation |
| --- | --- | --- |
| Published Profile facts | `PublishedCreditReview.clientSafeProjection.profile` and linked `CreditSnapshot` | Existing whitelist omits bureau model/range, metric calculation basis, and inquiry window. Missing metadata must remain unknown; reliable numeric comparisons cannot be assumed. |
| Published Analysis findings | Approved-only projection from `clientSafeReviewProjection` | Current emitted fields are code/title/summary/severity; canonical importance/order, supporting references, and why-it-matters are not exposed. Severity must not silently become professional importance. |
| Assessment/recommendation | Published projection `analysisSummary` and `recommendation` | Can render existing published wording without generating advice; package's separately versioned Analysis/Recommendation model is not present under that contract. |
| Current priorities | Existing server-side `getClientPlan` and summary | Full Plan records exist; the current Credit Center response exposes a summary, not the required top-three projection with publication consistency. |
| Lifecycle/currentness | Existing Credit workspace currentness and active Review query | Reusable authority for several required states; a new client-safe screen projection could expose the missing presentation state after the contract decision. |

## Concrete resolution required

Choose one explicit contract direction before implementation:

1. Amend UI-F03 for this UI slice to accept the current independently published Review and Plan authorities, with a documented compatibility mapping and honest unavailable/comparison states. Explicitly defer §13.15 and unavailable canonical metadata to the domain migration. This is the smallest presentation-focused route but does not satisfy the current package verbatim.
2. Keep §13.15 mandatory now and authorize a separate prerequisite domain slice to reconcile publication/version/focus contracts before implementing these three UI features. That prerequisite needs its own bounded specification and relevant integration checks.

## Changes and verification

Only this report was added. No application, API, schema, data, or existing inner-page content was changed. Branch identity, clean baseline, remote starting head, publication transaction, query composition, and Plan selection were inspected.

No tests/builds were run because implementation stopped before code edits. No implementation screenshots were captured: unchanged-screen screenshots would not constitute evidence of the requested slice. UI-F01–UI-F03 and their lifecycle/visual acceptance remain pending. No later tab work began.
