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
 * A user's live sessions, newest-used first: the one filter and order behind
 * the «Sesiones» card's count and line (findAccountOverview) and its dialog's
 * list (findMySessions), so the two never disagree. An expired session is
 * neither counted nor listed (docs/specs/redesign-pages.md, PAGES-35, PAGES-49;
 * decided 2026-10-16, owner).
 */
function liveSessions() {
  return {
    where: { expires: { gt: new Date() } },
    orderBy: { updatedAt: "desc" as const },
  };
}

/** A session as /account shows it, on the «Sesiones» card and in its dialog. */
export interface ListedSession {
  id: string;
  // "" rather than null for a row with no recorded device — a session
  // created outside a real browser request (an older row, or a test). The UI
  // renders this the same way as an unrecognised device, never a blank cell.
  userAgent: string;
  lastUsedAt: Date;
  /** The session behind this very request: «esta», «Este dispositivo» (PAGES-35, PAGES-49). */
  current: boolean;
}

/** One session row as ListedSession, marked `current` when it is the request's own. */
export function toListedSession(
  session: { id: string; userAgent: string | null; updatedAt: Date },
  currentSessionId: SessionId | null,
): ListedSession {
  return {
    id: session.id,
    userAgent: session.userAgent ?? "",
    lastUsedAt: session.updatedAt,
    current: session.id === currentSessionId,
  };
}

/**
 * What the account page renders (docs/specs/redesign-pages.md, PAGES-60), in
 * one query: the profile and `createdAt`, whether there is a password (never
 * the hash, which stays here: an OAuth-only account has none, which changes
 * which cards apply), the linked providers other than `credential`, the
 * counts of the user's saved cars and alerts with soft-deleted ones left out,
 * and the sessions with only their id, user agent and last use (never the
 * token), the live ones newest-used first (liveSessions), as findMySessions
 * reads them minus the IP.
 * Every relation is read through the one user row `userId` selects.
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
      createdAt: true,
      accounts: { select: { provider: true, password: true } },
      _count: { select: { favorites: { where: notDeleted }, alerts: { where: notDeleted } } },
      sessions: { ...liveSessions(), select: { id: true, userAgent: true, updatedAt: true } },
    },
  });
  if (!user) return null;

  const { accounts, _count, ...overview } = user;
  return {
    ...overview,
    hasPassword: credentialPassword(accounts) !== null,
    // The "credential" row is Better Auth's own sign-in plumbing, never a
    // provider the user connected, so it must never reach the Google card
    // (security review BLOCKER).
    providers: accounts
      .map((account) => account.provider)
      .filter((provider) => provider !== "credential"),
    favoritesCount: _count.favorites,
    alertsCount: _count.alerts,
  };
}

/**
 * Asserts `version` (optimistic locking, DATA-15) and bumps it. Returns the
 * row's new version, or `null` on a conflict: the update matched exactly
 * `version` and moved it on by one.
 */
export async function updateUserName(
  userId: UserId,
  name: string | null,
  version: number,
): Promise<number | null> {
  const { count } = await prisma.user.updateMany({
    where: { id: userId, version },
    data: { name, version: { increment: 1 }, updatedById: userId },
  });
  return count === 1 ? version + 1 : null;
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
 * changed, never on a conflict. Returns the row's new version, or `null` on
 * a conflict, as updateUserName does.
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
): Promise<number | null> {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.user.updateMany({
      where: { id: userId, version },
      data: { version: { increment: 1 }, updatedById: userId },
    });
    if (count === 0) return null;
    // BAUTH-19: the credential account is the only place the password lives;
    // Better Auth's sign-in reads it there.
    await tx.account.updateMany({
      where: { userId, provider: "credential" },
      data: { password: hashedPassword },
    });
    await tx.session.deleteMany({
      where: { userId, ...(keepSessionId ? { id: { not: keepSessionId } } : {}) },
    });
    return version + 1;
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

/**
 * BAUTH-4: the signed-in user's own sessions, newest-used first. An expired
 * session is not listed (docs/specs/redesign-pages.md, PAGES-49).
 */
export async function findMySessions(userId: UserId) {
  const live = liveSessions();
  return prisma.session.findMany({
    where: { userId, ...live.where },
    select: { id: true, userAgent: true, ipAddress: true, updatedAt: true },
    orderBy: live.orderBy,
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
        placeName: true,
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
      // EXPORT-6, amended by redesign-alerts.md (ALERTUI-46): null when none.
      placeName: alert.placeName,
      criteria: alert.criteria.criteria,
      active: alert.active,
      createdAt: alert.createdAt,
    })),
    alertMatches,
  };
}
