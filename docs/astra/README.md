# Astra production audit

Audit date: 10 September 2026. Baseline: `ee3b8648b4a61ab76d4b56bd1cfd307b83bd8eb0`.

**The project is not ready for real clients. The problem is requirements loss and incomplete workflow implementation as much as visual design.** There is enough valuable infrastructure to rebuild deliberately on this branch; a wholesale framework replacement would consume effort without resolving the product defects.

The audit is independent of the previous versions. Astra has its own worktree, branch, database, Redis, files, application ports, and local environment. Development is authorized and underway: see [implementation pass 1](IMPLEMENTATION-01.md), [pass 2: Plan authoring and safe revisions](IMPLEMENTATION-02.md), [pass 3: typed responses and verification](IMPLEMENTATION-03.md), [pass 4: Plan documents and evidence](IMPLEMENTATION-04.md), [pass 5: help resolution and history access](IMPLEMENTATION-05.md), [pass 6: paginated history](IMPLEMENTATION-06.md), [pass 7: private response drafts](IMPLEMENTATION-07.md), [pass 8: response autosave](IMPLEMENTATION-08.md), [pass 9: navigation protection](IMPLEMENTATION-09.md), [pass 10: consultant tab recovery](IMPLEMENTATION-10.md), [pass 11: draft comparison](IMPLEMENTATION-11.md), [pass 12: selective wording resolution](IMPLEMENTATION-12.md), [pass 13: response-form preview](IMPLEMENTATION-13.md), [pass 14: readiness scenarios](IMPLEMENTATION-14.md), [pass 15: paths and version lifecycle](IMPLEMENTATION-15.md), and [workspace instructions](WORKSPACE.md).

## Read in this order

1. [Findings and diagnosis](FINDINGS.md): confirmed defects, incomplete capabilities, evidence, and limitations.
2. [Recovered requirements](REQUIREMENTS.md): business intent restored from the original conversations, including conflicts in Drive.
3. [Screen register](SCREEN-REGISTER.md): every canonical screen, section responsibilities, implementation location, observed/static coverage, and completion target.
4. [Workflow and architecture plan](ARCHITECTURE.md): transaction boundaries, shared truth, integrations, and release evidence.
5. [Development roadmap](ROADMAP.md): dependency-ordered delivery through production, with acceptance gates and the first implementation package.
6. [Audit scope and source manifest](EVIDENCE.md): exactly what was read, run, inspected, and not proved.
7. [Completed Admin browser pass](ADMIN-BROWSER-AUDIT.md): authorized MFA enrollment, 31 Admin paths inspected, and four additional findings (24 total).

## What explains the result

- **The business plan was repeatedly compressed.** Desired credit amount became “target”; complete assisted strategy became generic proposals and manual forms; a rich ongoing relationship became a short stage rail. Some current Drive documents conflict with later explicit business decisions.
- **Technical scaffolding was counted as finished capability.** The runtime report pipeline accepts a synthetic JSON fixture format, the strategy “AI” returns stock sentences, and production email adapters are not wired. These are central paid-service capabilities, not polish items.
- **The screen composition does not follow the work.** Dashboards, authoring tools, timelines, research, and live sessions repeatedly use similar rounded containers. Staff workspaces expose implementation concepts and leave the consultant to assemble context manually.
- **The product has conflicting sources of truth.** The Home “Plan actions” value is a count of Plans; legacy cycle stage determines the next action without reconciling active Round restrictions. A polished presentation of these answers would still mislead.
- **Previous evidence is too narrow for the conclusion.** A migration, a successful build, fixture coverage, or a component named “workbench” does not establish a mature service. Completion must be demonstrated through real adapters, correct client-safe data, all material states, and realistic usage.

## Preserve and strengthen

Preserve the PostgreSQL/Prisma model and migration history, permissions and scoped access, publication/version concepts, structured Plan outcomes, work ownership, durable jobs/outbox, payment and entitlement records, private document abstractions, and the working React/Vite/Express foundation. Their existence is valuable; their end-to-end integration and operational readiness still need proof.

## Recommended first move

Start **A1: recover the product contracts and establish a premium reference slice**, followed immediately by **A2: consistent workflow truth and domain boundaries**. Build the Home → Credit Center → Plan experience against explicit data contracts and representative states. In parallel *as workstreams, not an instruction to spawn agents*, replace the report/AI/email fixture paths. Do not repaint every page before fixing the facts and workflow contracts beneath it.

The roadmap retains the full planned scope. A closed pilot is a verification stage, not permission to drop the advanced features or declare another conceptual MVP complete.

Latest implementation: [Pass 16: Multi-Plan discovery and safe resumption](IMPLEMENTATION-16.md).


Latest: [Pass 17: Publication identity and Plan-specific follow-through](IMPLEMENTATION-17.md). Private edits no longer change the selected publication; selected-Plan response review and new work-item links stay scoped. Cancellation/replacement commands remain open; A1/A2/A5 remain in progress.


[Pass 18: Start a separate Plan](IMPLEMENTATION-18.md) adds blank draft context, guarded entry, independent recovery and first-save identity handoff. Next: creation request replay protection, cancellation/replacement policy and remaining A5 qualification.


[Pass 19: First-save replay protection](IMPLEMENTATION-19.md) adds consultant/client-scoped creation keys, atomic replay, tab recovery and confirmed-rejection handling. Next: source-grounded lifecycle commands and remaining operational/visual qualification. A1/A2/A5 remain in progress.


[Pass 20: Grouped private-Plan lifecycle](IMPLEMENTATION-20.md) delivers cancellation controls, scoped replay-safe cancellation, retained history/reasons and related reminder closure together. API/web each built once at the batch boundary. Published-Plan replacement and A5 qualification remain open.


[Pass 21: Queue-to-Plan navigation](IMPLEMENTATION-21.md) resolves legacy source links at read time, focuses stable response steps, handles unavailable sources and protects unsent review notes. Published-Plan replacement and operational/browser qualification remain open.


[Pass 22: Approval-context concurrency](IMPLEMENTATION-22.md) guards the reviewed client publication, serializes competing approvals and provides explicit refresh/re-review. Formal published-Plan replacement and operational/browser qualification remain open.


[Pass 23: Consultant message recovery](IMPLEMENTATION-23.md) adds isolated tab copies, orphan-message handling, changed-evidence review, cleanup and focused MFA returns. Server-backed drafts, published-Plan handoff and visual/operational qualification remain open.


[Pass 24: Source pauses and response recovery](IMPLEMENTATION-24.md) enforces source-review pauses on client/consultant writes and adds explicit response refresh and tab-storage retry. Grouped API/web builds passed. Published-Plan handoff and visual/operational qualification remain open.


[Pass 25: Approved revision follow-up handoff](IMPLEMENTATION-25.md) carries pending response reminders into approved revisions, preserves assignment and timing, scopes decision resolution, and refreshes response/Journey views. Separate-Plan replacement policy and broader qualification remain open.


[Pass 26: Client response boundaries and paused draft inspection](IMPLEMENTATION-26.md) blocks direct hidden-step submissions, prevents paused draft overwrites, and exposes saved answers read-only during pauses. Runtime transition/recovery qualification and separate-Plan replacement remain open.


[Pass 27: Earlier response draft access](IMPLEMENTATION-27.md) exposes the most recent earlier draft with original instructions/labels and authorized attachments, preserving independent current answers. Orphan/retention controls, unsaved transition recovery and broader qualification remain open.


[Pass 28: Explicit private draft discard](IMPLEMENTATION-28.md) adds confirmation, draft identity/revision protection, deletion replay, earlier/current isolation and conflict refresh. Removed-step recovery and unsaved-edit transitions remain open.


[Pass 29: Saved response library](IMPLEMENTATION-29.md) adds paginated client-owned draft inspection/discard across Plan history, including removed steps and no-current-Plan states. Unsaved live-transition recovery and browser/operational qualification remain open.


[Pass 30: Guarded live Plan updates](IMPLEMENTATION-30.md) retains displayed answers during dirty/busy response work, pauses writes when an update arrives, and requires explicit loading. Independent draft-query/session transitions and broader qualification remain open.


[Pass 31: Reviewed draft context and refresh guard](IMPLEMENTATION-31.md) binds edits to reviewed draft state, preserves text across cached changes and requires explicit reload. Rejected-lookup transport qualification, server draft identity and session-loss recovery remain open.


[Pass 32: Transport recovery and server draft identity](IMPLEMENTATION-32.md) verifies real API-wrapper failure/retry behavior and protects updated-client saves/submissions from recreated draft identities. Session-loss, legacy-caller migration and browser qualification remain open.


[Pass 33: Session expiry and return navigation](IMPLEMENTATION-33.md) adds explicit recovery copy, protects the sign-in return path and verifies real-provider recovery with controlled 401 responses. Full-browser dirty/busy expiry and broader production qualification remain open.


[Pass 34: Expiry during pending Plan work](IMPLEMENTATION-34.md) fixes blocked sign-in navigation, late private draft cache restoration, and upload callbacks after unmount. Controlled integration coverage passes; an editable synthetic browser scenario and broader qualification remain open.


[Pass 35: Real-browser expiry and upload authentication](IMPLEMENTATION-35.md) verifies editing/upload sign-out recovery against the real API, fixes anonymous upload 403 versus 401, and compacts the mobile action bar with keyboard focus transfer. Cross-tab/accepted-write behavior and broader production qualification remain open.


[Pass 36: Cross-tab sign-out and accepted draft recovery](IMPLEMENTATION-36.md) propagates confirmed logout without private payloads and verifies accepted-save recovery in two real browser tabs with storage fallback. Account switching, missed notifications, accepted-upload recovery and broader qualification remain open.
