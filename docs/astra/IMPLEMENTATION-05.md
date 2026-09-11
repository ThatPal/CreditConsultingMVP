# Astra implementation pass 5: Help resolution and ongoing review access

Date: 10 September 2026. Continues pass 4 on `codex/astra-production`.

## Delivered

- The consultant's published-work panel now separates Needs attention from All steps. Help requests appear alongside pending verification. Completed and in-progress steps remain accessible through All steps after the attention queue clears; response and attachment history is no longer hidden by the absence of pending decisions.
- Consultants can send required, client-visible guidance and reopen an UNABLE client-owned step. The existing review capability and step-up checks protect this action. It locks the Plan, checks active version/ownership/status and the exact latest outcome ID, records HELP_RESOLVED, clears attention work, and emits audit/outbox events in the transaction.
- Reopening returns the step to IN_PROGRESS with no completion timestamp and does not unlock its dependents. The client sees the guidance above the response form and can continue or request help again. Repeated help cycles retain distinct requests and replies.
- Help requests on guidance steps no longer set an acknowledgement timestamp. Only actual completion acknowledges the guidance.
- Consultant reply text is scoped to the selected step, avoiding a reply being carried to a different step after a refresh changes the default selection. History-only steps expose no decision controls.
- Client waiting copy now says Help requested and explains that the consultant will reply before the client continues. Removed misleading reference to completed work where nothing had been completed.

## Validation

- 31 API tests pass across five Plan suites, including repeated help/reopen cycles, required guidance, stale-reply rejection, foreign-client scope rejection, no false completion/acknowledgement, attention resolution, and prerequisite protection until actual client completion.
- 16 web tests pass across five focused Plan suites. Added coverage for required guidance, evidence-bound RESUME requests, no verification action for help requests, and access to completed history without decision controls.
- API and web production builds pass; targeted ESLint and whitespace checks pass. Existing pg concurrency and web bundle-size warnings remain.
- Real browser verification used a new Plan on the existing synthetic Astra QA client, not the Jordan demo Plan. Exercised client help request, consultant guidance/reopen, resolved history in All steps, client guidance display and subsequent completion. Inspected the mobile reply layout. Sessions switched roles sequentially; independent-session realtime delivery and full accessibility/device qualification remain open.
- No migration required. Restarted only the verified Astra API on port 3015; PostgreSQL/Redis readiness is healthy. Other branches, runtimes, and data remain untouched.

## Next work

1. Paginated/exportable history: the UI still exposes only the most recent 20 events per stable step, with truncation labeled. All steps refers to the selected published Plan, not all historical Plans or every event. Multi-Plan and path lifecycle navigation remain open.
2. Durable response/draft recovery across navigation and reload, including uploads, plus response-aware publication preview.
3. Independent-session realtime proof, full failure/retry/accessibility qualification, stale/archived/cancelled lifecycle behavior, and production document protections from pass 4.
4. Continue the full roadmap. This increment does not make the overall service production-ready.
