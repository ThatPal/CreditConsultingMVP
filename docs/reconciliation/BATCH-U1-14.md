# U1 batch 14 — Shared Profile currentness explanation

Baseline `d33bf92`; independent Astra branch. KEEP server profileCurrentness/workspace projection and Plan permission/recovery engine; RECONCILE the three reference surfaces' currentness explanation. F04/F05/F14 progress is limited to consistent presentation, not final domain closure.

The server already returns the same Profile currentness DTO on Home, Center and Plan. Home's local TypeScript type dropped reason/currentness, Plan omitted a Profile explanation, and Center collapsed most reasons into generic copy. ProfileCurrentnessNotice now consumes the server result across all three:

- EXPIRED: saved facts remain available; consultant reassessment is needed.
- BASIS_UNCONFIRMED: publication source is not confirmed against current Profile.
- REASSESSMENT_REQUIRED: publication remains saved while changes need review.
- Missing publication/current/review-in-progress do not invent a stale-publication warning. Unknown stale reasons receive conservative copy.

No browser clock expiry calculation, lifecycle table, automatic command or permission inference is added. Per-item availability and Plan stale/source fences remain authoritative; Profile notice never disables inputs or discards answers. Publication date is labeled as publication, not report date. Client-friendly explanation avoids internal reason-code display.

27 focused tests pass (reason/no-publication/current/invalidated-clock presentation, Home, Plan, live update recovery). Root lint and five-package build pass. Six isolated browser states at desktop/mobile cover Home/Center/Plan with identical EXPIRED response fixtures; each contains exactly one matching explanation, no overflow or page errors. Evidence: `docs/evidence/u1-currentness/`. Fixtures modify read responses only; backend records and user sessions remain untouched. Existing non-read API blocking after login remains. The script inherits a Support-context summary flag; that flag is not a new Support assertion in this pass.

Reviewed mobile Plan currentness/next-step/completed-history layout. Browser fixture coverage proves shared rendering, not new server expiry integration. Earlier server projection tests remain the source evidence. Full source/blocker/available-action/Live/Major precedence contracts, currentness when Plan is absent, and exhaustive reference states remain open. U1 NOT PASSED.
