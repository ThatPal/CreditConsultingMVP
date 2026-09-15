# Pass 59: Review wording, continuity and reading preview

## Source alignment

The active route uses ConsultantReviewWorkspacePage, not LegacyConsultantReviewWorkspacePage. The older readiness-derived summary is therefore not the active editor. Cached Business Strategy conversation material in sources/conversations/strategy-10.json describes distinct findings, recommendation reasoning, client-facing explanation, consultant editing/approval and publication; it also calls for downstream outputs to be reconsidered when source context changes. This pass follows those distinctions rather than introducing generic financial recommendations.

The active editor previously accepted raw outcome codes and used the entire analysis as its sole recommendation reason. It offered no meaningful client-reading preview and no retained reviewed-version context.

## Delivered

A dedicated analysis editor presents named recommendation choices, separate profile summary, client explanation and evidence-based reasons. Reasons use one line each and enforce the existing API limits of twenty reasons and five hundred characters per reason; the explanation uses the existing four-thousand-character limit. Approval preserves other analysis metadata rather than replacing the entire object with clientSummary alone.

The editor retains its reviewed draft ID/revision, preserves local wording when the server changes and requires explicit confirmation to load saved wording. Approval submits the reviewed revision. Pending operations freeze controls; errors retain the text. Section switches keep the editor mounted, and unapproved changes block publication. Navigation and browser unload use the existing unsaved-work safeguards. Failed background reads retain the editor, while authorization errors still hide the workspace.

A reading preview shows the summary, recommendation, explanation and reasons while editing and again from saved data in Publish. This is a preview of those text sections, not a complete replica of the final Credit Center. The Publish panel now describes the actual review action and no longer exposes a Phase 9 implementation note. Publication is paused for dirty analysis, unavailable/stale workspace data and pending/failed readiness checks.

## Verification

Six focused component tests passed across analysis editing and existing Review eligibility. New coverage verifies distinct reasons, metadata preservation, reviewed revision submission, explicit replacement, failed approvals retaining wording and bounds/unavailable-data gating. Scoped lint, whitespace checks, API compilation and the web production build passed.

A consultant signed in with MFA in an isolated browser context. Controlled workspace/readiness/approval responses tested the active route: section switches retained wording, dirty analysis blocked publication, a changed draft blocked approval, explicit reload restored saved text, and one approval request carried separate reasons plus original metadata. The mobile editor was visually inspected. Synthetic client/assignment records were removed with scoped cleanup.

These browser responses were controlled fixtures. No real report processing, analysis persistence or Review publication was performed in this pass. End-to-end database publication qualification remains open.

## Next

Finding dismissal and exception resolution still send canned reasons; replace these with explicit consultant explanations and reviewed decision context. Publication still needs richer approved-finding/source coverage, readable blocker guidance, frozen preview context and accepted/unknown response recovery. Long-lived tab restoration and the full production Review/report/AI pipeline remain open.

This advances the Review slice of the roadmap without declaring A4 or another wave complete. No API source, migration, runtime restart, push, deployment or other worktree changes occurred.
