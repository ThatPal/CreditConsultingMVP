# Sprint 7.2 completion

- Starting boundary: `457c8e527896b631261fd776510c178c76002b75`
- Implementation boundary: `85ecaf97348ff86983326980060338bd5500b8e9`
- Process definitions: `credit_report.validate@1`, `credit_report.extract@1`

## Delivered outcome

Added governed supported-format validation and immutable factual extraction tied to the accepted `CreditReportDocument` checksum/source version. Accepted report dates remain unchanged; detected dates are evidence candidates only. Material facts retain bureau identity and direct page/label evidence. Low-confidence material fields become human-review exceptions.

The safe synthetic fixture covers three bureau scores, repeated logical tradelines, bureau differences, inquiries, a negative item, secured/revolving examples, and ambiguity. Malformed, incomplete, encrypted, unreadable, and unsupported inputs enter explicit failure/review results without source mutation or guessed partial truth. Replacement checks mark prior extraction stale.

## Verification

- Runtime + validation/extraction + Phase 6 upload validation: 16 passed.
- Phase 6 atomic submission regression: 2 passed against the persistent Credit database.
- API/worker typecheck and production builds: passed.
- Focused lint: passed.
- Migration: no Sprint 7.2 schema change; Sprint 7.1 forward migration remains applied.
- CI: deferred to mandatory Phase 7 final gate because shared runtime/security/provider foundations were not changed.

## Supported-format limitations

The supported CI fixture is a safe structured synthetic three-bureau representation. Arbitrary OCR/PDF vendor parsing and production provider binding remain intentionally unsupported until a canonical report format/provider is approved. No real client report data is included.

Sprint 7.3 normalization, account reconciliation, and ClientCard matching were not included in this boundary.
