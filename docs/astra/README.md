# Astra production audit

Audit date: 10 September 2026. Baseline: `ee3b8648b4a61ab76d4b56bd1cfd307b83bd8eb0`.

**The project is not ready for real clients. The problem is requirements loss and incomplete workflow implementation as much as visual design.** There is enough valuable infrastructure to rebuild deliberately on this branch; a wholesale framework replacement would consume effort without resolving the product defects.

The audit is independent of the previous versions. Astra has its own worktree, branch, database, Redis, files, application ports, and local environment. Development is authorized and underway: see [implementation pass 1](IMPLEMENTATION-01.md), [pass 2: Plan authoring and safe revisions](IMPLEMENTATION-02.md), [pass 3: typed responses and verification](IMPLEMENTATION-03.md), [pass 4: Plan documents and evidence](IMPLEMENTATION-04.md), [pass 5: help resolution and history access](IMPLEMENTATION-05.md), [pass 6: paginated history](IMPLEMENTATION-06.md), [pass 7: private response drafts](IMPLEMENTATION-07.md), [pass 8: response autosave](IMPLEMENTATION-08.md), [pass 9: navigation protection](IMPLEMENTATION-09.md), [pass 10: consultant tab recovery](IMPLEMENTATION-10.md), [pass 11: draft comparison](IMPLEMENTATION-11.md), [pass 12: selective wording resolution](IMPLEMENTATION-12.md), and [workspace instructions](WORKSPACE.md).

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
