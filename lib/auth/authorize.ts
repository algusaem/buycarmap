import { prisma } from "@/lib/prisma";
import { verifyPassword, DUMMY_PASSWORD_HASH } from "@/lib/auth/hash";
import {
  RATE_LIMITS,
  consumeRateLimit,
  getClientIp,
  isRateLimited,
  resetRateLimit,
} from "@/lib/rate-limit";
import { AUTH_ERROR } from "@/lib/validations/auth";

export interface AuthorizedUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
}

export function loginEmailRateKey(email: string): string {
  return `login:email:${email}`;
}

// Credentials-provider authorization, extracted from the NextAuth route so it
// can be unit-tested in isolation. Returns the user on success, null otherwise.
//
// Returning null yields a generic "CredentialsSignin" error, so a wrong
// password and an unknown account are indistinguishable to the caller.
// Throwing, by contrast, propagates the message to the client (NextAuth 4
// redirects with `error=<message>`) — used only for rate limiting, where the
// user genuinely needs to know why they are being turned away and the signal
// reveals nothing about whether the account exists.
export async function authorizeCredentials(
  credentials: Record<"email" | "password", string> | undefined,
): Promise<AuthorizedUser | null> {
  if (!credentials?.email || !credentials?.password) {
    return null;
  }

  const email = credentials.email.trim().toLowerCase();
  const emailKey = loginEmailRateKey(email);

  // Per-IP budget is consumed on every attempt, successful or not, so a single
  // host cannot grind through a password list even across many accounts.
  const ip = await getClientIp();
  const ipBudget = await consumeRateLimit(
    `login:ip:${ip}`,
    RATE_LIMITS.loginPerIp,
  );

  if (!ipBudget.allowed) {
    throw new Error(AUTH_ERROR.rateLimited);
  }

  // Per-account lockout counts only failures (see below) and is checked without
  // consuming, so a locked-out account does not extend its own lockout.
  //
  // Tradeoff: this lets someone deliberately lock a known address out for the
  // window length. The window is short (15 min) and the per-IP budget bounds
  // how cheaply it can be sustained, which is the usual balance — the
  // alternative is leaving online password guessing unbounded.
  if (await isRateLimited(emailKey, RATE_LIMITS.loginPerEmail)) {
    throw new Error(AUTH_ERROR.rateLimited);
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // `user.password` is null for accounts created through OAuth. Treat those
  // exactly like a wrong password — telling the caller "this account exists but
  // uses Google" would be an enumeration oracle.
  if (!user?.password) {
    // Equalize timing with the found-user path (see DUMMY_PASSWORD_HASH).
    await verifyPassword(credentials.password, DUMMY_PASSWORD_HASH);
    await consumeRateLimit(emailKey, RATE_LIMITS.loginPerEmail);
    return null;
  }

  const isValidPassword = await verifyPassword(
    credentials.password,
    user.password,
  );

  if (!isValidPassword) {
    await consumeRateLimit(emailKey, RATE_LIMITS.loginPerEmail);
    return null;
  }

  // Clear the failure counter so a user who eventually remembers their password
  // is not locked out by earlier typos.
  await resetRateLimit(emailKey);

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
  };
}
