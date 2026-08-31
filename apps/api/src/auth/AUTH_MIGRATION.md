# Better Auth authentication authority

Sprint 2.1 makes Better Auth 1.7.2 the sole live password and session authority. Express mounts its handler at `/api/auth/*splat` before JSON parsing. The legacy service remains only as a domain-profile/authorization compatibility facade; its login, registration, session, and reset routes are not mounted when the production server starts.

| Current record               | Better Auth target               | Migration treatment                                                                                                                                         |
| ---------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `User.id`, `email`, `status` | Better Auth `user`               | Preserve UUID and normalized email; map disabled/invited state through adapter policy.                                                                      |
| `User.passwordHash`          | Better Auth credential `account` | Backfilled into an issuer-scoped credential account. Better Auth uses the existing Argon2 verifier, preserving passwords without plaintext or forced reset. |
| `User.authProvider`          | Better Auth `account.providerId` | Normalize the current local/null value to the credential provider.                                                                                          |
| `AuthSession`                | Better Auth `session`            | Revoke legacy sessions at the cutover; never accept both session formats concurrently.                                                                      |
| `PasswordResetToken`         | Better Auth verification token   | Do not migrate consumed/expired tokens; revoke outstanding tokens at cutover.                                                                               |
| `Client.userId`              | Better Auth `user.id` relation   | Preserve the existing unique client-identity relationship.                                                                                                  |

The additive migration preserves all historical migrations and UUID identities, backfills existing credential accounts idempotently, and revokes legacy sessions and reset tokens. New client registration creates one existing-domain `User`, one `Client`, and one Better Auth credential account. Email verification is required before login. Password reset tokens are one-time use and reset revokes all sessions.

Verification and reset mail use the `EmailProvider` boundary. Development/test may use the metadata-only console capture provider; production configuration fails closed until a real SMTP or external adapter is installed. Return targets are restricted to internal paths or the configured web origin, and audit metadata never includes cookies, passwords, or email tokens.

Staff MFA, social login, passkeys, and authorization redesign are intentionally outside Sprint 2.1.
