# U2 starting scope — identity, authorization and platform boundaries

Start from the accepted U1 commit on codex/astra-production. Preserve this independent worktree, Astra database/Redis/ports and branch history.

Authority: unified roadmap Cycle U2 and frozen identity/access/security contracts. U2 exit is a passing frozen security matrix, not simply new auth screens.

1. Reconcile Better Auth cutover and migration against current accounts, sessions, MFA, recovery and token/session fencing. Inventory old adapters and migrations before replacing them. Maintain existing recovery/session expiry behavior.
2. Build the role/capability/resource matrix: Client, Consultant and Admin; professional authority versus administrative access; assigned, delegated, expired and revoked grants. Trace enforcement across HTTP, realtime and protected files.
3. Fix role-safe account/user DTOs and screens, including F22. Admin status must not imply professional consultation authority. Recompose authentication/account/security/access screens using the U1 design system.
4. Verify assignment/grant expiry and revocation with persisted fixtures and actual denied requests, including active session/realtime/file access; retain drafts safely and never replay commands after reauthentication.
5. Run the identity/access critical-path security matrix, current U1 reference smoke checks, builds/lint and cross-role browser verification before closing U2.

Owning later waves remain U3 Review/documents/real AI and delivery; U4 global Plan/Nurture; U5 Cards/catalog; U6 Round/Strategy/Live/Major; U7 services/payments; U8 operations/admin; U9 whole-product design/copy; U10 production qualification. No deployment, payment or external-message action is implied by this handoff.
