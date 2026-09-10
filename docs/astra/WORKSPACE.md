# Independent Astra workspace

All Astra work is in:

`C:/Users/morde/Desktop/Projects/Credit/.worktrees/astra-production`

Branch: `codex/astra-production`

Base: `ee3b8648b4a61ab76d4b56bd1cfd307b83bd8eb0`

Origin: `https://github.com/ThatPal/CreditConsultingMVP`

This is a Git worktree: it shares the repository object store, but its checked-out files and branch are separate. Committing here does not update another branch. Its runtime data and files are also separate. No merge, push, deployment, or transfer into the other versions was performed.

## Protected versions

| Existing checkout | Branch / observed baseline |
|---|---|
| `C:/Users/morde/Desktop/Projects/Credit` | `main` at `642112202adee802b7d206bfe364dd779b33448c` |
| `Credit/.worktrees/ai-enabled` | `ai-enabled` at `becce2d268263c6c196cc524cb62526f0c65aec1` |
| `Credit/.worktrees/rapid-phase17-18-operations-public` | `rebuild/authenticated-product-poar` at `ee3b8648b4a61ab76d4b56bd1cfd307b83bd8eb0` |

Other historical worktrees were inventoried and left in place. The older tasks can continue on their existing branches/checkouts. Do not run cleanup/prune/reset or merge Astra changes into them.

## Runtime boundary

| Resource | Astra only |
|---|---|
| Compose project | `credit-astra` |
| PostgreSQL | `127.0.0.1:5445`, database `credit_strategy_astra` |
| Redis | `127.0.0.1:6395` |
| Web | `http://127.0.0.1:5195` |
| API | `http://127.0.0.1:3015` |
| Session cookie prefix | `credit_astra_sid` (wired into Better Auth's `advanced.cookiePrefix`) |
| DB / Redis volumes | Compose-prefixed Astra volumes, separate from `credit` |
| Private uploads | This checkout's `.data/documents` |
| Logs / PIDs | This checkout's `.tmp/astra-runtime` |
| Environment | This checkout's ignored `.env` only |

`compose.yaml` and `compose.astra.yaml` both point to Astra resources. Root package `runtime:up` and `runtime:down` explicitly select the Astra file/project. The original Compose and package files in other worktrees are unchanged. Example credentials in Compose are local synthetic-development credentials only, not production secrets.

## Continue this task

The desktop task may supply the parent `Credit` path as its default shell directory. **Explicitly select the Astra worktree for every command.** Open this directory as the project workspace if working in another editor/task. Its AGENTS.md carries the boundary and current audit status.

Before writing:

```powershell
Set-Location -LiteralPath 'C:\Users\morde\Desktop\Projects\Credit\.worktrees\astra-production'
git branch --show-current
git status --short
```

Expected branch is `codex/astra-production`. Stop and resolve any mismatch; do not switch another checkout to force it.

The audit left the isolated synthetic runtime available. To start it when stopped, from this directory:

```powershell
pnpm runtime:up
pnpm review:astra:start
```

The launcher refuses occupied application ports instead of killing processes and checks DB/Redis/application origins/cookie namespace. Check `http://127.0.0.1:3015/ready` and the Astra logs. It launches hidden local processes. It requires installed dependencies, built API/worker, initialized database and the private `.env`, which were prepared during the audit.

On a fresh machine, copy this checkout's `.env.example` to `.env`, generate a new random Better Auth secret, install with the lockfile, generate/build, and explicitly validate the Astra DB/Redis URLs before migrations/seeds. Do not seed an existing dataset casually: the demo seed changes test users/security and fixture states. Raw private source snapshots are ignored; retrieve the linked references again if needed.

Inherited `review:phase*`, `review:setup` and old review scripts remain historical tooling and are not the Astra startup contract. Do not execute them without checking every target. Never copy another version's `.env`, provider credentials, database or uploads.

## Changes made for the audit

- Created the independent branch/worktree and local runtime resources.
- Added the audit, recovered requirements, screen/route/source inventories, architecture plan and roadmap.
- Added AGENTS.md and launcher; isolated default Compose/package/environment settings.
- Set Better Auth's cookie prefix from the existing environment setting so local versions have distinct cookies. This changes only Astra; it does not weaken authentication or bypass MFA. Existing local Astra sessions may need to sign in again after this prefix change.
- Installed dependencies, generated/build artifacts and seeded synthetic Astra data. These generated/private resources are ignored.

The paid-service/report/AI/Plan/design defects described in the audit are intentionally **not fixed yet**. The next authorized development step is A1/A2 in ROADMAP.md. Preserve the baseline evidence while implementing fixes; do not silently rewrite the original audit as if the baseline defects never existed.

No raw private sources, secrets or runtime data should be staged or pushed. Any future hosting, CI environment, provider webhook, database, object store or domain created for Astra must likewise be separately scoped from Sol/non-AI.
