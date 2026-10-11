import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { notDeleted } from "@/lib/db/soft-delete";
import { ownedBy, type PermissionUser } from "@/lib/auth/permissions";
import type { AccountId, SessionId, UserId } from "@/lib/ids";
import { findCriteriaIdsForUser, releaseCriteriaIfUnused } from "@/server/alerts/service";

// The account feature's database work: the actions in ./actions.ts and the
// account page read in ./queries.ts call into here. Every function is scoped
// to the id it is given. The callers pass the session's own user id, except to
// deleteLinkedAccount(accountId), which takes an Account row id: its caller
// takes that id from the session user's own linked accounts
// (findSignInMethods), and the delete itself is not scoped by user.

// BAUTH-19 (docs/specs/core-better-auth.md): a user's password is the
// "credential" `accounts` row's, never the legacy `users.password` column,
// which the schema no longer names. Null for an OAuth-only account.
function credentialPassword(accounts: { provider: string; password: string | null }[]) {
  return accounts.find((account) => account.provider === "credential")?.password ?? null;
}

/**
 * What the account page renders. `password` is null for OAuth-only accounts,
 * which changes which forms apply; only its presence crosses to the client.
 * `emailConfirmed` is Better Auth's own "email verified" flag (BAUTH-19).
 */
export async function findAccountOverview(userId: UserId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      emailConfirmed: true,
      twoFactorEnabled: true,
      version: true,
      accounts: { select: { provider: true, password: true } },
    },
  });
  if (!user) return null;

  const { accounts, ...overview } = user;
  return {
    ...overview,
    password: credentialPassword(accounts),
    // The "credential" row is Better Auth's own sign-in plumbing, never a
    // provider the user connected, so it must never reach the "connected
    // accounts" list or its count (security review BLOCKER).
    accounts: accounts
      .filter((account) => account.provider !== "credential")
      .map(({ provider }) => ({ provider })),
  };
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
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, accounts: { select: { provider: true, password: true } } },
  });
  if (!user) return null;
  return { email: user.email, password: credentialPassword(user.accounts) };
}

/**
 * Asserts `version` (optimistic locking, DATA-15), bumps it, sets the new
 * hash on the credential account and drops the other sessions — all in one
 * transaction, and the sessions are dropped only when the password actually
 * changed, never on a conflict. Returns whether a row matched.
 */
export async function replacePassword(
  userId: UserId,
  hashedPassword: string,
  version: number,
  // BAUTH-2: excluded from the delete below — changing a password from a
  // signed-in session keeps that one session alive and revokes every other
  // one, unlike signOutEverywhere, which keeps none. Null (no real session
  // on the request, e.g. a test calling this action directly) excludes
  // nothing, so every session is revoked.
  keepSessionId: SessionId | null = null,
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.user.updateMany({
      where: { id: userId, version },
      data: { version: { increment: 1 }, updatedById: userId },
    });
    if (count === 0) return false;
    // BAUTH-19: the credential account is the only place the password lives;
    // Better Auth's sign-in reads it there.
    await tx.account.updateMany({
      where: { userId, provider: "credential" },
      data: { password: hashedPassword },
    });
    await tx.session.deleteMany({
      where: { userId, ...(keepSessionId ? { id: { not: keepSessionId } } : {}) },
    });
    return true;
  });
}

/** Deletes every session of the user: revocation is the row going away. */
export async function revokeAllSessions(userId: UserId): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}

export async function findSignInMethods(userId: UserId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { accounts: { select: { id: true, provider: true, password: true } } },
  });
  if (!user) return null;
  return {
    password: credentialPassword(user.accounts),
    accounts: user.accounts.map(({ id, provider }) => ({ id, provider })),
  };
}

export async function deleteLinkedAccount(accountId: AccountId): Promise<void> {
  await prisma.account.delete({ where: { id: accountId } });
}

export async function findPasswordHash(userId: UserId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { accounts: { select: { provider: true, password: true } } },
  });
  if (!user) return null;
  return { password: credentialPassword(user.accounts) };
}

/**
 * Deletes the user and, in the same transaction, releases every criteria set
 * their alerts referenced — active, inactive or soft-deleted — that no alert
 * references any more (ALERT-45, docs/specs/alerts.md). `AlertCriteria` has
 * no link to a user, so the cascade on `Alert.user` removes the alerts
 * themselves but not the criteria sets they leave behind; a criteria set
 * another user's alert still references, inactive or soft-deleted included,
 * is kept. One transaction, so a failure leaves both the account and its
 * criteria in place rather than an account erased with its search
 * coordinates still stored.
 */
export async function deleteUser(userId: UserId): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const criteriaIds = await findCriteriaIdsForUser(userId, tx);
    await tx.user.delete({ where: { id: userId } });
    for (const criteriaId of criteriaIds) {
      await releaseCriteriaIfUnused(criteriaId, tx);
    }
  });
}

/** BAUTH-4: the signed-in user's own sessions, newest-used first. */
export async function findMySessions(userId: UserId) {
  return prisma.session.findMany({
    where: { userId },
    select: { id: true, userAgent: true, ipAddress: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });
}

/** BAUTH-4: the owning user id of a session, or null if it does not exist. */
export async function findSessionOwner(sessionId: SessionId): Promise<UserId | null> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { userId: true },
  });
  return (session?.userId as UserId | undefined) ?? null;
}

export async function deleteSession(sessionId: SessionId): Promise<void> {
  await prisma.session.delete({ where: { id: sessionId } });
}

/** BAUTH-4: every one of the user's sessions except `keepSessionId`. */
export async function deleteOtherSessions(
  userId: UserId,
  keepSessionId: SessionId | null,
): Promise<void> {
  await prisma.session.deleteMany({
    where: { userId, ...(keepSessionId ? { id: { not: keepSessionId } } : {}) },
  });
}

// EXPORT-5/EXPORT-7: the listing snapshot a favorite and an alert match both
// store, in the order the export writes it.
const SNAPSHOT_SELECT = {
  listingId: true,
  source: true,
  title: true,
  subtitle: true,
  image: true,
  brand: true,
  model: true,
  location: true,
  fuel: true,
  url: true,
  price: true,
  mileage: true,
  year: true,
  lat: true,
  lng: true,
  createdAt: true,
} as const;

type ListingSnapshot = Prisma.FavoriteGetPayload<{ select: typeof SNAPSHOT_SELECT }>;

// Rebuilt key by key rather than passed through: Prisma returns fields in the
// model's order, and the export's key order is part of its contract.
function toSnapshot(row: ListingSnapshot) {
  return {
    listingId: row.listingId,
    source: row.source,
    title: row.title,
    subtitle: row.subtitle,
    image: row.image,
    brand: row.brand,
    model: row.model,
    location: row.location,
    fuel: row.fuel,
    url: row.url,
    price: row.price,
    mileage: row.mileage,
    year: row.year,
    lat: row.lat,
    lng: row.lng,
    createdAt: row.createdAt,
  };
}

/**
 * EXPORT-1..10, EXPORT-19 (docs/specs/account-data-export.md): everything
 * BuyCarMap's database holds about `user`, minus secrets and internal keys.
 * Every read is scoped to `user` in the query (`ownedBy`); alert matches are
 * reached only through the user's own alerts. Soft-deleted rows are left out.
 * Lists are oldest first. `now` decides whether an email change is still
 * pending and is the export's own `exportedAt`.
 */
export async function findMyDataExport(user: PermissionUser, now: Date) {
  const owned = ownedBy(user);

  const [profile, accounts, sessions, favorites, alerts, emailChange] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: {
        email: true,
        name: true,
        image: true,
        locale: true,
        emailConfirmed: true,
        twoFactorEnabled: true,
        twoFactorEnabledAt: true,
        createdAt: true,
      },
    }),
    prisma.account.findMany({
      where: owned,
      select: { provider: true, password: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.session.findMany({
      where: owned,
      select: { createdAt: true, expires: true, ipAddress: true, userAgent: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.favorite.findMany({
      where: { ...owned, ...notDeleted },
      select: SNAPSHOT_SELECT,
      orderBy: { createdAt: "asc" },
    }),
    prisma.alert.findMany({
      where: { ...owned, ...notDeleted },
      select: {
        label: true,
        active: true,
        createdAt: true,
        criteria: { select: { criteria: true } },
        matches: {
          where: notDeleted,
          select: { ...SNAPSHOT_SELECT, notifiedAt: true },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    // EXPORT-19: only the newest change still in progress; never its hash.
    prisma.emailVerificationToken.findFirst({
      where: {
        ...owned,
        newEmail: { not: null },
        usedAt: null,
        expiresAt: { gt: now },
        deletedAt: null,
      },
      select: { newEmail: true, expiresAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const alertMatches = alerts
    .flatMap((alert) =>
      alert.matches.map(({ notifiedAt, ...snapshot }) => ({
        alertLabel: alert.label,
        ...toSnapshot(snapshot),
        notifiedAt,
      })),
    )
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  return {
    exportedAt: now,
    profile: {
      email: profile.email,
      name: profile.name,
      image: profile.image,
      locale: profile.locale,
      emailConfirmed: profile.emailConfirmed,
      twoFactorEnabled: profile.twoFactorEnabled,
      twoFactorEnabledAt: profile.twoFactorEnabledAt,
      createdAt: profile.createdAt,
    },
    pendingEmailChange: emailChange
      ? { newEmail: emailChange.newEmail, expiresAt: emailChange.expiresAt }
      : null,
    signInMethods: {
      password: credentialPassword(accounts) !== null,
      providers: accounts
        .filter((account) => account.provider !== "credential")
        .map((account) => ({ provider: account.provider, linkedAt: account.createdAt })),
    },
    sessions: sessions.map((session) => ({
      createdAt: session.createdAt,
      expiresAt: session.expires,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
    })),
    favorites: favorites.map(toSnapshot),
    alerts: alerts.map((alert) => ({
      label: alert.label,
      criteria: alert.criteria.criteria,
      active: alert.active,
      createdAt: alert.createdAt,
    })),
    alertMatches,
  };
}
