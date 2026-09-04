# Sprint 17.3C — Source Registry & Retrieval Governance

Status: complete

Implementation boundary: `1cbfa5dd16765f7368e92186ce49a13db684bc9b`

Delivered Admin source-registry discovery and governed source creation/lifecycle controls over the existing canonical `CardSource` model. New sources are disabled, require HTTPS and an explicit hostname allowlist, and reuse the catalog SSRF/private-network guard. Activation/deactivation uses optimistic concurrency and step-up-protected, idempotent audit/outbox commands. The UI exposes health-relevant mapping/candidate counts without credentials. API/Web typechecks and lint passed; the existing catalog integration suite contains the SSRF/allowlist proof and will run in the accumulated gate.
