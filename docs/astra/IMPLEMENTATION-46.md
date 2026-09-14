# Pass 46: Consultant Plan discovery and lifecycle clarity

## Delivered

The consultant Plan library now has server-backed, case-insensitive title search and Plan lifecycle status filters. Search includes saved version titles so renamed Plans remain findable. The API validates search length and lifecycle values, retains existing role/client capability checks, and combines filtering with the existing bounded 20-row cursor pagination. Filters are applied by the database, not just to already-loaded rows.

The drawer keeps its title, close action, debounced title search and status selector in a sticky header. Empty results retain controls and offer a clear reset; changing filters creates a fresh query/pagination scope without changing the selected Plan URL. Lifecycle labels and short explanations distinguish private drafts, active work, source-review needs and retained history. Status chips wrap on narrow screens. Existing version status remains separately visible. Opening a Plan still uses the unsaved-work navigation guard and never publishes it.

## Verification

Seventeen distinct focused tests passed: 13 API authoring/lifecycle integration cases and 4 web library/history cases. Added database coverage checks renamed/version titles, combined status search and client isolation. The 21-Plan pagination scenario was rerun with search/status applied to both pages and retained every matching Plan once. The new web case verifies encoded server search, no-result controls, status changes and reset without changing the selected Plan/query URL. Existing paging-failure recovery and unsaved-navigation tests passed.

Scoped lint and whitespace checks passed; API and web builds passed. The known pg query-concurrency deprecation warning appeared in the database suite. Only the verified Astra API was restarted for the new query parameters. No migration, production deployment or change to other versions occurred. Test records were isolated to their generated client and removed by the existing fixture cleanup.

## Remaining

This is implementation/component/database evidence, not completed consultant browser or visual qualification. The authenticated consultant MFA/browser path still needs its dedicated review, including narrow viewport, sticky scroll, focus and keyboard behavior. Search performance against a representative large history remains unmeasured. This batch does not resolve separate published-Plan replacement, change approval rules, or mark a complete lifecycle wave ready. A1/A2/A5 and the broader roadmap remain open.
