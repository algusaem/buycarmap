// BAUTH-1 (docs/specs/core-better-auth.md): the browser half of Better Auth.
// This and lib/auth/auth.ts are the only two modules that import
// `better-auth`. Client components call `authClient.signIn.social(...)` and
// `authClient.signOut()` directly; email/password sign-in still goes through
// server/auth/actions.ts's `signIn` server action (BAUTH-3), not through this
// client.

import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [twoFactorClient()],
});

// BAUTH-1/BAUTH-5: re-exported from here, not imported directly by proxy.ts,
// because this and lib/auth/auth.ts are the only two modules allowed to
// import any `better-auth/*` path. proxy.ts runs on the Edge runtime and
// cannot import lib/auth/auth.ts's full Prisma-backed instance, so the
// lightweight cookie helper comes through this file instead.
export { getSessionCookie } from "better-auth/cookies";
