# Admin browser audit completion

Completed on 2026-09-10 after the user explicitly authorized enrolling MFA on the isolated demo Admin account. Astra-only runtime; no changes to the other project versions. The ordinary password → authenticator enrollment → TOTP verification flow succeeded, and the Security Events screen recorded enrollment and challenge success.

**Scope:** 36 route observations across 31 distinct Admin paths, plus settled-state reads, a service-creation form, a settings confirmation dialog (cancelled), a retention dry-run preview, desktop Reports screenshot and 390×844 mobile Dashboard screenshot. The viewport override was reset. Existing implemented Admin surfaces are now browser-inspected; missing catalog product-management and non-payment integration-detail experiences remain missing. This is not full transactional or production acceptance.

## Additional confirmed findings

| Finding | Evidence | Consequence / roadmap |
|---|---|---|
| F21 · P1 · Catalog conflict count omits actual conflict states | Catalog showed 3 `CONFLICT` candidates. Dashboard/System Health showed 0 conflicts and Healthy. `operations/routes.ts:303` counts only `status: PENDING` with `materialConflict: true`, excluding `CONFLICT`. | Staff can miss blocked catalog maintenance. Use the owning domain's unresolved-conflict projection; verify Dashboard, queue and health agree. A2/A6/A10. |
| F22 · P2 · Client detail exposes staff-only controls | A CLIENT record shows an empty Staff role selector, “MFA enrollment required for staff access,” and an enabled Reset staff MFA button. `AdminIdentityPages.tsx` renders the staff panel unconditionally. No reset or role change was attempted. | Misleading and inappropriate action affordances. Role-specific detail panels and meaningful validation; keep server authority enforcement. A10. |
| F23 · P1 · Catalog approval lacks evidence review and conflict resolution | Source candidates show name/source/match/status and Approve and publish. No field values/diff/source evidence, resolve/link/dedupe actions or product-management detail route. `CardCatalogPages.tsx:444–506` directly posts approval with the fixed reason “Reviewed against governed source evidence.” No publication was attempted. | Human approval is nominal if the interface never presents the facts to review; blocked conflicts have no operational exit. Complete candidate-v-current workbench and actual resolution path. A6. |
| F24 · P2 · Gateway configuration is not discoverable from Payments | Sidebar “Payments & gateways” opens `/admin/payments`, whose loaded content includes ledger/refunds/disputes but no gateway links. All three provider detail routes work when entered directly. Source navigation mentions them only as route matches. | An operator needs a known URL to reach setup. Add provider overview/detail links and complete guided setup. A9/A10. |

These supplement F01–F20; they do not replace the initial baseline. No security exploit or backend authorization bypass was demonstrated.

## Existing findings confirmed and refined

- **F16:** Workflow Rules, AI Processes and Notification Templates offer disabled-version creation/history without a complete review/test/activate flow. Non-payment Integrations offers a status/toggle, not a connection/configuration workbench. All observed directly.
- **F17:** Reports displays record counts and status-group counts, including a large “Operational record groups: 8” hero. It does not expose revenue or delivery/bottleneck analysis. The desktop screenshot confirms repetitive cards and nested sections; initial loading zero values were not treated as final data.
- **Commerce is partially implemented, not wholly absent:** three seeded service products exist; Credit Review is active, Round and Major are inactive. These are fixture configurations, not approved launch pricing. All three gateway details explicitly show unavailable credentials; BofA correctly labels status retrieval/refund/reconciliation unsupported. No real connection test was run.
- **Attention copy uses the wrong measure:** an open dispute triggers payment attention while the displayed value is 0 pending payments. The warning is justified by the dispute; the headline number fails to communicate the reason. System Health's positive “core” message is scoped to its platform summary, not proof that all modules are healthy. Make these distinctions obvious.
- **Useful safeguards exist:** the settings change preview shows current/proposed state, scope, timing, reversibility and audit evidence, requires a reason, and was cancelled without applying a change. Service creation opens a draft form. Staff sessions show current session, timestamps and revoke controls. Insight review appropriately withholds professional approval from the Admin role.
- **Retention is narrow:** only an expired-session policy is visible. Preview completed and recorded `PREVIEW · 0 records`; Execute stayed disabled. No deletion occurred. Broader retention/holds/request fulfillment remain A10/A12 work.

## Coverage by contract

| Contracts | Browser evidence |
|---|---|
| ADMIN-01 | Dashboard desktop/mobile and loaded attention summary |
| ADMIN-02–04 | 27-user directory, selected CLIENT detail, grant creation fields and empty grant history |
| ADMIN-05–06 | Three-product list, draft-creation form (not submitted), current Credit Review product/version form |
| ADMIN-07–10 | Three-payment ledger/refund/dispute history, partially refunded PayPal detail, all three provider detail pages; provider overview navigation absent |
| ADMIN-11–13 | 16 source candidates including conflicts, missing full product/offer editor, internal insight with Admin approval restriction |
| ADMIN-14–17 | AI jobs, succeeded job detail, process versions, source registry |
| ADMIN-18–22 | Rule/template/integration/scheduler screens; non-payment integration detail absent |
| ADMIN-23–27 | Audit/security lists and individual events; retention preview; settled reports; settings confirmation/cancel |
| Additional routes | System Health, Admin Account, Security & Sessions |

All 31 inspected paths correspond to the currently implemented Admin route set with representative dynamic records. Different users/products/payments/job failure states were not exhaustively exercised. No refund, permission change, catalog publication, rule/template activation, integration enablement or scheduled execution was performed.

## Audit changes and continuation

The only persistent application-state changes during this follow-up were the authorized demo Admin authentication/MFA records and the retention preview record. The demo MFA setup information is saved in the ignored local runtime directory for future test access; it is not included in Git or the audit artifacts. Authentication controls were not weakened.

The previous MFA approval blocker is resolved. The audit and roadmap can proceed to A1/A2 when the user authorizes product development. These additional findings strengthen existing wave requirements rather than expanding into unrelated scope.
