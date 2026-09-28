import type { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { authorizeCredentials } from "@/lib/auth/authorize";
import { appUrl, env, isGitHubConfigured, isGoogleConfigured } from "@/lib/env";

// Sessions last a week rather than NextAuth's 30-day default: a stolen JWT is
// valid until it expires, and there is no server-side session record to delete,
// so the expiry window *is* the blast radius.
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const SESSION_UPDATE_AGE_SECONDS = 24 * 60 * 60;

// How often an active session is re-checked against the database. A check on
// every request would add a query to every authenticated page load; five
// minutes bounds how long a revoked session can outlive its revocation.
const REVALIDATE_INTERVAL_MS = 5 * 60 * 1000;

// Cookies are marked Secure based on the app's own configured URL rather than
// NODE_ENV, so a production deploy that forgets NEXTAUTH_URL cannot silently
// downgrade session cookies to plaintext-transmissible.
const useSecureCookies = appUrl.startsWith("https://");

function buildProviders(): AuthOptions["providers"] {
  const providers: AuthOptions["providers"] = [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        // Only sent on the second attempt, after `authorize` has reported that
        // the account has two-factor enabled.
        totp: { label: "Authentication code", type: "text" },
      },
      authorize: (credentials) => authorizeCredentials(credentials),
    }),
  ];

  // Each provider is registered only when both halves of its secret pair are
  // present, so an unconfigured provider is absent rather than broken.
  if (isGoogleConfigured) {
    providers.push(
      GoogleProvider({
        clientId: env.GOOGLE_CLIENT_ID as string,
        clientSecret: env.GOOGLE_CLIENT_SECRET as string,
        // Account-linking policy: if someone registered with a password and
        // later signs in with Google on the same address, link the identities
        // instead of failing with OAuthAccountNotLinked.
        //
        // The scary name refers to trusting the provider's email claim. Google
        // only releases addresses it has verified, and anyone who controls the
        // mailbox could already take the account over through password reset —
        // so linking grants no capability they did not already have.
        allowDangerousEmailAccountLinking: true,
      }),
    );
  }

  if (isGitHubConfigured) {
    providers.push(
      GitHubProvider({
        clientId: env.GITHUB_ID as string,
        clientSecret: env.GITHUB_SECRET as string,
        // Same reasoning as Google: NextAuth reads GitHub's *primary verified*
        // address, which GitHub requires to be confirmed.
        allowDangerousEmailAccountLinking: true,
      }),
    );
  }

  return providers;
}

const hasOAuth = isGoogleConfigured || isGitHubConfigured;

export const authOptions: AuthOptions = {
  // The adapter exists only to persist OAuth identity links. It is omitted
  // entirely when no OAuth provider is configured, so the credentials-only
  // deployment does no extra database work.
  ...(hasOAuth ? { adapter: PrismaAdapter(prisma) } : {}),
  providers: buildProviders(),
  secret: env.NEXTAUTH_SECRET,
  useSecureCookies,
  session: {
    // Credentials sign-in requires JWT; NextAuth cannot issue database sessions
    // for it. Revocation is therefore handled in the `jwt` callback below.
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE_SECONDS,
    updateAge: SESSION_UPDATE_AGE_SECONDS,
  },
  jwt: {
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    /**
     * Guards OAuth sign-in for accounts that have two-factor enabled.
     *
     * Policy: signing in through a provider does not ask for our TOTP code —
     * the provider runs its own second factor. That only holds if the link is
     * one the account owner actually established. Auto-linking by verified
     * email otherwise lets anyone who compromises the mailbox mint a fresh
     * Google account on that address, sign in, and skip the second factor
     * entirely — precisely the scenario 2FA exists to survive.
     *
     * So: linking stays automatic for accounts without 2FA, and an account
     * with 2FA can only be reached through a provider it is already linked to.
     * Adding a new provider is still possible from /account, where the session
     * has already cleared the second factor.
     *
     * NextAuth calls this before `callback-handler`, which is what creates the
     * Account row — returning false prevents the link rather than undoing it.
     */
    async signIn({ user, account }) {
      // Credentials sign-in is handled by `authorize`, which enforces 2FA.
      if (account?.type !== "oauth" || !user.email) {
        return true;
      }

      const existing = await prisma.user.findUnique({
        where: { email: user.email },
        select: {
          twoFactorEnabledAt: true,
          accounts: { select: { provider: true } },
        },
      });

      // A brand-new account created through the provider — nothing to hijack.
      if (!existing?.twoFactorEnabledAt) {
        return true;
      }

      const alreadyLinked = existing.accounts.some(
        (linked) => linked.provider === account.provider,
      );

      // Surfaces as ?error=AccessDenied on /login, which the form translates.
      return alreadyLinked;
    },

    async jwt({ token, user, trigger }) {
      // Fresh sign-in: stamp the session so later password changes can outdate
      // it, and skip the revalidation query we just implicitly performed.
      if (user) {
        token.id = user.id;
        token.pwdAt = Date.now();
        token.checkedAt = Date.now();
        return token;
      }

      const isDue =
        typeof token.checkedAt !== "number" ||
        Date.now() - token.checkedAt >= REVALIDATE_INTERVAL_MS;

      if (trigger !== "update" && !isDue) {
        return token;
      }

      const dbUser = await prisma.user.findUnique({
        where: { id: token.id },
        select: {
          email: true,
          name: true,
          image: true,
          passwordChangedAt: true,
        },
      });

      // Throwing here is the documented-by-behaviour revocation hook: NextAuth's
      // session route catches it, clears the session cookie, and returns a null
      // session. Returning a token — any token — would keep the user signed in.
      if (!dbUser) {
        // Account deleted while the session was live.
        throw new Error("SessionRevoked");
      }

      // Tokens minted before this field existed have no stamp. Adopt the
      // current time so they become revocable from now on rather than
      // permanently exempt.
      if (typeof token.pwdAt !== "number") {
        token.pwdAt = Date.now();
      } else if (dbUser.passwordChangedAt.getTime() > token.pwdAt) {
        throw new Error("SessionRevoked");
      }

      // Keep the session in step with profile edits without a re-login.
      token.email = dbUser.email;
      token.name = dbUser.name;
      token.picture = dbUser.image;
      token.checkedAt = Date.now();

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.email = token.email as string;
        session.user.name = token.name;
        session.user.image = token.picture;
      }
      return session;
    },
  },
};
