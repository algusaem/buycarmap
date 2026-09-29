import { prisma } from "@/lib/db/prisma";

// The account feature's database work: the actions in ./actions.ts and the
// account page read in ./queries.ts call into here. Every function is scoped
// to the id it is given; the callers pass the session's own user id.

/**
 * What the account page renders. `password` is null for OAuth-only accounts,
 * which changes which forms apply; only its presence crosses to the client.
 */
export async function findAccountOverview(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      password: true,
      name: true,
      email: true,
      emailVerified: true,
      twoFactorEnabledAt: true,
      accounts: { select: { provider: true } },
    },
  });
}

export async function updateUserName(userId: string, name: string | null): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { name },
  });
}

export async function findPasswordAndEmail(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { password: true, email: true },
  });
}

/** Sets the new hash, bumps the revocation clock and drops adapter sessions, in one transaction. */
export async function replacePassword(
  userId: string,
  hashedPassword: string,
  changedAt: Date,
): Promise<void> {
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword, passwordChangedAt: changedAt },
    }),
    prisma.session.deleteMany({ where: { userId } }),
  ]);
}

/** Bumps the revocation clock and drops adapter sessions, in one transaction. */
export async function revokeAllSessions(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { passwordChangedAt: new Date() },
    }),
    // Adapter-backed sessions, if OAuth is enabled.
    prisma.session.deleteMany({ where: { userId } }),
  ]);
}

export async function findSignInMethods(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      password: true,
      accounts: { select: { id: true, provider: true } },
    },
  });
}

export async function deleteLinkedAccount(accountId: string): Promise<void> {
  await prisma.account.delete({ where: { id: accountId } });
}

export async function findPasswordHash(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { password: true },
  });
}

export async function deleteUser(userId: string): Promise<void> {
  await prisma.user.delete({ where: { id: userId } });
}
