# Foundation Quality FQ-1 UI conformance audit

This audit is limited to application surfaces accepted through Sprint 3.4/C1. It does not authorize future roadmap functionality or a brand redesign.

## CONFORMANT

- AUTH-01 through AUTH-05 share one `AuthFrame`, MUI form controls, semantic alerts, and accessible labels.
- Client, Consultant, and Admin shells share `AppShell`, the typed navigation registry, responsive drawer behavior, and role/capability projection.
- Account and Security use the shared shell, `PageHeader`, `SectionCard`, and standard form/action semantics.
- Documents, Notifications, PORTAL-39/40 Support, and CRM-22/23 Support use the accepted shared loading, error, page-header, section-card, status, dialog, and responsive patterns.
- The design-system showcase remains the canonical evidence surface for dark application surfaces, Light Focus Surfaces, representative controls, loaders, tables, dialogs, and drawers.
- Shared components in `components/common` remain the canonical higher-level primitives. Direct MUI usage remains appropriate where no higher-level product primitive exists.

## ADAPT

- The global keyboard-focus contract and outlined-input focus contract needed a clearer separation. Form inputs now use their component-native border while non-form interactive elements retain the global ring.
- Error-plus-focus treatment needed an explicit error-color precedence rule so error state remains distinct while focused.
- Local review fixtures needed Better Auth credential records and representative Documents, Notifications, and Support data so accepted screens can be reviewed through the real runtime.
- PORTAL-42 Documents and PORTAL-39 Support now share one canonical, accessible Document upload/dropzone interaction. Documents uses the general client document type; Support uses the seeded support attachment type and automatically selects a successful upload in the current ticket draft.

## OBSOLETE / DUPLICATED

- The broad class-negation focus selector was replaced by an element/ownership-based contract that cannot accidentally apply the global ring to a MUI input.
- The Onboarding page's local focused `MuiOutlinedInput` glow duplicated the canonical theme-owned input focus treatment and was removed.

## FUTURE OWNER

- Work Queue / Attention functionality remains owned by Sprint 3.5 and was not implemented.
- Placeholder or intentionally foundational content in future roadmap screens remains owned by its scheduled product sprint.
- Larger information-architecture, brand, and data-visualization changes remain future product/design work and were not attempted in FQ-1.
- The accepted Sprint 3.4 model relates attachments to `SupportCase`, not `SupportMessage`. Reply-level attachments remain a future-owner decision; FQ-1 does not add new message attachment schema or semantics.
