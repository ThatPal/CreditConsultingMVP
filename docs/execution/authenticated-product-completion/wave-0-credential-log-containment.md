# Wave 0 — P0 Credential / Log Containment

Status: **COMPLETE — EXACT-HEAD CI PASS**

## Boundary

- Starting branch: `rapid/phase17-18-operations-public`
- Starting head: `287cb6b911fa2ea2a1fa6f71ee837717cda5beb7`
- Scope: CAPC-008 only, including containment, rotation disposition, regression proof,
  and a P0 logging/security recheck.
- Excluded: Waves 1–6, Phase 18, and any merge into `ai-enabled`.
- Preserved: CAPC-009, CAPC-010, CAPC-017, and CAPC-019 bounded repairs from
  the APC-2 audit boundary.

## Implementation

The HTTP logger continues to redact these fields at the actual `pino-http`
boundary:

- request `Authorization`;
- request `Cookie`;
- response `Set-Cookie`.

The shared logger construction is now exported and used by `createApp`, allowing
the production-identical serialization path to be exercised against an in-memory
destination. The regression sends unique synthetic credential markers in all
three sensitive header positions and proves none of the values, nor a Bearer
credential prefix, reaches serialized log output. It also proves the configured
redaction is active rather than passing because request logging was disabled.

## Retained-log containment

The inspection covered all 35 retained `.log`, `.out`, and `.err` files below the
Credit workspace, excluding dependency, Git, build, and coverage directories.
Content matches were counted in memory; matching lines and credential values were
never printed or copied into evidence.

- 7 retained development API logs contained sensitive-header/session markers.
- 879 markers were detected across those files.
- The 7 affected files were verified as ordinary development/review logs inside
  old Credit worktrees and removed by exact literal path.
- A second scan covered the 28 remaining retained log files and found 0 sensitive
  header/session/Bearer markers.
- No repository-tracked log artifact contained credential material.

The deleted logs were disposable local development artifacts and are not
recoverable through this workspace. No application data, source, completion
evidence, branch, or database content was deleted.

## Rotation disposition

Actual session-cookie material had previously reached local development output,
including output visible during APC-2. File age alone was not sufficient proof
that every exposed session had expired, so all 2 remaining sessions in the
current Credit review database were revoked. Readback proved 0 sessions remain.
Password, MFA secret, API-key, payment-provider, and production credential
rotation is not indicated by the evidence: no such value class was found in the
retained-log scan, and this is a local development environment. Existing users
must sign in again; MFA enrollment state was not changed.

## P0 recheck

Static review covered API/worker logging calls, HTTP request/response header use,
runtime logger redaction, and credential-bearing auth test helpers. No additional
P0 logging exposure was found. Application errors are logged through the existing
runtime logger, which retains password/token/secret/URL redaction; no alternate
raw-header logger was found.

## Verification

Completed locally:

- focused API security/auth/router tests: 3 files, 20 tests passed;
- API typecheck passed;
- full workspace typecheck passed;
- full workspace build passed;
- changed-file ESLint passed;
- changed-file Prettier check passed;
- `git diff --check` passed;
- post-containment retained-log scan: 28 files, 0 sensitive markers.
- Credit review session rotation: 2 revoked, 0 retained.

Environmental disclosure: an attempted database-backed run executed the entire API
suite because an extra argument separator was interpreted as a Vitest filter. It
ran while Docker/PostgreSQL were unavailable and produced connection-refused
failures. This was an invalid environment run, not product regression evidence,
and is not counted as a gate result. A subsequent local complete-API attempt was
also not accepted as gate evidence because the Docker engine terminated both
Credit service containers with exit code 255 during the run. Exact-head CI uses
fresh managed PostgreSQL/Redis services and is the authoritative complete gate.

Authoritative GitHub CI run 135 passed on implementation head
`125d22cce7eb9a4e772d0243f346ebdeecd739a5`. Its fresh-service gate completed
dependency installation, all 65 migrations, double system seed, lint, typecheck,
the complete test suite, and build successfully. The report-only completion
commit is also required to pass CI at the final synchronized branch head.

## Findings

- Closed by Wave 0: CAPC-008 source-path logging exposure and retained local-log
  copies, subject to the pending session-revocation and CI proof above.
- New P0 findings: none.
- New lower-severity findings: none within this deliberately bounded wave.
