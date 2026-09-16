# U1 final reference comparison — closeout review

Compared the current Home, Credit Center and Plan implementation with U0–U1 U1.4–U1.8 and final Portal QA Batch 2. This is an implementation/visual review, not an external design approval.

- Home: split focus/goal composition leads, followed by the working picture and journey context. Shared server focus supplies one primary destination and next-step owner. Goal amount is visually distinct; unavailable data is labelled. Expiry notice does not replace historical facts.
- Credit Center: analysis/advisory composition and next step flank data visuals at desktop, stack at narrow width. Profile gauge/utilization and explicit source/publication dates replace number-only presentation. History is expandable and immutable; protected report access remains source-owned.
- Plan: one current focus, coordinated Overview/Actions/Guidance/Decisions/Nurture views, visual progress only for Action counts. Roadmap is a sequence; detailed steps retain owner/status/prerequisites/response history. Shared restrictions use a collapsed disclosure rather than more competing focus cards.
- New Decisions view uses a dated source-linked list, not repeated metric cards. Nurture reuses the canonical item presentation for a published NURTURE-purpose Plan and has an honest empty state. Source boundaries are in U1_ADAPTER_DISPOSITION.md.
- Mobile: view controls wrap without horizontal page overflow; primary actions retain touch sizing. New 390px Decisions and 1440px Nurture captures were inspected, including hierarchy, line wrapping and source labels. Dense content remains in the main scroll container; a desktop viewport capture does not by itself show the entire scrollable screen.
- Accessibility: Plan/Credit Center focus headings corrected to semantic h2; shared disclosures and menus are keyboard operable. Existing menu/drawer tests cover focus trapping/return. Glow/base blend bounds revealed secondary text below 4.5:1, repaired by lightening the shared secondary text token; gradient structures are preserved.

Remaining production-domain work is explicitly assigned to U2–U10. Final U1 pass depends on the closeout test results and the updated acceptance ledger, not this comparison note alone.
