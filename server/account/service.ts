import { prisma } from "@/lib/db/prisma";
import type { AccountId, UserId } from "@/lib/ids";

// The account feature's database work: the actions in ./actions.ts and the
// account page read in ./queries.ts call into here. Every function is scoped
// to the id it is given. The callers pass the session's own user id, except to
// deleteLinkedAccount(accountId), which takes an Account row id: its caller
// takes that id from the session user's own linked accounts
// (findSignInMethods), and the delete itself is not scoped by user.

/**
 * What the account page renders. `password` is null for OAuth-only accounts,
 * which changes which forms apply; only its presence crosses to the client.
 */
export async function findAccountOverview(userId: UserId) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      password: true,
      name: true,
      email: true,
      emailVerified: true,
      twoFactorEnabledAt: true,
      version: true,
      accounts: { select: { provider: true } },
    },
  });
}

/**
 * Asserts `version` (optimistic locking, DATA-15) and bumps it. Returns
 * whether a row matched: `false` on a conflict.
 */
export async function updateUserName(
  userId: UserId,
  name: string | null,
  version: number,
): Promise<boolean> {
  const { count } = await prisma.user.updateMany({
    where: { id: userId, version },
    data: { name, version: { increment: 1 }, updatedById: userId },
  });
  return count === 1;
}

export async function findPasswordAndEmail(userId: UserId) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { password: true, email: true },
  });
}

/**
 * Asserts `version` (optimistic locking, DATA-15), bumps it, sets the new
 * hash, bumps the revocation clock and drops adapter sessions — all in one
 * transaction, and the sessions are dropped only when the password actually
 * changed, never on a conflict. Returns whether a row matched.
 */
export async function replacePassword(
  userId: UserId,
  hashedPassword: string,
  changedAt: Date,
  version: number,
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.user.updateMany({
      where: { id: userId, version },
      data: {
        password: hashedPassword,
        passwordChangedAt: changedAt,
        version: { increment: 1 },
        updatedById: userId,
      },
    });
    if (count === 0) return false;
    await tx.session.deleteMany({ where: { userId } });
    return true;
  });
}

/** Bumps the revocation clock and drops adapter sessions, in one transaction. */
export async function revokeAllSessions(userId: UserId): Promise<void> {
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { passwordChangedAt: new Date(), version: { increment: 1 }, updatedById: userId },
    }),
    // Adapter-backed sessions, if OAuth is enabled.
    prisma.session.deleteMany({ where: { userId } }),
  ]);
}

export async function findSignInMethods(userId: UserId) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      password: true,
      accounts: { select: { id: true, provider: true } },
    },
  });
}

export async function deleteLinkedAccount(accountId: AccountId): Promise<void> {
  await prisma.account.delete({ where: { id: accountId } });
}

export async function findPasswordHash(userId: UserId) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { password: true },
  });
}

export async function deleteUser(userId: UserId): Promise<void> {
  await prisma.user.delete({ where: { id: userId } });
}
