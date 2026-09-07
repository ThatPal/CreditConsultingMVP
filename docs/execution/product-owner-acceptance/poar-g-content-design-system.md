# POAR-G — Content Design System

## Role voice

- **Client:** plain, calm, specific, respectful. Meaning and action first; source/guardrail second. Never predict approval, score change, credit amount or timing.
- **Consultant:** concise professional operations language. Always expose client, object/version, freshness, owner, blocker, draft/published visibility and next action.
- **Admin:** precise consequence language. Always expose scope, effective state, in-flight behavior, reversibility, step-up/audit and recovery.

## Canonical terminology

| Term | Definition / use | Avoid |
|---|---|---|
| Credit Review | consultant-led review workflow | using “review” alone when it could mean UI review/approval |
| Credit Profile | published factual snapshot from a Review | implying a live bureau file or score prediction |
| Credit Center | client area containing published Profile/Report/Analysis/History | using it as the Review workflow name |
| Plan | approved/client-visible preparation guidance and actions | “task list” or unexplained “nurture” client copy |
| Application Cycle | seasonal planning context | interchanging with Round |
| Card Application Round | paid/guided execution lifecycle within a Cycle | “session” when referring to the whole Round |
| Strategy | consultant-approved ordered card application guidance | Wishlist, eligibility list, or AI recommendation |
| Guided application session | scheduled/live one-card-at-a-time session | implying the consultant submits applications |
| Round results | factual reported/verified application outcomes | calling them Analysis |
| Round Analysis | consultant-published interpretation of results | presenting AI draft as Analysis |
| Major application coordination | timing/preparation guidance for mortgage/auto/etc. | unqualified “readiness” or lender approval likelihood |
| Saved for research | Wishlist state | “recommended” or “approved” |
| Review Credit | governed entitlement unit | “service unit(s)” |
| Published | explicitly approved and client-visible | “complete” when visibility matters |
| Draft | saved but not client-visible/effective | hiding draft state behind `Saved` |
| Effective | currently controls new operations | conflating with configured/enabled |

## Core grammar

### Page header

`[Job/object title]`  
`Use this page to [job]. [Why it matters in the current state].`

### Current state

`[Object] is [human state] as of [time/source]. [Consequence].`

### Next action

CTA is a verb + object: `Upload credit report`, `Review current balances`, `Publish Plan`, `Approve Strategy`, `Schedule guided session`, `Retry delivery`, `Revoke session`, `Preview retention impact`.

Avoid bare `Open`, `View`, `Continue`, `Run`, `Enable`, `Complete`, or `Save` when the object/effect is not already part of the control name.

### Waiting/blocker

- Client: `Waiting for [prerequisite]. [Owner] needs to [action] before [capability]. You [do/do not] need to act now.`
- Consultant: `Blocked by [object/version/state]. Resolve [action] before [professional action].`
- Admin: `[Operation] is blocked because [control/dependency]. [Safe state]. [Authorized recovery].`

Never invent an ETA.

### Empty

`No [objects] yet. [Why this may be normal]. [Owner/how creates one]. [Valid next action].`

### Success

`[Specific action] complete. [Canonical state changed]. Next: [owner/action].`

### Error/recovery

`[Object/action] couldn’t be [loaded/saved/sent]. [What remains unchanged or protected]. Try [primary recovery], or [alternate/support path].`

Do not use “safely” as a substitute for explaining unchanged state.

### Stale/realtime

- `Live · last confirmed [time]`
- `Reconnecting. Committed results are preserved; do not repeat the action.`
- `Stale as of [time/event]. [Owner] must review the change before [action].`
- `Connection restored. Showing committed state from [time/version].`

### Draft/published/advisory

- `Draft saved [time] · Not client-visible`
- `Published vN [time] by [role/person where appropriate]`
- `AI-prepared draft · Review required · Cannot publish or act`
- `Reported by client · Not yet verified`
- `System-calculated fact from [source/as-of]`

## Governed/destructive action grammar

Every confirmation contains:

1. **Action:** exact verb and object.
2. **Scope:** user/client/provider/rule/date range affected.
3. **Effect:** what becomes effective.
4. **In-flight behavior:** what continues or remains unchanged.
5. **Reversibility:** restore path, expiry, or irreversible warning.
6. **Authority:** step-up/role requirement when useful.
7. **Evidence:** audit/result reference after success.

Use `disable` for reversible prevention of new work, `revoke` for removing granted access/session, `expire` for time-bounded end, `delete` only for actual deletion, and `execute retention` only for the governed irreversible operation.

## Provenance and financial language

- Put user meaning first and source/model/as-of immediately adjacent but secondary.
- Show exact score, bureau/source, scoring model and range only when known. Never normalize or infer approval chance.
- Amounts state currency and what population/time they cover.
- Card offer: `Catalog terms checked [date]; issuer terms can change.`
- Payment: human service, amount and status first; processor/reference in details.

## Support and notification language

- Support composer says what safe context will be attached and what the user must describe.
- Staff UI permanently distinguishes `Reply to client`, `Internal note`, and `AI-prepared editable draft`.
- Notification structure: `[What changed]` / `[Why it matters]` / `[Exact destination action]`.
- Do not expose event codes as primary subjects.

## Responsive content

At narrow width retain: object, current state, owner, primary action and essential risk. Collapse background, provenance detail and secondary explanations into named disclosures. Never truncate a destructive consequence or uncertainty qualification.

## Centralization boundary

Centralize terminology, status/state presentation, quantity/financial formatting, freshness, recovery, draft/published/advisory badges and governed-action grammar. Keep screen purpose, domain meaning, why-we-ask, consequences and handoff text screen/domain specific but generated from typed canonical state where possible.
