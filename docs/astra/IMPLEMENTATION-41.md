# Pass 41: On-demand feature loading and mobile document foundation

## Delivered together

Forty-two previously eager authenticated page exports now load through React lazy boundaries, grouped by their existing domain modules. This includes Plan, Review, published Credit Center, cards/catalog, Strategy, scheduling/live work, post-Round, Major Readiness, services/checkout, documents, support and account/security. Existing Admin and consultant Plan-builder boundaries remain. Home, authentication, intake and shell navigation remain immediately available; route paths and access gates are unchanged.

The shared route loading/recovery surface retains a slow-load escape and home navigation after a rejected chunk. Its copy now explains that reloading clears unsaved tab changes and advises checking saved work before repeating a submission, instead of asserting an unverified outcome. Recovery actions stack on narrow screens. A new loading test exposed two nested status announcements; the decorative skeleton is now hidden from assistive technology so one status owns the announcement.

The HTML entry previously contained only the root element and script. It now includes the HTML doctype, English language, UTF-8, a mobile viewport without zoom restrictions, a title, dark color scheme and a JavaScript-disabled explanation. This lets real mobile browsers use the intended responsive width.

## Verification

Twenty-seven focused tests passed: application routes/shell/access coverage (22), existing route recovery (3), and new slow-load/navigation recovery scenarios (2). The first new loading assertion exposed duplicate status regions, which were fixed before the two recovery suites passed. Scoped lint, whitespace checks and the web production build passed. The final build no longer reports a chunk above the existing 550 kB warning threshold. API code/data contracts were not changed; no API rebuild, restart or migration was needed.

A fresh Chromium context loaded the compiled distribution against the real Astra API. Only that test context served compiled local assets at the existing web origin; user-visible tabs and the Vite process were untouched. The fixture explicitly supplied VITE_API_URL=http://127.0.0.1:3015 and granted local-network access in its isolated contexts. Initial fixture attempts exposed the default build API URL and Chromium loopback permission behavior; these were corrected in the test setup, without changing application authentication or CORS checks.

The successful run verified:

- Home did not request the unopened Plan, Review, catalog, Strategy or live page-family chunks.
- An intentionally aborted Plan chunk showed recovery while navigation remained available; Return to portal home loaded Home without reloading the shell.
- Holding a Plan chunk produced the slow-load message and home action; releasing it loaded the Plan and its existing saved response.
- A separate mobile-emulated context used a 390px layout viewport and had no horizontal document overflow. The full-page Plan screenshot was inspected; this is bounded visual evidence, not complete accessibility qualification.

A comparison build substituted the previous committed App.tsx through an isolated Vite plugin, without modifying checked-out source. With the same build environment, requested uncompressed Home JavaScript totaled 1,209,733 bytes for the previous routing and 931,834 bytes for the new routing: 277,899 bytes fewer, approximately 23%. This includes requested shared chunks; it is not a compressed transfer, timing, CPU or overall application-size claim. The main entry is about 515 kB, while shared code still contributes substantially.

Scripts, comparison output, results and screenshots remain ignored under .tmp/astra-runtime/route-*. Only synthetic sign-in/read activity was used; no Plan submission, publication, document upload, purchase or external message was performed. Protected branch heads remain unchanged.

## Remaining

A2 route loading now has compiled-browser evidence, but module extraction and shared dependency weight still need work. Auth/public loading, representative device/network timing, cache/deployment version transitions, all staff route families and broader accessibility remain unqualified. Public copy/brand, full business workflows, separate published-Plan replacement, real integrations and production operating evidence remain on the roadmap. A1/A2/A5 are still in progress.
