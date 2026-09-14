# Pass 47: Consultant access and Plan drawer accessibility

## Delivered

The Plan library and version history now expose named modal dialogs. Opening the library focuses title search; Escape restores focus to its trigger. Inspecting a saved version moves keyboard focus into its details, and closing inspection returns focus to the corresponding Inspect button. Version history keeps its heading and close action in a sticky header; both drawer headers resist shrinking as content grows.

The user explicitly authorized resetting the synthetic consultant authenticator previously enrolled on their phone. The reset succeeded through the authenticated, MFA-verified Admin recovery API for consultant@credit.local only. The consultant then enrolled through the normal password/QR/TOTP flow. Its new authenticator and recovery-code fixture is stored solely in ignored Astra test files. The previous phone enrollment no longer authenticates this synthetic account. No authentication bypass or database edit was used.

## Verification

Five focused web tests passed across library and version history, including pagination recovery, comparison, search/filter reset, guarded navigation, dialog naming and focus transfer. Scoped lint, whitespace checks, API compilation and the web production build passed.

An isolated browser completed fresh consultant enrollment and then a separate fresh sign-in using the persisted test authenticator. Both established staff MFA assurance and returned to the exact requested client Plan route. Real server title search, no-match recovery, clearing filters, mobile library bounds and Escape focus restoration passed. Version inspection focus and return focus also passed in the mobile browser. Desktop (1440x1000) and mobile (390x844) screenshots were reviewed after the opening transition and content load. The corrected bounds check targets the active dialog, rather than the hidden mobile navigation drawer. Earlier transition screenshots and that incorrect selector were test artifacts, not evidence of a layout defect.

## Remaining

This qualifies the specific synthetic consultant sign-in, discovery and inspection paths, not the complete staff workflow. Large-history search performance, extended keyboard/screen-reader review, recovery-code usage, approval/publication policy across separate Plans, multi-node private event rollout and the broader feature roadmap remain open. A1/A2/A5 remain in progress. Other project versions and their runtimes were untouched. No deployment or push occurred.
