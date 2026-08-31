# Sprint 1.3 showcase evidence

Route: `/dev/design-system` (development and test builds only; absent from ordinary navigation)

## Responsive review

- Desktop: inspected at the default in-app browser viewport. The hero, metric grid, paired Light Focus Surfaces, control grid, table, surface cards, and feedback states rendered without overlap or horizontal clipping.
- Mobile: inspected at 390 × 844. Multi-column sections collapsed to one column; actions wrapped or stacked; the account table remained contained; form controls, state examples, and Light Focus Surfaces remained readable.
- Full-page screenshots were captured during implementation review for both viewports and included in the sprint handoff conversation.

## Keyboard, focus, and motion review

- Interactive controls use native MUI button, input, checkbox, radio, switch, dialog, drawer, and tooltip semantics with accessible labels/names.
- The global `:focus-visible` treatment uses a three-pixel cyan outline with a three-pixel offset and `!important` protection against component resets on both dark and light surfaces.
- Showcase controls follow DOM reading order; disabled/loading controls are skipped or exposed with their native disabled state.
- The global reduced-motion media query reduces animation and transition durations, limits animation iteration, and disables smooth scrolling without removing functionality.

All content is fictional/synthetic.
