# POAR Rebuild D4 — Client Utilities & Continuity

## Boundary

- Branch: `rebuild/authenticated-product-poar`
- Accepted start: `b25d1763ccb0c22ef0f072c7c150dfe831e0e1e0`
- Implementation boundary: `e418580`
- Scope: Documents, Notifications, Support, Account/Profile, governed Data & Privacy requests, Security/Sessions, and authentication-return continuity.
- Guardrails: protected files remain server-authorized; notification destinations are client-route constrained; Support attachments remain canonical Documents; session actions retain governed confirmation; no raw storage/provider/session secrets are exposed.

## Independent findings

| Finding | Severity | Evidence before correction | Disposition |
| --- | --- | --- | --- |
| CPOAR-D4-001 | P1 | Notification filters were component-local, so returning from a deep link reset the inbox context. | Corrected by making the filter URL-backed and preserving the inbox state in navigation history. |
| CPOAR-D4-002 | P1 | Notification destinations were trusted directly by the client router. | Corrected with a tested client-route allowlist: only `/app` destinations are followed; external, CRM and Admin destinations fail closed. |
| CPOAR-D4-003 | P2 | The 20-item notification page and document history used ordinary page flow despite high-volume fixtures. | Corrected with explicit bounded/load-more `CollectionSurface` choices on desktop and normal document flow at narrow width. |
| CPOAR-D4-004 | P2 | Document and notification rows did not participate in the shared collection keyboard contract. | Corrected with semantic collection items and Arrow Up/Down navigation support inherited from D1. |
| CPOAR-D4-005 | P1 | Contextual Support prefill existed, but safe navigation or attachment selection could discard a new-case draft; list search/filter/page state was not URL-restorable. | Corrected with session-scoped draft preservation, explicit clearing after successful creation, and URL-backed list state. No canonical saved Support data moved into device storage. |
| CPOAR-D4-006 | P2 | Client Security displayed the full raw user-agent string after already presenting a human device label. | Corrected by retaining the useful browser/device description and replacing raw metadata with current-session or revoke guidance. |
| CPOAR-D4-007 | P2 | Account/Profile wording did not sufficiently distinguish contact identity from the financial Credit Profile, and save confirmation did not explain effect. | Corrected with explicit separation and consequence-oriented success copy. |
| CPOAR-D4-008 | P2 | The product has no independent privacy-request domain; the supported governed process is a typed Account Support case. | Refined, not broadened: Account now retains the honest governed Support handoff and Support history as the request timeline. No instant export/deletion workflow was invented. A dedicated privacy domain remains a future product decision, not a D4 blocker. |

No P0 issue was discovered. Existing drag/drop validation, secure preview, canonical Support attachment, idempotent case creation, session revocation, return-path sanitation and MFA/reauth handling were preserved.

## Screen and collection acceptance matrix

| Surface | Purpose/state/owner/action | Collection decision and convenience | Visual/content/accessibility |
| --- | --- | --- | --- |
| Documents | Explains protected library purpose, file category, status, date/type/size and safe recovery. Upload remains the client action. | Bounded desktop evidence collection with sticky collection frame; URL-backed search/type/status/page; narrow returns to document flow. Drag/drop/file-picker validation and in-context modal preview remain canonical. | File iconography, upload drop zone, status chips, safe empty/error copy, keyboard-addressable rows and protected preview. |
| Notifications | Explains what changed, why it matters, freshness and read state. Exact safe destination is the action. | Bounded load-more inbox; URL-backed All/Unread/Support/Documents/Security filters; browser Back restores the filter and collection scroll. | Domain iconography, truthful unread emphasis, accessible buttons, safe recovery and no raw event codes. |
| Support | Names category, priority, context, status and whether the client or Support owns the response. | Responsive inbox/detail workspace; server pagination/search/status; URL restoration; sticky narrow return; session-scoped new-case draft; scalable existing-document picker plus drag/drop upload. | Differentiated conversation bubbles, context disclosure, staff-only notes absent, retry-safe composer and explicit submit requirements. |
| Account/Profile | Clearly separates communication identity from financial Credit Profile and confirms the effect of saved values. | Grouped editable identity/contact/timezone controls; governed links to privacy and Security; existing business/relationship context retained. | Human labels and validation, timezone smart default, success/error feedback and responsive grouping. |
| Data & Privacy | Explains review, legal/security/payment/retention constraints without promising instant export or deletion. | Uses the supported contextual Account Support case and its conversation history as the governed request center/timeline. | Calm trust language, smart subject/message prefill, explicit tracking location and no raw database export. |
| Security/Sessions | Identifies the current session and explains revoke/sign-out consequences. | Governed one-session/current/other-session actions with confirmation; list is intentionally direct because the client fixture is small and personal, not an operational table. | Human device/browser label, current-session emphasis, no raw user agent, clear retry/denial and consequence language. |

## Continuity and browser proof

- `/app/documents` rendered 25 deterministic records, desktop bounding, search/type/status/page controls, drag/drop/file picker, current/previous-version state and modal preview actions without exposing storage metadata.
- `/app/notifications?filter=unread` restored Unread directly from the URL and rendered action/update variety with load-more behavior. The tested route guard rejects external or privileged destinations.
- `/app/support?new=1&category=DOCUMENTS&contextType=DOCUMENT&contextId=…` opened the contextual composer with Documents selected, disclosed the attached context boundary, exposed scalable existing-document selection and canonical attachment upload.
- `/app/account` clearly separated contact identity from financial Credit Profile and provided the governed Data & Privacy Support handoff and history explanation.
- `/app/account/security` identified Chrome on Windows as the current session, showed signed-in/last-active/expiry facts and precise sign-out/reset actions without raw user-agent leakage.
- Reauth/MFA deep returns remain covered by the accepted protected-route/Auth tests, including query/hash preservation and safe return-path sanitation. D4 did not alter those security boundaries.
- D1 collection behavior restores scroll in session storage, supports keyboard row traversal, and disables nested collection scrolling at narrow width; D4-owned lists now opt into that contract deliberately.

## Verification

- Focused D4 Web: 3 files / 19 tests passed for Documents, Notifications and Support, including upload attachment/idempotency and exact destination safety.
- Full Web: 29 files / 117 tests passed.
- Affected API: 12 files / 56 tests passed across authentication/authorization, Documents/storage, Notifications/email and Support/AI boundaries.
- Fresh isolated Credit-only database: all 66 migrations applied and canonical system seed completed on `credit_strategy_d4_ci_0907`; no Behfar resource was used.
- Repository lint, typecheck and all production builds passed. The existing Vite large-entry warning remains informational.
- Exact-final-head GitHub CI: immutable result supplied at handoff after the report boundary is pushed.

## Deferred non-blocking items

- A standalone first-class privacy-request domain would require explicit product/policy decisions about supported request kinds, retention exceptions, ownership and fulfillment states. Owner: product/security/legal; earliest suitable scope: post-rebuild planning. The existing governed Support process remains usable and honest.

## Acceptance

D4 completes the client utility layer with deliberate high-volume collections, protected previews/uploads, restorable inbox and Support context, clearer account/privacy guidance, and understandable session control. D5, Phase 18, public-site and deployment work were not started; `ai-enabled` was not modified.
