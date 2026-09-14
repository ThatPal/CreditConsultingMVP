# Pass 44: Draft acknowledgment ordering

## Delivered

A delayed save acknowledgment previously wrote its response directly over the draft query cache, even when a live refresh had already observed a newer revision, deletion or recreated draft. The saved-response handoff now cancels obsolete query work without reverting its observed data, checks that the editor remains active, preserves a changed observation instead of replacing it with the acknowledgment, and requests the latest server snapshot.

The acknowledged result still identifies the form's accepted save. A newer observed result therefore keeps the existing explicit review prompt and local answers. A canceled older read cannot later roll the query cache backward. Each accepted save now incurs one confirmation read; this is a deliberate consistency cost, not a performance optimization. Query cancellation suppresses obsolete cache results; it does not claim to cancel an HTTP request at the server.

## Verification

Twenty-two focused tests passed: four new acknowledgment races, twelve saved-response cases and six pending-session cases. The races cover a newer revision, discarded draft, recreated draft identity, and an old read resolving after acknowledgment. The existing queued-autosave fixture initially returned its original value forever on GET; it was updated to persist accepted writes for reads. Queued edits still save against the acknowledged revision. Scoped lint, whitespace checks and the web build passed; API/worker code and runtime processes are unchanged.

The real-browser check used the existing synthetic review draft. Its first UI save committed through the real API, but only that test page held the HTTP response. A separate API request saved a newer note before the held acknowledgment was released. The live update exposed the changed draft; releasing the old response left the newer revision reviewable, and explicit reload displayed the newer note. The original synthetic note was restored through the API afterward, advancing its revision. No Plan submission, outcome, publication or document change occurred, and user-visible browser tabs were untouched. Ignored evidence: .tmp/astra-runtime/draft-ack-review.mjs and draft-ack-results.json.

## Remaining

This qualifies the bounded acknowledgment/cache races above, not every transport ordering or reconnect case. Staff/Socket.IO browser evidence, multi-node delivery, mixed-version rollout, browser suspension, confirmation-read outages under load, and broader workflow qualification remain open. Separate published-Plan replacement and A1/A2/A5 remain in progress.
