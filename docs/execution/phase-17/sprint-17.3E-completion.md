# Sprint 17.3E — Notification Template & Delivery Operations

Status: complete

Implementation boundary: `f87e61a49945d288688dfdf130523ded3905f086`

Added versioned EMAIL/IN_APP template administration and bounded delivery diagnostics over the canonical notification models. Email subjects are required, sensitive template variables are rejected, new versions default disabled, and enabling a version disables older versions for that key/channel. Creation is step-up protected, idempotent, audited and outboxed. Delivery views expose safe status/category/provider/attempt data, never raw payloads or provider responses. API/Web typechecks and lint passed; no migration was required.
