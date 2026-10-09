# Personal data inventory

Every field in [`prisma/schema.prisma`](../../prisma/schema.prisma) that holds
personal data, why it is held, and how long it is kept. Retention is what the
code and the published privacy page define today; where neither defines one, the
row says so and links the issue.

The published privacy page (`messages/en.json`'s `legal.privacy`) states: "We keep account
and search data for as long as your account is active. When you delete your
account, the associated data is removed." How deletion works, and what it leaves
behind, is in [deletion.md](deletion.md). Who else receives personal data is in
[processors.md](processors.md).

| Model | Field | Purpose | Retention |
| --- | --- | --- | --- |
| `User` | `email` | Sign-in identifier and the address for account and alert emails | Until the account is deleted |
| `User` | `password` | bcrypt hash for credentials sign-in; null for OAuth-only accounts | Until the account is deleted |
| `User` | `name` | Display name | Until the account is deleted |
| `User` | `image` | Profile picture URL, written by the NextAuth adapter from the OAuth profile | Until the account is deleted |
| `User` | `emailVerified` | When the address was confirmed | Until the account is deleted |
| `User` | `locale` | Language of the alert emails, which are sent with no request to resolve it from | Until the account is deleted |
| `User` | `twoFactorSecret` | TOTP secret, encrypted with `TWO_FACTOR_ENCRYPTION_KEY` | Until the account is deleted |
| `User` | `twoFactorEnabledAt` | Whether two-factor gates sign-in | Until the account is deleted |
| `User` | `twoFactorLastStep` | Highest accepted TOTP step, so a code cannot be replayed | Until the account is deleted |
| `User` | `passwordChangedAt` | Session revocation clock | Until the account is deleted |
| `User` | `createdAt` | When the account was created | Until the account is deleted |
| `TwoFactorRecoveryCode` | `codeHash` | SHA-256 of a recovery code, for signing in without the authenticator | Until the account is deleted (cascade) |
| `TwoFactorRecoveryCode` | `usedAt` | Makes each code single-use | Until the account is deleted (cascade) |
| `TwoFactor` | `secret` | Better Auth's own TOTP secret for the `twoFactor` plugin (BAUTH-11), encrypted by the plugin — not readable from the database alone | Until two-factor is disabled, re-enrolled, or the account is deleted (cascade) |
| `TwoFactor` | `backupCodes` | The plugin's own encrypted backup codes, for signing in without the authenticator | Until two-factor is disabled, re-enrolled, or the account is deleted (cascade) |
| `Account` | `providerAccountId` | The user's id at Google or GitHub, linking the OAuth identity | Until the provider is unlinked or the account is deleted (cascade) |
| `Account` | `refresh_token` | OAuth token stored by the NextAuth adapter | Until the provider is unlinked or the account is deleted (cascade) |
| `Account` | `access_token` | OAuth token stored by the NextAuth adapter | Until the provider is unlinked or the account is deleted (cascade) |
| `Account` | `id_token` | OAuth token stored by the NextAuth adapter | Until the provider is unlinked or the account is deleted (cascade) |
| `Session` | `sessionToken` | Better Auth's session token (phase 11, [0018](../decisions/0018-better-auth.md)) | Until the session expires, is revoked, or the account is deleted (cascade) |
| `Session` | `ipAddress` | Lets a user see and revoke their own active sessions from `/account` (BAUTH-4) | The session's own lifetime — removed with it, or with the account (cascade) |
| `Session` | `userAgent` | Same purpose: the device/browser label shown next to each session on `/account` | The session's own lifetime — removed with it, or with the account (cascade) |
| `VerificationToken` | `identifier` | Required by the NextAuth adapter (its magic-link table); unused | Not written |
| `VerificationToken` | `token` | Required by the NextAuth adapter (its magic-link table); unused | Not written |
| `PasswordResetToken` | `tokenHash` | SHA-256 of a password-reset link | Until it expires; the expired row is deleted at the next opportunistic prune (2% of calls), so there is no fixed upper bound; also removed with the account (cascade) |
| `PendingRegistration` | `email` | Address of a signup awaiting confirmation | Until it expires; the expired row is deleted at the next opportunistic prune (2% of calls), so there is no fixed upper bound. Not linked to a `User` |
| `PendingRegistration` | `password` | bcrypt hash, so confirmation does not ask for the password again | Until it expires; the expired row is deleted at the next opportunistic prune (2% of calls), so there is no fixed upper bound. Not linked to a `User` |
| `PendingRegistration` | `name` | Display name given at signup | Until it expires; the expired row is deleted at the next opportunistic prune (2% of calls), so there is no fixed upper bound. Not linked to a `User` |
| `PendingRegistration` | `tokenHash` | SHA-256 of the confirmation link | Until it expires; the expired row is deleted at the next opportunistic prune (2% of calls), so there is no fixed upper bound. Not linked to a `User` |
| `EmailVerificationToken` | `tokenHash` | SHA-256 of an address-confirmation or address-change link | Until it expires; the expired row is deleted at the next opportunistic prune (2% of calls), so there is no fixed upper bound; also removed with the account (cascade) |
| `EmailVerificationToken` | `newEmail` | The address an account is moving to | Until it expires; the expired row is deleted at the next opportunistic prune (2% of calls), so there is no fixed upper bound; also removed with the account (cascade) |
| `RateLimit` | `key` | Rate-limit counter; the key embeds a client IP, an email address or a user id | Until it expires; the expired row is deleted at the next opportunistic prune (1% of calls), so there is no fixed upper bound. The login key for an email is reset on a successful sign-in. Not linked to a `User` |
| `Favorite` | `userId` | Links a saved listing to its owner. The row also stores a snapshot of the public listing (title, price, location, coordinates, URL) | Removing the favorite sets `deletedAt` rather than deleting the row; it is erased **30 days** after that, by `server/retention/service.ts`, or at once if the account is deleted (cascade) |
| `AlertCriteria` | `criteria` | The saved search an alert polls; may hold the coordinates the user chose | While any alert references it. It has no link to a user: deleting the last alert releases it once that alert is purged, **30 days** later, and deleting the account releases it at once unless another user's alert still references it ([alerts.md](../specs/alerts.md), ALERT-42, ALERT-45) |
| `Alert` | `label` | The user's name for a saved search | Deleting the alert sets `deletedAt` rather than deleting the row; it is erased **30 days** after that, by `server/retention/service.ts`, or at once if the account is deleted (cascade). Unsubscribing sets `active` to false and keeps the row |
| `Alert` | `unsubscribeTokenHash` | Hash of the one-click unsubscribe token in every alert email | Never expires. Removed with the alert when the account is deleted (cascade), or 30 days after the alert itself is soft-deleted |
| `Alert` | `unsubscribeSubject` | The HMAC subject the unsubscribe token is derived from, so a link already sent keeps working across an id change | Same as `unsubscribeTokenHash` |
| `SearchHistory` | `query` | A past search | **None defined in practice:** nothing writes this table ([#23](https://github.com/algusaem/buycarmap/issues/23)). A row would go with the account (cascade) |

`AlertMatch` also stores a snapshot of each public listing an alert found (title,
price, location, coordinates, URL), linked to the user through its `Alert`. It
has no personal field of its own, and it is removed with the alert when the
account is deleted (cascade).

Pruning is opportunistic, not scheduled: `server/auth/service.ts` deletes expired
`PendingRegistration`, `PasswordResetToken` and `EmailVerificationToken` rows on
2% of calls from registration, forgot-password and email verification, and
`server/rate-limit/service.ts` deletes expired `RateLimit` rows on 1% of rate-limited calls.
