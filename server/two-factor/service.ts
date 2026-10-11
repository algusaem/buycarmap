import { prisma } from "@/lib/db/prisma";
import type { UserId } from "@/lib/ids";

// BAUTH-11 (docs/specs/core-better-auth.md): enrolment, verification and
// recovery-code storage now live entirely in Better Auth's `twoFactor`
// plugin (lib/auth/auth.ts, server/two-factor/actions.ts) — these two reads
// are the only state this feature still needs straight from Prisma, each for
// a check the plugin's own endpoints do not make the same way.

/**
 * Whether the signed-in account has a password at all. OAuth-only accounts
 * sign in through their provider, which owns its own second factor, so there
 * is no password here for `auth.api.enableTwoFactor` to confirm. The
 * password lives on the "credential" `accounts` row (BAUTH-19).
 */
export async function hasPassword(userId: UserId): Promise<boolean> {
  const credential = await prisma.account.findFirst({
    where: { userId, provider: "credential" },
    select: { password: true },
  });
  return Boolean(credential?.password);
}

/** Whether two-factor is currently on, for the actions that must refuse otherwise. */
export async function isTwoFactorEnabled(userId: UserId): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { twoFactorEnabled: true },
  });
  return Boolean(user?.twoFactorEnabled);
}
