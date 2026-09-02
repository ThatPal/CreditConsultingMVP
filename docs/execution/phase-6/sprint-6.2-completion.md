# Sprint 6.2 — Report Upload & Validation State Machine

Status: COMPLETE

Branch: `rapid/phase6-8-review-golden-path`

Accepted Sprint 6.1 boundary: `ec0f0aa`

Implementation boundary: `842b203`

## Delivered outcome

- Extended the canonical private `CreditReportDocument` record into an explicit upload-attempt state machine: `UPLOADED`, `VALIDATED`, `NEEDS_STAFF_REVIEW`, `ACCEPTED`, and `REJECTED`.
- Persisted entered/detected source and date slots, immutable checksum/type/size/storage provider, rejection code/reason, replacement lineage, and supersession timestamps.
- New uploads validate MIME plus extension, PDF signature/trailer readability, encryption, latest accepted report date, and intended/entered date consistency.
- Wrong-type, invalid, encrypted, unreadable, and same/older attempts remain durable private history but never become the intake authority.
- Intended/entered date discrepancies enter `NEEDS_STAFF_REVIEW`; canonical staff authorization can accept or reject the candidate with an audit trail.
- A rejected or staff-review replacement cannot supersede or invalidate the prior authoritative document. A validated replacement preserves both records and links the lineage.
- Intake metadata cannot silently rewrite an attached document's source/date; changing those facts requires a replacement upload.
- PORTAL-12/13 reuse the existing private upload experience and now send source/date context, show actionable rejection/staff-review guidance inline, and advance only after validation.

## Schema and migration

- Migration `20260902060000_credit_report_validation_state` adds the validation enum, provenance/date/rejection fields, and self-referencing replacement lineage.
- All 37 migrations deployed successfully to the isolated Credit database; no migration history was reset or rebuilt.

## Verification

- Validator/storage/API route regression: **3 files, 25 tests passed**.
- Route proof includes valid authority, invalid history, date discrepancy, authoritative replacement preservation, and cross-client upload denial.
- Client Review UI regression: **1 file, 2 tests passed**.
- API typecheck: PASS.
- Web typecheck: PASS.
- Changed-file lint: PASS.
- API build: PASS.
- Web build: PASS (existing non-blocking Vite chunk-size advisory only).
- Migration deploy: PASS on Credit-only `credit_strategy_phase6_8_block`.

## Acceptance reconciliation

| Requirement | Result |
|---|---|
| Durable canonical upload attempts | PASS |
| Source/date entered and detected slots | PASS |
| Type/size/checksum/storage provenance | PASS |
| Explicit validation and rejection states | PASS |
| Replacement history without invalidating prior authority | PASS |
| Staff-review discrepancy pathway | PASS |
| Private storage and owner scope | PASS |
| No credit consumption during upload | PASS |

## Known limitations

- Automated bureau/source and report-date extraction is not claimed. Detected fields remain null until a future parser produces trustworthy values; client-entered values remain explicit provenance.
- Password removal/decryption is not attempted. Encrypted PDFs fail closed with an actionable replacement message.
- `ACCEPTED` is reserved for the Sprint 6.5 atomic submission boundary; Sprint 6.2 produces `VALIDATED` authority only.

## Boundary confirmation

- Sprint 6.3 work is not included in this boundary.
- The rapid branch was not merged into `ai-enabled`.
- Phase 7 was not started.
