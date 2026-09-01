# PM-1 Product Maturity Audit — Wave 1

Status: READY FOR PRODUCT-OWNER MANUAL REVIEW. This audit covers accepted Phase 1–3 surfaces only.

| Surface / screen | Canonical owner / spec | Implementation and maturity finding | Classification | Correction or future owner | Manual-review notes |
| --- | --- | --- | --- | --- | --- |
| AUTH-05 staff MFA enrollment | Sprint 2.2 / AUTH-05 | Secure enforcement existed, but setup exposed only a raw TOTP URI and had no escape action. | FIX NOW | QR-first enrollment, secondary manual key, copy actions, preserved recovery codes and explicit cancel/sign-out. | Scan QR, verify six digits, retry an invalid code, then repeat and cancel. |
| AUTH-05 staff MFA challenge | Sprint 2.2 / AUTH-05 | Challenge enforced six digits, but a partial session could trap the user. | FIX NOW | Added session-terminating Sign out; existing retry, expiry and recovery messaging retained. | Sign in after enrollment, cancel challenge, confirm CRM/Admin remains inaccessible. |
| Client shell navigation | Sprint 2.3 canonical client IA | Navigation registry was flat; Support was utility, Services absent, Security duplicated Account, and `/app` stayed active on descendants. | FIX NOW | Primary Plan and Utilities groups; canonical Home, Journey, Credit Center, Cards, Services, Support; Documents, Notifications and Account utilities; Security nested in Account; exact root matching. | Review desktop and mobile at `/app`, `/app/journey`, `/app/support`, and `/app/account/security`. |
| Consultant CRM shell | Sprint 2.3 / CRM shell | Capability projection was correct, but hierarchy was visually flat and Security duplicated Account. | FIX NOW | Workspace and Utilities groups, capability-aware Support remains fail-closed, Account owns Security, exact Dashboard active matching. | Compare full consultant with a capability-restricted consultant; verify Work Queue remains persistent. |
| Admin shell | Sprint 2.3 / Admin shell | Authority separation was correct, but hierarchy and account/security placement were under-signaled. | FIX NOW | Administration and Utilities groups; Account owns Security; no consultant destinations introduced. | Confirm Clients, Work Queue, Support and CRM actions remain absent. |
| Live Sessions and Calendar | Later owning product packages | Foundation mounting points exist but mature workflows are intentionally not accepted scope. | FUTURE OWNER | Kept as clearly bounded foundation destinations; no Phase 4 behavior added. | Confirm labels do not imply completed live-session or calendar workflows. |
| Documents library | Sprint 3.2 / PORTAL-42 | Server pagination and filtering existed but controls looked generic and had weak range/filter feedback. | FIX NOW | Shared premium search/filter toolbar, clear action, active filter chips, loading/result feedback and strong range pagination. | Test 25 seeded records, search, type/status filters, clearing, paging, upload and viewer. |
| Existing-document picker | Sprint 3.4 support attachment UX | Bounded search worked but lacked filter summary, range feedback and consistent shared styling. | FIX NOW | Reused shared data-navigation and pagination controls while retaining five-item limit and accessibility. | Open from Support, search the 25-document set, filter, page and select five. |
| Client Support history | Sprint 3.4 / PORTAL-39–40 | Stable server pagination existed; search/status controls and page feedback were visually basic. | FIX NOW | Shared search/filter summary, clear filters, result count and range pagination. | Review active and resolved seeded cases, empty search, filters, adjacent pages and mobile detail/back flow. |
| Consultant Support inbox | Sprint 3.4 / CRM-22–23 | Operational tabs and authorization were strong; search/pagination were visually basic. | FIX NOW | Shared search/result treatment and range pagination integrated with existing operational tabs. | Review active, urgent, waiting and resolved tabs; verify restricted access remains fail-closed. |
| Work Queue | Sprint 3.5 / CRM-02 | Rich domain behavior existed; controls were a row of default fields with no active-filter summary. | FIX NOW | Shared search, active chips, one-click filter reset, loading/result feedback and range pagination. | Exercise mine/unassigned, urgency, lifecycle, claim conflict and Support deep links against seeded volume. |
| Notifications | Sprint 3.3 / PORTAL-41 | Current list and header inbox are mature for accepted bounded Phase 3 volume. | OPTIONAL POLISH | Added realistic review volume; no arbitrary search/filter controls introduced. | Review unread count, chronological ordering, mark-read and safe links with 31 seeded records. |
| Global search | Later canonical shell owner | No accepted cross-domain search contract exists in Phase 1–3. | FUTURE OWNER | Not implemented early. | Confirm no misleading nonfunctional global-search affordance appears. |

## Screen-by-screen review checklist

1. Sign in as consultant and admin separately. Enroll with the QR code, save/copy recovery codes, verify a code, and confirm CRM/Admin access. Repeat to test Cancel setup and Sign out.
2. On the client shell, compare Plan and Utilities on desktop and mobile. Confirm only the current route or owning parent has `aria-current` and a visible active treatment.
3. On Consultant and Admin shells, verify authority-specific navigation, Account-owned Security, keyboard focus, mobile drawer behavior and the absence of role leakage.
4. In Documents, search, filter, clear, page, upload and open a document using the realistic-volume dataset.
5. In Support, test client history, new upload, attach-existing picker, empty results, pagination and responsive list/detail transitions.
6. In Consultant Support and Work Queue, test operational filters, counts, range feedback, claims, access revocation and typed Support deep links.
7. In Notifications, verify unread count, safe chronological content, mark-read behavior and bounded links.

## Scope confirmation

- Only Credit project services and databases may be used.
- No Phase 4 functionality is included.
- No merge into `ai-enabled` is permitted before product-owner acceptance.
