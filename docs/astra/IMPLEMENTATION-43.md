# Pass 43: Owner-targeted private draft notifications

## Delivered together

Saving or discarding a private Plan response now records an outbox event inside the same database transaction. Events have stable keys based on draft identity/revision, contain client/recipient/domain routing metadata, and do not contain notes, answers or attachment lists. Rejected writes do not add a save event; repeating an already-completed discard does not add another discard event.

The new plan-drafts domain refreshes only private response queries and the draft library. It does not refresh the whole Plan or create consultant work/notifications. The existing conflict-review UI retains local answers while a newer saved revision is reviewed.

Worker envelope construction preserves the target account and rejects private draft events whose recipient or domain is missing/invalid. The API transport retains that recipient through Redis and the in-process bus. SSE delivery requires the active owning client account in addition to the existing authenticated client access checks. Socket.IO uses the targeted user room and the same audience predicate before emitting; staff roles, different accounts, wrong clients and disabled principals fail the audience check. Missing recipients on private-domain events fail closed.

## Verification

Thirty-seven distinct focused tests passed: 18 API cases (14 database-backed Plan execution cases plus 4 event/audience cases), 6 worker cases and 13 web cases. The existing database suite now checks private save payloads and absence of extra events on rejected saves. The discard case was rerun after adding assertions for one owner-targeted event across discard/repeat. Worker tests verify private content is not copied into the envelope and malformed recipients are rejected. Web coverage drives the targeted draft domain through local-text preservation and explicit conflict review.

Scoped lint and whitespace checks passed. API, worker and web builds passed; the web build used the Astra API URL. The known pg concurrent-query deprecation warning remains in integration tests. Only verified Astra API and worker processes were restarted, API first; readiness passed. No migration was required.

A fresh browser run used separate contexts for two sessions of the synthetic draft owner and a third synthetic client account. The first owner session opened its existing draft and typed local text; its outgoing saves were deliberately blocked only in that test context. The second owner session saved a different note through the real API. The committed outbox/worker/SSE path refreshed the first session, preserved its local text, and offered explicit review. Keep local answers retained the text; Load saved response then showed the new saved note. Both owner sessions received the private hint. The unrelated client received zero private-draft events, and received event objects contained no notes/values/draft content.

The original synthetic note was restored through the API afterward; its revision necessarily advanced. No Plan response was submitted and no publication, outcome, customer message or uploaded file was created. User-visible browser tabs and other worktrees were not used. Ignored browser script/results: .tmp/astra-runtime/private-draft-live-review.mjs and private-draft-live-results.json.

## Remaining and rollout constraints

The browser proof covers owner SSE delivery and a different client's exclusion. Staff exclusion and Socket.IO audience behavior are covered by the shared predicate and code path, not a new staff/multi-node browser qualification. Save acknowledgment ordering, simultaneous accepted writes, reconnect/first-connect gaps, queue replay/drain, browser suspension and related availability changes remain to be qualified. Existing revision/identity checks remain required.

This protocol must not be enabled across mixed old/new API instances: every receiving API must enforce private recipients before producers emit these events. Older worker/runtime versions can strip recipient metadata; updated APIs reject such private hints, but that is not a complete mixed-version rollout plan. Coordinated upgrade/rollback and operational evidence remain release gates. No production deployment was performed.

A1/A2/A5 remain in progress, including separate published-Plan replacement policy and full staff workflow qualification. This closes the missing owner-targeted save/discard notification path, not the overall production roadmap.
