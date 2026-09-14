# Astra implementation pass 13: Response-form publication preview

Continues pass 12 on `codex/astra-production`.

## Delivered

- Consultant publication preview now includes disabled client response controls, required indicators, descriptions, number/text constraints and choice labels. It shows the default client-report question and consultant-verification guidance, optional acknowledgement notes, and ownership explanations for staff/system checkpoints.
- A read-only POST preview endpoint interprets a bounded batch of schemas through the same clientResponseForm function used by the published client projection. It requires consultant role and client-scoped review.read capability, and performs no Plan writes.
- The web preview batches the Plan in one request, caches by client and exact schema payload, and only enables the request while previewing. It handles load/error/retry and invalid forms explicitly. Private rationale is not sent to this endpoint or included in the client preview.
- Preview controls cannot submit responses, select files or upload documents. Existing explicit draft save and approval remain separate.

## Evidence and remaining work

- 14 focused API tests pass across preview authorization/projection and existing response validation suites. 10 focused web tests pass across preview and consultant editor suites. Coverage includes batched required controls, bounds, invalid schemas, no submission button, role/client access and default report fields.
- API and web builds, targeted ESLint and whitespace checks pass. Existing web bundle-size warning remains. A malformed preview response initially crashed an editor test; it now takes the retry path and the affected suites pass.
- Restarted only the recorded Astra API process after matching its PID to port 3015 and checking Astra environment targets. Readiness confirms PostgreSQL and Redis ready. No migration or other runtime restart occurred.
- Authenticated consultant browser/visual verification remains pending the MFA challenge documented in pass 10. These previews have automated component/API evidence, not completed browser qualification.
- This is response-form inspection, not an interactive simulation of path activation, prerequisites, saved responses, corrections, live progress or replacement-version transitions. Complete those preview/lifecycle states and the remaining full roadmap. No production wave is complete.

All work remains in Astra; no other project version, real-client record, external service, push, merge or deployment was changed.
