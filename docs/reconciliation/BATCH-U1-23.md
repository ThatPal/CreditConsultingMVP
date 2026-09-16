# U1 batch 23 — Reference-state matrix and explicit focus ownership

Baseline 8e2e0cc; independent Astra. KEEP server projection and response authority; RECONCILE owner presentation across Home/Center/Plan. Supports F04/F05 cross-surface truth and F20 verification without declaring full production qualification.

Home already labelled the next-step owner; Center and Plan relied on descriptive prose. A shared FocusOwner component now labels CLIENT, CONSULTANT and SYSTEM consistently across all three surfaces. Missing/unknown ownership is Being confirmed, never silently assigned to the client. Staff wording retains Client/Consultant labels. No business-state or permissions are derived by this component.

## Evidence

- 42 browser checks: seven states × Home/Center/Plan × desktop1440/mobile390. States: available Plan action, expired Profile, awaiting verification, stale Plan, Major restriction, active Live and paused Live. Each verifies focus title, explicit owner, exact CTA destination, expiry notice agreement, one h1 and no horizontal overflow. Center/Plan Action counts checked in each state; an additional 14 Home checks verify displayed remaining/completed counts (stale Plan correctly displays review context).
- Real authenticated baseline reads agree on Home/Center focus and Profile currentness and Home/Plan Action summary. State combinations then use controlled responses built from the production focus and Plan summary functions with synthetic Plan/context records. This verifies presentation/composition, not 42 persisted domain transitions. Batch22 supplies complementary persisted source/command evidence.
- Results: docs/evidence/u1-reference-matrix/results.json and home-counts.json. Captures are private under .tmp/astra-runtime/u1-matrix; two reviewed mobile examples are retained with the result artifacts. No real service mutations; synthetic account, isolated browser context, non-read requests blocked after login.
- 23 component/reference-page tests pass, including client/consultant/system/unknown ownership and staff labels. Five-package build and root lint pass.
- Harness initially requested API data from the Vite origin and received HTML; corrected to the isolated API3015 origin. No production code change was needed for that test setup error.

T1's selected reference-state presentation matrix is verified. This is not full V2 state coverage or V3 accessibility acceptance: no-Profile, loading/error, completed/historical state combinations, full keyboard/focus-return and contrast checks remain. T3 final blocker/action contracts and V4 Decisions/Nurture disposition also remain open. U1 NOT PASSED.
