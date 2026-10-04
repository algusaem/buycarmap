// BAUTH-9 (docs/specs/core-better-auth.md): the auto-linking guard. A new
// OAuth provider links automatically onto an existing local account only
// when both sides are verified, and never onto an account with two-factor
// on — otherwise control of a mailbox (or a provider that releases an
// unverified address) could take over a local account that two-factor is
// meant to protect, or skip the second factor entirely by signing in through
// a freshly-linked provider.
//
// The "both sides verified" half is no longer this function's job. Now that
// `lib/auth/auth.ts`'s `account.accountLinking` carries no `trustedProviders`,
// Better Auth's own `handleOAuthUserInfo` (better-auth/dist/oauth2/link-account.mjs)
// already refuses an implicit link whenever the provider's own `emailVerified`
// claim is false, or (via `requireLocalEmailVerified`) whenever the local
// account's `emailConfirmed` is false — our `databaseHooks.account.create.before`
// hook only ever runs afterwards, for a link Better Auth has already decided
// to make. Two-factor is the one refusal Better Auth has no option for, so
// that is all this function still checks. `emailConfirmed` stays as a second,
// explicit check here rather than trusting that silently — a local account
// with two-factor on must stay unlinkable even if the upstream gate above were
// ever misconfigured.
//
// Explicit linking from /account is not offered today: no UI links a
// provider, and `/link-social` is not in `ALLOWED_HTTP_PATHS`
// (lib/auth/auth.ts). So there is no separate, signed-in-session case for
// the caller (`databaseHooks.account.create.before`) to tell apart from the
// implicit one — every account-creation call this function is asked about
// is an implicit link made during sign-in, and goes through this guard.

export interface MayAutoLinkInput {
  localUser: {
    twoFactorEnabled: boolean;
    emailConfirmed: boolean;
  };
}

export function mayAutoLink({ localUser }: MayAutoLinkInput): boolean {
  if (localUser.twoFactorEnabled) return false;
  return localUser.emailConfirmed;
}
