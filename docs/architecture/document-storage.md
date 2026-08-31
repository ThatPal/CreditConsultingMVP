# Document storage foundation

Sprint 3.2 adds a canonical `Document` record and a provider-neutral private storage contract. Metadata, authorization, audit, and outbox state remain in PostgreSQL; document bytes remain behind `DocumentStorage` and are never exposed through provider paths or public URLs.

## Providers

- `LOCAL_DISK` is the local-development default. Set `DOCUMENT_STORAGE_DIR` to its private root. `CREDIT_REPORT_STORAGE_DIR` remains a compatibility fallback for the existing Review document flow.
- `S3_COMPATIBLE` uses the same `put`, streamed read, existence, and delete contract. Its client and secret-resolved configuration are injected by runtime composition; the repository does not embed credentials or require a paid service in tests.

Storage keys are generated opaque identifiers. Both POSIX and Windows absolute paths and traversal keys are rejected on every platform.

## Authorization and lifecycle

Clients may upload enabled, client-uploadable document types and may list or download only documents belonging to their own client record. Staff access is evaluated from current canonical assignments on every request, so revocation takes effect immediately. Download responses use safe filenames and never return storage keys or provider details.

Create and replace operations store bytes first, then atomically commit document metadata, audit, and outbox state. A failed database finalization removes the newly stored object. Replacement preserves immutable history through `replacesDocumentId`/`supersededByDocumentId`. Delete is logical first and retains retention hooks; the provider object is then removed without exposing its location.

## Compatibility and migration

The forward-only `20260831160152_documents_storage_providers` migration adds the new tables and enum without altering `CreditReportDocument` or historical migrations. Existing Review routes and legacy read roots remain available. System/reference document types are seeded idempotently and demo data remains separate.
