# Sprint 8.1 completion

- Start: `63c6d790adeed1aeff8ebbcf301260fa3d2b3848`
- Implementation: `fbc94313d3fff8aa5894332c6b23b03dae78b28a`

Added forward migration `20260902162843_consultant_review_draft_workspace` with versioned `ReviewDraft`, explicit `ReviewDraftOverride`, and governed `ReviewVerificationException`. Source/AI artifacts remain immutable; materialized profile values layer attributed overrides over source facts. Context fingerprints cover report, artifacts, Goal, cards and ClientUpdates. Optimistic draft versions reject silent concurrent edits; stale context and unresolved blocking exceptions are deterministic publication blockers.

Checkpoint correction: the original statement described the domain-model and helper boundary, not a complete application implementation. The Phases 6–8 accumulated checkpoint adds the missing persisted CRM-11 query/command service, canonical capability and client-scope routes, secure source projection, versioned override and exception operations, and the real Source/Profile/Attention workspace UI. Application-boundary proof is recorded in `docs/execution/checkpoints/phase-6-8-accumulated-checkpoint.md`.

Focused proof: 4 workspace tests plus 8 durable Phase 7 regression tests passed. Consultant-only capability/client scope fails closed, including Admin role alone. Override actor/reason/source provenance is retained. No Analysis, Recommendation, publication, client Credit Center, or Phase 9 Plan work was included.
