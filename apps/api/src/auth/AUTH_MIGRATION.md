# Authentication authority and Better Auth migration

Sprint 0.2 keeps the existing `User` / `AuthSession` / `PasswordResetToken` implementation as the sole live authentication authority. Better Auth is not installed or run in parallel.

| Current record               | Better Auth target               | Migration treatment                                                                                                                              |
| ---------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `User.id`, `email`, `status` | Better Auth `user`               | Preserve UUID and normalized email; map disabled/invited state through adapter policy.                                                           |
| `User.passwordHash`          | Better Auth credential `account` | Import only after a compatibility verification spike confirms the stored scrypt format; otherwise require an explicit reset with advance notice. |
| `User.authProvider`          | Better Auth `account.providerId` | Normalize the current local/null value to the credential provider.                                                                               |
| `AuthSession`                | Better Auth `session`            | Revoke legacy sessions at the cutover; never accept both session formats concurrently.                                                           |
| `PasswordResetToken`         | Better Auth verification token   | Do not migrate consumed/expired tokens; revoke outstanding tokens at cutover.                                                                    |
| `Client.userId`              | Better Auth `user.id` relation   | Preserve the existing unique client-identity relationship.                                                                                       |

Cutover sequence for Sprint 1.x: verify password-hash compatibility, add Better Auth tables additively, backfill identities/accounts, stop legacy issuance, revoke legacy sessions/reset tokens, switch the authentication adapter atomically, then remove legacy issuance after regression tests. Staff MFA is enforced through the authorization service's `staffMfaRequired` integration point before sensitive staff capabilities are enabled.
