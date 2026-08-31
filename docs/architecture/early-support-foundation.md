# Early support foundation

Sprint 3.4 reconciles the existing support screens and `SupportCase`/`SupportMessage` models into a governed support workflow. It does not introduce a second ticket system.

## Domain contract

- `SupportCategoryDefinition` is idempotently seeded reference data. A category controls whether clients may select it and which typed contexts it accepts.
- A ticket has one optional typed context (`DOCUMENT`, `REVIEW`, or `APPLICATION_SESSION`). Resolution always checks that the referenced record belongs to the ticket's client. API responses expose only a short display summary.
- Attachments are references to canonical, available, client-visible `Document` records. `SupportAttachment` never copies bytes or storage metadata, and response projections exclude provider keys and paths.
- Messages are append-only. Their `(ticket, author, idempotency key)` uniqueness prevents duplicate replies.
- Lifecycle transitions are centralized in `supportDomain.ts`; stale timestamp checks prevent a caller from overwriting a newer status.

## Authorization

Clients can read and change only their own tickets. Consultant endpoints require the Consultant role and the canonical `support.manage` client capability, normally supplied by an active assignment or explicit grant. The Admin role does not automatically confer consultant case access.

## Reliability and delivery

Ticket creation uses the shared consequential-command primitive so the ticket, first message, work item, audit event, notifications, outbox event, and idempotency result commit or roll back together. Replies and lifecycle changes similarly commit state, audit, notifications, and outbox records in one database transaction. Realtime publication is only a wake-up hint after commit; durable outbox processing remains the source of delivery recovery.

Email delivery is downstream of the committed notification/outbox record. A provider outage therefore cannot roll back or erase canonical support state.

## Database isolation

Local verification uses only the Credit project's Docker PostgreSQL service (`credit_strategy` or an isolated `credit_strategy_*` database, user `credit`, host port `5433`). Databases and credentials belonging to other projects are prohibited.
