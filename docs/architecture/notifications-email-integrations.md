# Notifications, email, and integration foundation

`Notification` is the authoritative in-app record. `(userId, semanticKey)` makes each semantic notification duplicate-safe. Creation commits the notification, optional `NotificationDelivery`, and one safe outbox event together. Provider delivery is downstream worker work: failures update only delivery lifecycle state and never remove or duplicate the canonical notification.

## Delivery and realtime

The existing outbox worker processes an optional email delivery before publishing the client-safe realtime refetch envelope. A failed provider attempt leaves the outbox event retryable; worker restart reclaims it. Delivered rows are idempotent and are not sent again. Only `clientId`, refetch domains, and the public event envelope reach realtime clients; delivery identifiers and provider details remain worker-side. The API realtime bridge also refreshes the existing authorized SSE client, so PORTAL-41 refetches from PostgreSQL after events and reconnects.

## Email providers

One `EmailProvider` contract remains shared by Better Auth verification/reset mail and notification delivery.

- `CONSOLE` is development/test capture. It logs recipient, subject, and sensitivity metadata, never message bodies, URLs, or tokens.
- `SMTP` is configured by host, port, secure/TLS mode, optional username, secret reference, and from identity. A transport is injected. Google Workspace SMTP relay is an SMTP configuration (`smtp-relay.gmail.com` where appropriate), not another mail subsystem.
- `EXTERNAL` is an injected provider-neutral boundary for a later selected vendor.

Selecting SMTP or EXTERNAL without an installed transport fails closed. Production never falls back silently to console delivery. Environment configuration stores only `EMAIL_SMTP_PASSWORD_SECRET_REF`; secret resolution belongs to deployment composition.

## Integration health and privacy

`Integration` stores typed provider identity, enabled/health state, safe configuration metadata, timestamps, error categories, and secret references. It never stores secret values. Admin list and connection-test projections exclude secret references. Connection tests require the canonical Admin platform capability and step-up state, emit a minimal audit event, redact raw provider errors, and do not disable or delete an integration after failure.

Client notification queries and state changes are always scoped to the authenticated user. Required operational and security in-app channels cannot be disabled. Deep links accept only internal `/app` routes, and notification payloads must remain recipient-safe.
