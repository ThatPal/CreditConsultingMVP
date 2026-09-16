# Old UI baseline and final reference checklist

Baseline `44a905b`; isolated authenticated Chromium contexts; synthetic accounts only. Screenshots are current implementation evidence, not design authority. Existing user browser tabs were not modified.

Desktop: 1440×1000. Mobile: 390×844. Full-page captures under `docs/evidence/u0-baseline/`.

| Surface       | State                                                      | Evidence                                                | Final target                                                                |
| ------------- | ---------------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------- |
| Shell/Home    | Existing goal + one open Plan Action; no published Profile | `home-desktop.png`, `home-mobile.png`                   | CP-SHELL-01, CP-01; final section K navigation and QA Batch 1 hierarchy     |
| Credit Center | No published Review                                        | `credit-center-desktop.png`, `credit-center-mobile.png` | CP-CC-01 QA Batch 2; honest no-profile state and valid Review entry         |
| Plan          | One approved Action, saved private response                | `plan-desktop.png`, `plan-mobile.png`                   | CP-PL-01 account-level coordination with Overview/Actions/Decisions/Nurture |

Additional captures reviewed: `action-desktop.png` / `action-mobile.png` show the saved response expanded without editing or submitting; `credit-center-published-desktop.png` / `credit-center-published-mobile.png` show synthetic approved Profile metrics and consultant assessment. Ten screenshots total. Shell appears within each full-page image; scrolled full-page Action captures can repeat sticky chrome at its captured scroll position and must not be interpreted as multiple actual headers.

## Observations from reviewed screenshots

- Home has a dominant action but combines desired credit amount into the hero and reserves a full appointment cell with no appointment. Final QA requires absent records to collapse/reflow.
- Client navigation omits a primary Credit Plan destination and keeps Application Rounds/Major Readiness prominent. Final section K lists Home, Journey, Credit Center, Credit Plan, Cards, Services, Support; secondary destinations remain contextual.
- Plan breadcrumb reads Credit Center / plan, conflicting with global Plan ownership.
- Plan repeats the same Action in its focus panel and item list; a large circular percent graphic counts unlike item types together.
- Mobile Plan remains a long stack of rounded containers. Sticky controls overlap the focus panel in the full-page capture and need deliberate viewport/task review.
- Saved private draft resumption is real useful behavior and must survive recomposition. Screenshot presence alone does not requalify autosave/concurrency.
- No horizontal document overflow was detected in the six initial captured states. This is not full responsive acceptance.

## Final comparison checklist

- Shell: final navigation order/secondary destinations; skip link, current-page semantics, safe mobile menu/focus return; active Live return indicator only when real.
- Home: exactly one Current Focus CTA; canonical attention/blockers; factual Goal/Credit summary; real roadmap source links; conditional appointment/secondary services; meaningful recent activity only. Mobile: focus → attention → Goal/Credit → roadmap → appointment → secondary/recent.
- Credit Center: source report date distinct from publication; current Profile state/sufficiency/readiness; client-safe approved Analysis/recommendation; next action/Plan connection; preserved historical facts with stale label; no fake metrics in empty state.
- Plan: account-level Overview/Roadmap, Actions, Decisions, Nurture; independent dependency and display order; no new PlanPath engine; only approved client-safe work; meaningful empty/waiting/blocked/history states.
- Action: instruction, why, timing/blocking, typed response/evidence, next owner, history; submitted distinct from verified; revision preserves previous submission; contextual help does not complete Action. Mobile prioritizes instruction → timing → response → next → history.
- Visuals: disciplined dark financial hierarchy; selective focal depth; one coherent light work plane where specified; distinct task compositions, not universal gradient cards.
- Interaction: 44px touch targets, focus/keyboard/labels, non-color status, reduced motion, long/partial data and all global states.

Final authority: Portal QA Batches 1/2/8B plus final reconciliation; component-library amendments; frozen query/domain/state contracts. Earlier illustrative wireframes and example financial numbers are not seed requirements or factual data.
