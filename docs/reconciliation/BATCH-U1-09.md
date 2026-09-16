# U1 batch 09 — Visual data and focal depth

Baseline `585a02d`; independent Astra branch. User's current design correction explicitly requests gradients, glow, richer data components, coherent screens and a more appealing dark palette. This overrides any interpretation of restrained styling as flat text-only presentation.

RESTYLE shared canvas and focal gradients; RECOMPOSE published credit facts and Plan roadmap presentation; KEEP server facts, counts, focus, commands, history and response recovery. Advances F08 reference design; no overall F08/U1 closure.

## Implemented

- Blue-slate canvas and raised surfaces, mint/teal/ice-blue CTA gradient, shared data/focus gradients and selective glow. Home and Plan use the same focal treatment.
- Three published bureau score arcs with visible position markers and accessible numeric descriptions. Compact bureau rows on mobile, side-by-side gauges on desktop.
- Common 300–850 range is explicitly a reference, never asserted to be the unknown scoring model. No invented poor/good/excellent rating, score change, approval odds or bureau average. Missing scores omit the pointer; out-of-reference values remain visible without a fabricated position.
- Utilization ring preserves the published percentage, including values above 100; only the drawing is capped. Missing data remains unreported.
- Plan action/guidance/milestone icons, meaningful active-work accent and directional step links. Display order does not imply dependency; existing explicit prerequisites remain visible.

Range basis: [CFPB score explanation](https://www.consumerfinance.gov/ask-cfpb/what-is-a-credit-score-en-315/) states most scores range from 300–850 and scores differ by model/source. Published DTO still lacks model metadata; final model-specific ranges/rating bands remain future source-contract work.

## Verification

22 focused tests pass (visual data boundaries, Home, Plan and product completion). Root lint passes. Five-package build passes; final compact-mobile adjustment receives web typecheck and repeated browser inspection.

Synthetic, isolated browser checks: Center Overview/Analysis/History at 1440 and 390px, exact Review Support context and selected-section visibility; Plan roadmap/step/saved response/guidance empty, reduced motion, 44px navigation and blocked storage. No page errors or horizontal overflow. Non-read API calls blocked after login; no response submissions. Screenshots: `docs/evidence/u1-visual-data/`. Reviewed desktop and compact mobile credit picture and Plan focus. User browser sessions untouched.

U1 remains NOT PASSED. Final shared blocker/action contracts, Live/Major precedence and remaining reference-screen states still require acceptance. This is the updated visual direction, not a claim that all screens are redesigned.
