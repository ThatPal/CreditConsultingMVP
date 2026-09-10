# Recovered business requirements

This is an Astra reconciliation, not an edit to the older versions or the original Drive. Preserve the meaning of explicit user decisions; do not promote an assistant's completion claim into a business requirement.

## Authority and provenance

1. Current user request: independent Astra version; full premium product; audit then roadmap before implementation.
2. Explicit decisions in [Credit Consulting Business Strategy](https://chatgpt.com/c/6a8674b6-8234-83ea-9c77-c8be83c2ec9f), the user's preferred source.
3. Compatible later approved clarification in [Sprint 3.4 Review Status](https://chatgpt.com/c/6a95daa3-6144-83ea-aff6-9cf0497eb8a0), including the POAR material.
4. [Current project Drive](https://drive.google.com/drive/folders/1aRR5Mqbn_ZtAlK0TvKzEw4qD3UvRvQoI), read alongside the conversations. Individual document titles/IDs and retrieval hashes are in the manifest.
5. Repository code, tests and completion reports describe what exists, not what the product ought to be.

Current Drive contains substantial detailed material, especially [13 — Detailed Screen & UI Specification](https://docs.google.com/document/d/13BhbHPY8FEOFfPC7XEywe04OxLJvJ5RakB9DbPszKUo/edit). It is not uniformly bare minimum. The problem is uneven fidelity, conflicting versions and incomplete translation into implementation. The audit does not replace those details with another short MVP scope.

## Requirements to carry forward

| ID | Product requirement | Recovery / current mismatch | Delivery |
|---|---|---|---|
| R01 | One lifetime client and Journey, with seasonal/yearly cycles and ongoing Nurture | Do not create a new relationship each service purchase. Nurture has guidance, milestones and a valid next step, not a dead waiting page. | A2, A5, A9 |
| R02 | One primary desired credit amount plus preferences | Preserve amount and amount reached; distinguish existing credit from added Round credit. No promise of a particular outcome. “Target” wording was explicitly rejected in strategy turn `6e89a15f-92fd-41d6-bc1d-2d5477119870` (retrieved page 18). Drive 01 and UI still drift. | A1, A2, A4 |
| R03 | Preferences refine the goal | Personal/business scope, secured preference, 0% APR, fees, rewards and balance-transfer needs are structured preferences, not competing primary goals. Intake must capture the context needed later without repeating forms. | A4, A11 |
| R04 | Report, Profile, Analysis and Plan are different artifacts | Original source document; verified financial facts; interpretation; executable guidance. Publish client-safe versions together where the domain requires it. Do not expose draft AI/internal review data. | A3–A5 |
| R05 | Client supplies the supported Experian three-bureau report | Validate supported format, bureau coverage and source date; report date must match the client's entry or be corrected. Real processing and correction/reupload are required. Strategy turn `ffe9df34-d9ec-4c50-b655-a449f5e31e02` (page 14). | A3, A4 |
| R06 | Review eligibility follows newer source information | Strategy turn `e2818ca6-03c1-49b8-bbfa-48189a14f915` (page 20) rejects a hard 30-day gating model. Drive 01 still says 30 days; newer rules differ. Reconcile into one rule and test matrix. Do not silently expire professional guidance solely because a timer elapsed. | A2, A4 |
| R07 | Shared Review credits and service entitlements | Payment access, Review reservation/consumption, Round access and Major access must remain distinct, explainable and exactly-once. Do not mint access from a browser success redirect or failed processing. | A3, A4, A9 |
| R08 | Complete persistent card portfolio | Include personal, business, non-reporting, secured, unidentified and closed accounts; current limits/balances and correct source context. Complete the portfolio once, reconcile subsequent changes. Strategy pages 13/17 include explicit clarifications. | A4, A6 |
| R09 | Changes since report are separate from report facts | Ask only for material changes; preserve historical source facts. Resolve duplicates/matches with client/consultant verification, then update current portfolio and downstream freshness. | A4, A6 |
| R10 | One shared rich Plan engine | Actions, Guidance, Milestones; completion-mode forms; verification; branches/dependencies; conditional visibility; unable-to-complete; versioning and reconciliation diff. Reuse for Review, Nurture, post-Round and Major preparation. | A5 |
| R11 | Major application check before Strategy and before release | Mortgage/auto/student/other intention, timing and relevant changes trigger coordinated guidance; restrictions are enforced at every relevant command, not only a banner. Reassess after pause/material change. | A2, A7–A9 |
| R12 | Canonical governed Card Catalog | Controlled approved-source retrieval, normalization, deduplication, structured offers, images, freshness, conflicts, immutable versions, AI-prepared internal insights and human approval. Later canonical database decision supersedes the early Google Sheets staging design; do not recreate Sheets as runtime authority. | A6 |
| R13 | AI prepares useful client-specific professional work | Candidate brief, relevant research, comparisons, sequence/execution proposals and reconciliation deltas use exact authorized context. Consultant confirms/edits consequential professional decisions; normal preparation must not consist of stock text. | A3, A5–A7 |
| R14 | Rich consultant Strategy workspace | Context/AI brief, candidates, shortlist, comparison, sequence with alternatives, typed execution branches, validation, approval, client-safe reasons and frozen handoff. Manual fallback remains fully functional during AI outage. | A7 |
| R15 | Client owns external applications | One released card at a time; brief Why this card; Apply/Skip/Help; safe issuer handoff; structured outcome. No issuer credentials or uncontrolled application automation. | A8 |
| R16 | Approved rules handle normal live progression | Approved/declined/pending/skipped/technical failure/ambiguous results remain different. Deterministic policy uses consultant-approved branches; AI can assist within its authority, not publish new instructions. Consultant handles exceptions. | A7, A8 |
| R17 | Live supervision persists across the CRM | Strategy turn `7afccf58-5818-4a2b-9e6b-a4494c17b1e1` (page 19): the consultant must be able to multitask and be summoned. Persistent session dock, current application, immediate attention, reconnect/presence and safe pause. | A8 |
| R18 | Follow-up records actual outcomes | Pending resolution, reconsideration and credit-limit increase require structured facts; update the original application, recompute verified totals, keep history and refresh versioned Analysis. Strategy turn `b7b02294` prefix (page 13). Checkbox completion is insufficient. | A5, A9 |
| R19 | CRM separates overview, actionable queue and client work | Dashboard is workload/orientation; Work Queue owns priority/claim/due state; Client 360 preserves context. Reviews/Strategies remain client/stage workspaces rather than isolated primary navigation silos. | A2, A7, A10 |
| R20 | Complete commerce with three approved gateways | PayPal, Stripe, Bank of America configurable from launch; exactly one default for new payments; history retains original provider. Verify actual merchant product capabilities, including provider-specific reconciliation/refund limitations. | A3, A9, A10 |
| R21 | Private storage starts on OVH; future S3 migration | Own private file storage, authorized access, retention and backup/restore. Preserve provider-aware metadata so a later S3 migration is safe. Initial local storage is an approved choice, not an accidental omission to “fix” by changing hosting. | A3, A12 |
| R22 | SMTP and external email are real integrations | Both need assembled runtime transport, operational configuration, templates and delivery diagnostics. External calendar needs actual connector implementation, not a no-op provider interface. | A3, A8, A10 |
| R23 | Server-backed saved views across devices | [POAR decisions](https://docs.google.com/document/d/182pYnfUmiQYaweGuTwJMy2IsSO9CGHq3yahHolU1hiA/edit), PD4. Filters/sort/columns/defaults per user; not session-only storage. | A2, A10 |
| R24 | Premium design follows task and data | Dark fintech direction, restrained gradients/glow, meaningful visuals, strong hierarchy, distinct client/staff layouts; useful scroll/sticky/drawer/drag/autosave/preview/saved state where it reduces work. No blanket stacked-card redesign. | A1, all waves |
| R25 | Public content explains the service's value | Explain why coordinated strategy and continued support are useful, what clients receive, process/fit/pricing and the next step. Do not turn the public site into an internal workflow specification or invent guarantees. | A11 |
| R26 | Full scope stays in the roadmap | User explicitly rejected MVP freezing in strategy turn `528cd0da` prefix (page 21). All canonical screens and mature workflow behaviors remain release obligations; wave order is not feature deletion. | All |
| R27 | Keep the accepted technical stack where useful | Conversations accepted the React/Vite/Express deviation from earlier Next/Nest proposals. Diagnose domain/UI boundaries rather than treating a framework rewrite as the solution. | A2 |

Turn prefixes identify exact locally retrieved messages; do not present them as independently navigable links. Full conversation links above are the durable references. Retrieval page numbers are newest-first audit pagination, not original conversation page numbers.

## Product language contract

| Current example | Intended wording / behavior |
|---|---|
| Your verified current focus and the next honest step | See what needs your attention and what comes next. |
| Continue Review your application sequence | View your Round — or, when blocked, Your consultant is updating your strategy. |
| factual target $100,000 | Desired credit amount: $100,000. Show verified amount reached separately with scope. |
| Canonical milestone available | Review published on [date] / You completed preparation / Waiting for [owner]. Only say completed when true. |
| Deterministic totals stay separate from consultant-approved interpretation | Your confirmed results and your consultant's next steps. |
| Start a governed request | Request your data or ask a privacy question. |
| append-only ledger / commercial grant | Review credits / Service access / Payment history, with useful transaction details. |
| Plan typed dependency / prerequisite truth | Client: what to do and why. Consultant: Requirements / Unlocks after / Completion method. |

These are direction examples, not a final copy deck. A1 supplies the exact state-specific copy contract. Every amount needs currency and scope; every score needs model/bureau/date and only a known model range; every timestamp needs a user-readable time basis. “Current,” “confirmed” and “ready” must have a defined data basis.

## Decisions still requiring business or provider evidence

Do not invent prices beyond approved configured products, service boundaries, turnaround promises, eligibility thresholds, credit-score models, provider account capabilities, legal policy text, or catalog licensing/asset rights. Recover them from source where possible; make any unresolved choice explicit in its wave before release. These are inputs for completing the product, not justification for deleting planned functionality.
