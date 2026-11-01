import { createHash } from "node:crypto";
import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { appUrl, isEmailConfigured } from "@/lib/app-config";
import { createElement } from "react";
import { sendEmail } from "@/lib/platform/email";
import { AlertDigestEmail, subject as alertDigestSubject } from "@/emails/AlertDigestEmail";
import { renderEmail } from "@/emails/render";
import { DEFAULT_LOCALE, isValidLocale } from "@/lib/i18n/config";
import { getCurrentLocale } from "@/lib/i18n/current-locale";
import { notDeleted } from "@/lib/db/soft-delete";
import { ownedBy } from "@/lib/auth/permissions";
import {
  alertIdSchema,
  type AlertCriteriaId,
  type AlertId,
  type AlertPollJobId,
  asAlertCriteriaId,
  asAlertId,
  asAlertPollJobId,
  type UserId,
  uuidv7,
} from "@/lib/ids";
import { saveUserLocale } from "@/server/locale/service";
import { closeRunGate, markAlertsChanged, nextDueAt, openRunGate } from "./run-gate";
import { searchAllSources } from "./search";
import { hashUnsubscribeToken, unsubscribeTokenFor } from "./unsubscribe-token";
import type { CarListing } from "@/interfaces/listing";
import type {
  AlertSummary,
  AlertsPageData,
  AlertWithMatches,
  RunSummary,
} from "@/interfaces/alert";
import { hasPlace, type SearchInput } from "@/lib/search/schema";
import { err, ok, type Result } from "@/lib/result";
import {
  ALERT_ERROR,
  type AlertErrorCode,
  type CreateAlertOutcome,
  parseStoredCriteria,
} from "./schema";

// --- Domain rules ------------------------------------------------------------

/**
 * A proxy for the real constraint, which is total distinct criteria sets —
 * that is what the upstreams see. Each alert is a standing claim on a
 * rate-limited API, so an unbounded count lets one account consume the shared
 * budget that protects search.
 */
export const MAX_ALERTS_PER_USER = 20;

/**
 * Recursively sorts object keys and drops `undefined`.
 *
 * Two users building the same filters through different UI paths produce
 * objects with different key order and different absent-vs-undefined fields.
 * Hashing them raw would give two criteria rows for one question, and the
 * upstream saving from deduplication is the whole reason this feature scales.
 */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    // Arrays here are unordered sets (`engine`, `gearbox`), so ["a","b"] and
    // ["b","a"] are the same filter and must hash alike.
    return [...value].map(canonicalize).sort();
  }
  if (value !== null && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .reduce<Record<string, unknown>>((out, [key, entry]) => {
        out[key] = canonicalize(entry);
        return out;
      }, {});
  }
  return value;
}

/** Stable identity for a criteria set, so equivalent filters share one row. */
export function hashCriteria(criteria: SearchInput): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(criteria)))
    .digest("hex");
}

// --- Subscriptions (the actions in ./actions.ts) -----------------------------

/** Records listings as already seen for a criteria set, so they are never new again. */
async function recordSeen(
  criteriaId: AlertCriteriaId,
  listings: CarListing[],
  db: Prisma.TransactionClient = prisma,
): Promise<void> {
  await db.alertSeenListing.createMany({
    data: listings.map((listing) => ({
      criteriaId,
      listingId: listing.id,
      source: listing.source,
    })),
    skipDuplicates: true,
  });
}

/**
 * Records everything currently listed as already-seen, without emailing.
 *
 * Every match exists on the first poll, so without this the user's reward for
 * creating an alert is a mail containing every car on the site. Failures are
 * swallowed deliberately: a seed that could not run leaves an empty seen-list,
 * which the first real poll fills — a noisy first alert is a far better outcome
 * than refusing to create the alert at all.
 */
async function seedSeenListings(criteriaId: AlertCriteriaId, criteria: SearchInput): Promise<void> {
  try {
    const { listings } = await searchAllSources(criteria);
    if (listings.length === 0) return;

    await recordSeen(criteriaId, listings);
  } catch {
    // Nothing to do — see above.
  }
}

/**
 * The caller's own alert on a criteria set, as `createAlertForUser` treats it
 * (MAPUI-43): none, live (active and not deleted), paused from the email
 * (`active: false`) or soft-deleted.
 */
async function existingAlertState(
  tx: Prisma.TransactionClient,
  userId: UserId,
  criteriaId: AlertCriteriaId,
): Promise<"none" | "live" | "paused" | "deleted"> {
  const alert = await tx.alert.findFirst({
    where: { ...ownedBy({ id: userId }), criteriaId },
    select: { active: true, deletedAt: true },
  });
  if (!alert) return "none";
  if (alert.deletedAt !== null) return "deleted";
  return alert.active ? "live" : "paused";
}

/** Whether the user already has as many alerts as one account may (ALERT-8). */
async function isAtAlertCap(tx: Prisma.TransactionClient, userId: UserId): Promise<boolean> {
  const count = await tx.alert.count({ where: { ...ownedBy({ id: userId }), ...notDeleted } });
  return count >= MAX_ALERTS_PER_USER;
}

/**
 * Subscribes a user to an already validated, specific-enough criteria set.
 * Returns the error code to report, or whether the alert is new (MAPUI-43):
 * `created: false` when the user already had a live alert on these criteria,
 * `true` for a new one, a paused one reactivated or a soft-deleted one
 * restored — the last two take the new label.
 */
export async function createAlertForUser(
  userId: UserId,
  criteria: SearchInput,
  label: string,
  placeName: string | null = null,
): Promise<Result<CreateAlertOutcome, AlertErrorCode>> {
  const criteriaHash = hashCriteria(criteria);
  // ALERTUI-46, ALERTUI-47: the place name is the user's, so it goes on their
  // own alert row and never into the shared criteria or their hash. A name
  // sent with criteria that have no place names nothing, and is not stored.
  const storedPlaceName = hasPlace(criteria) ? placeName : null;

  // An explicit id, because the unsubscribe token is an HMAC over it and the
  // row needs the hash at insert time — and because `unsubscribeSubject`
  // needs it too (docs/decisions/0015-data-model-conventions.md). Generated
  // here, not left to the database default, so both can be set on the same
  // insert with no follow-up write.
  const alertId = uuidv7();
  const unsubscribeTokenHash = hashUnsubscribeToken(unsubscribeTokenFor(alertId));

  // ALERT-46: the criteria row and the alert row commit together. A criteria
  // row left behind by a failed save would make the retry treat it as
  // existing and skip the seed, so the first real poll would email every
  // listing already there.
  //
  // MAPUI-43: whether the alert is new is decided here, from the rows this
  // transaction reads, never from a separate query before it. The transaction
  // runs at Postgres' default READ COMMITTED, so this narrows the window
  // rather than closing it: what holds under parallel saves is the unique keys
  // — one criteria row per hash (ALERT-49 retries on it) and one alert row per
  // user and criteria set — so no duplicate is ever stored. Two parallel saves
  // of the same criteria by one user can both answer `created: true`, and the
  // cap count is not locked against a parallel save of other criteria. Only
  // the caller's own alert is looked at.
  const saveCriteriaAndAlert = () =>
    prisma.$transaction(async (tx) => {
      const existingCriteria = await tx.alertCriteria.findUnique({
        where: { criteriaHash },
      });
      const existing = existingCriteria
        ? await existingAlertState(tx, userId, asAlertCriteriaId(existingCriteria.id))
        : "none";

      // A live alert on these criteria: nothing is written, and the cap has
      // nothing to refuse, since no subscription is added.
      if (existing === "live") return { outcome: "alreadyLive" as const };

      // DATA-10 (docs/specs/core-data-model.md): a soft-deleted alert does not
      // count against the cap — it is no longer an active subscription — so
      // restoring one adds a subscription exactly as a new alert does. A
      // paused alert still counts, so reactivating it adds none.
      if (existing !== "paused" && (await isAtAlertCap(tx, userId))) {
        return { outcome: "tooManyAlerts" as const };
      }

      const criteriaRow =
        existingCriteria ?? (await tx.alertCriteria.create({ data: { criteriaHash, criteria } }));
      const id = asAlertCriteriaId(criteriaRow.id);

      // DATA-11: upsert rather than create-and-catch — a row this user already
      // has (paused or soft-deleted) is matched by the same unique key
      // regardless of `deletedAt`, so the `update` branch restores a deleted
      // one (clearing `deletedAt`, bumping `version`) exactly as saving over a
      // soft-deleted favorite does, and reactivates a paused one, each with the
      // new label (MAPUI-43).
      await tx.alert.upsert({
        where: { userId_criteriaId: { ...ownedBy({ id: userId }), criteriaId: id } },
        create: {
          id: alertId,
          userId,
          criteriaId: id,
          label,
          placeName: storedPlaceName,
          active: true,
          unsubscribeTokenHash,
          unsubscribeSubject: alertId,
          createdById: userId,
        },
        update: {
          label,
          placeName: storedPlaceName,
          active: true,
          deletedAt: null,
          version: { increment: 1 },
          updatedById: userId,
        },
      });

      return { outcome: "saved" as const, criteriaId: id, criteriaIsNew: !existingCriteria };
    });

  // ALERT-49: two saves of the same new criteria can both miss the lookup;
  // the second insert then fails on the unique `criteriaHash`. Postgres
  // aborts the transaction on that failed insert, so it cannot be caught
  // inside it: run the whole save once more, which finds the committed row
  // as existing and leaves the seed to the save that created it.
  let saved: Awaited<ReturnType<typeof saveCriteriaAndAlert>>;
  try {
    saved = await saveCriteriaAndAlert();
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) {
      throw error;
    }
    saved = await saveCriteriaAndAlert();
  }
  if (saved.outcome === "alreadyLive") return ok({ created: false });
  if (saved.outcome === "tooManyAlerts") return err(ALERT_ERROR.tooManyAlerts);

  // ALERT-53: a new, reactivated or restored alert can be due at once.
  await markAlertsChanged();

  // Only when the criteria set is new: an existing one already has a
  // seen-list, and re-seeding would spend three upstream requests to learn
  // what is already recorded. After the commit, never inside it: the seed is
  // network I/O.
  if (saved.criteriaIsNew) {
    await seedSeenListings(saved.criteriaId, criteria);
  }

  await backfillLocale(userId);

  return ok({ created: true });
}

/**
 * Stores the request's locale when the account has none.
 *
 * The alert runner is a cron with no request to read a cookie or
 * accept-language from, so an account that never touched the language switcher
 * would be mailed in the default locale — Spanish — regardless of what the
 * browser asked for. This is the moment that starts to matter, and it costs one
 * write per user.
 */
async function backfillLocale(userId: UserId): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  // An explicit choice outranks an inferred one, so a stored value is never
  // overwritten here.
  if (!user || user.locale) return;

  const locale = await getCurrentLocale();
  await saveUserLocale(userId, locale);
}

/**
 * The snapshot a match is rendered from (docs/specs/redesign-alerts.md,
 * Contracts › Server): every field the cards, the rows, the sheet, the
 * preview and the pins read, and nothing else of the row.
 */
const MATCH_SNAPSHOT = {
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
} satisfies Prisma.AlertMatchSelect;

/** A match's stored snapshot, as the alert pages' reads select it. */
type StoredMatch = Prisma.AlertMatchGetPayload<{ select: typeof MATCH_SNAPSHOT }>;

/**
 * A stored match as the listing it was found as (ALERT-39): the snapshot with
 * its listing's id. Shared by the /alerts read and the /alerts/[id] read.
 */
function matchListing({ listingId, ...snapshot }: StoredMatch): CarListing {
  return { id: listingId, ...snapshot };
}

/**
 * Newest first (ALERTUI-44, ALERTUI-45): by `createdAt`, then by the
 * time-ordered UUIDv7 id, so two rows written in the same millisecond keep
 * one order.
 */
const NEWEST_FIRST = [{ createdAt: "desc" as const }, { id: "desc" as const }];

/**
 * What both alert pages read of an alert itself (docs/specs/redesign-alerts.md,
 * Contracts › Server): its name, place name, state, creation date and stored
 * criteria. No unsubscribe token, subject, delivery or audit column.
 */
const ALERT_HEADER = {
  id: true,
  label: true,
  placeName: true,
  active: true,
  createdAt: true,
  criteria: { select: { criteria: true } },
} satisfies Prisma.AlertSelect;

/** An alert's header, as both pages' reads select it. */
type StoredAlertHeader = Prisma.AlertGetPayload<{ select: typeof ALERT_HEADER }>;

/** An alert's header as the pages render it, shared by the /alerts read and the /alerts/[id] read. */
function alertHeader(row: StoredAlertHeader): Omit<AlertWithMatches, "matches"> {
  return {
    id: asAlertId(row.id),
    label: row.label,
    placeName: row.placeName,
    // The column is Json, so what comes out is not typed just because what
    // went in was: read back with the search schema.
    criteria: parseStoredCriteria(row.criteria.criteria) ?? {},
    active: row.active,
    createdAt: row.createdAt,
  };
}

/**
 * The caller's alerts for /alerts, newest first, soft-deleted ones left out
 * (ALERTUI-44), with only the fields the cards read.
 */
export async function findAlertSummaries(userId: UserId): Promise<AlertSummary[]> {
  const rows = await prisma.alert.findMany({
    where: { ...ownedBy({ id: userId }), ...notDeleted },
    select: { ...ALERT_HEADER, _count: { select: { matches: true } } },
    orderBy: NEWEST_FIRST,
  });

  return rows.map((row) => ({ ...alertHeader(row), matchCount: row._count.matches }));
}

/**
 * docs/specs/redesign-alerts.md (ALERTUI-44; Contracts › Server): the open
 * alert's matches for /alerts, newest first, from their stored snapshot — only
 * when the alert is the caller's and not deleted.
 */
async function findOpenAlertMatches(userId: UserId, alertId: AlertId): Promise<CarListing[]> {
  const matches = await prisma.alertMatch.findMany({
    where: { alertId, alert: { ...ownedBy({ id: userId }), ...notDeleted } },
    select: MATCH_SNAPSHOT,
    orderBy: NEWEST_FIRST,
  });
  return matches.map(matchListing);
}

/**
 * docs/specs/redesign-alerts.md (ALERTUI-12; Contracts › URL): the open alert
 * on /alerts — the requested id when it is one of the caller's listed alerts
 * (`alertIds`, newest first), the newest otherwise, and null with no alert.
 */
export function resolveOpenAlertId(
  alertIds: readonly AlertId[],
  requested: string | null | undefined,
): AlertId | null {
  const chosen = requested ? alertIds.find((id) => id === requested) : undefined;
  return chosen ?? alertIds[0] ?? null;
}

/**
 * docs/specs/redesign-alerts.md (ALERTUI-12, ALERTUI-44): what /alerts reads
 * for `requested`, the URL's `alert`. The caller's alerts; the open alert,
 * resolved among them only, so a foreign or deleted id reads none of its rows
 * and opens the newest; then that one alert's matches. Two reads, whatever
 * the number of alerts.
 */
export async function findAlertsPage(
  userId: UserId,
  requested: string | null | undefined,
): Promise<AlertsPageData> {
  const alerts = await findAlertSummaries(userId);
  const openAlertId = resolveOpenAlertId(
    alerts.map((alert) => alert.id),
    requested,
  );
  if (!openAlertId) return { alerts, openAlertId: null, matches: [] };
  const matches = await findOpenAlertMatches(userId, openAlertId);
  return { alerts, openAlertId, matches };
}

/** Soft delete (DATA-10): sets `deletedAt` rather than removing the row. */
export async function deleteAlertForUser(userId: UserId, alertId: AlertId): Promise<void> {
  const doomed = await prisma.alert.findFirst({
    where: { id: alertId, ...ownedBy({ id: userId }), ...notDeleted },
  });

  // Scoped by userId, so this cannot reach another account's row. Reports
  // success whether or not anything matched: the caller asked for the alert
  // not to exist, and it does not. Saying otherwise would confirm that
  // someone else's alert does.
  const { count } = await prisma.alert.updateMany({
    where: { id: alertId, ...ownedBy({ id: userId }), ...notDeleted },
    data: { deletedAt: new Date() },
  });

  if (doomed) await releaseCriteriaIfUnused(asAlertCriteriaId(doomed.criteriaId));
  // ALERT-53: one fewer active criteria set can shorten a stretched interval.
  if (count > 0) await markAlertsChanged();
}

/**
 * Deletes a criteria set once no alert references it at all.
 *
 * Retaining orphaned seen-lists was specified first, on the reasoning that it
 * avoids re-notifying on re-subscribe. That reasoning is wrong: seeding is
 * already silent, so a rebuilt seen-list mails nobody, and retention only saves
 * one poll while costing a cleanup path and rows that accumulate forever.
 *
 * An *inactive* alert still counts as a reference, so unsubscribing keeps the
 * criteria and its history. **Deliberately unfiltered by `deletedAt` too**
 * (DATA-10/DATA-12): `AlertCriteria` cascades to `Alert` on delete, so
 * releasing it the instant its last alert is soft-deleted would hard-delete
 * that alert immediately, through the cascade — defeating the 30-day undo
 * window the soft delete exists to give it. A criteria set left with only
 * soft-deleted referrers is released once `server/retention/service.ts`
 * purges them (ALERT-42, DATA-12), 30 days after the last one was deleted.
 *
 * Takes an optional transaction client so account deletion (ALERT-45,
 * server/account/service.ts) can run the count and the delete inside the
 * same transaction as the user row's own deletion, rather than duplicating
 * this rule.
 */
export async function releaseCriteriaIfUnused(
  criteriaId: AlertCriteriaId,
  db: Prisma.TransactionClient = prisma,
): Promise<void> {
  const remaining = await db.alert.count({ where: { criteriaId } });
  if (remaining > 0) return;
  await db.alertCriteria.delete({ where: { id: criteriaId } });
}

/**
 * Every criteria set a user's alerts reference — active, inactive or
 * soft-deleted alike. Account deletion (ALERT-45) reads this *before*
 * deleting the user, because the cascade on `Alert.user` removes the rows
 * this query reads: calling it after would always see zero alerts of the
 * user's own and release every criteria set, even one another user still
 * watches.
 */
export async function findCriteriaIdsForUser(
  userId: UserId,
  db: Prisma.TransactionClient = prisma,
): Promise<AlertCriteriaId[]> {
  const rows = await db.alert.findMany({
    where: { userId },
    select: { criteriaId: true },
    distinct: ["criteriaId"],
  });
  return rows.map((row) => asAlertCriteriaId(row.criteriaId));
}

// --- The alert matches page (./queries.ts) -----------------------------------

/**
 * Still re-validates `alertId`'s shape here even though the parameter is
 * branded: `server/alerts/queries.ts` casts a raw URL segment to `AlertId`
 * with `asAlertId` rather than parsing it, so the brand alone does not
 * guarantee a well-formed UUID reached this call. A malformed id resolves to
 * "not found" here instead of throwing out of Prisma the way a well-formed
 * but non-existent one does.
 */
export async function findAlertWithMatches(
  userId: UserId,
  alertId: AlertId,
): Promise<AlertWithMatches | null> {
  if (!alertIdSchema.safeParse(alertId).success) return null;

  // Scoped by userId, so another account's alert is not found at all. Only
  // what the page renders is read (docs/specs/redesign-alerts.md, ALERTUI-45):
  // no unsubscribe token, subject, delivery or audit column reaches it.
  const row = await prisma.alert.findFirst({
    where: { id: alertId, ...ownedBy({ id: userId }), ...notDeleted },
    select: { ...ALERT_HEADER, matches: { select: MATCH_SNAPSHOT, orderBy: NEWEST_FIRST } },
  });
  if (!row) return null;

  return { ...alertHeader(row), matches: row.matches.map(matchListing) };
}

// --- The unsubscribe link (app/api/alerts/unsubscribe/route.ts) ---------------

/**
 * Pauses the alert a raw unsubscribe token belongs to, if any.
 *
 * Deactivates rather than deletes: the matches page still renders, and
 * re-enabling the alert loses no history. Only deleting the alert releases its
 * criteria set.
 */
export async function pauseAlertByUnsubscribeToken(token: string): Promise<void> {
  const { count } = await prisma.alert.updateMany({
    where: { unsubscribeTokenHash: hashUnsubscribeToken(token) },
    data: { active: false },
  });
  // ALERT-53: as deleting one. An unknown token changes nothing (ALERT-27).
  if (count > 0) await markAlertsChanged();
}

// --- The alert runner (app/api/alerts/run/route.ts) --------------------------
//
// One run does three things in order: enqueue what is due, drain a bounded
// slice of the queue, then deliver whatever is pending. See
// docs/specs/alerts.md › Decisions and rationale.

const BASE_INTERVAL_MS = 5 * 60_000;
/** The upstream budget the cadence stretches to respect. Unmeasured — see docs/specs/alerts.md › Open questions. */
const REQUESTS_PER_MINUTE_CEILING = 60;
const REQUESTS_PER_POLL = 3;
const SLICE_SIZE = 25;
/** Returns before the platform's invocation timeout, leaving the rest queued. */
const WORKER_BUDGET_MS = 45_000;
const MAX_ATTEMPTS = 3;
/**
 * ALERT-48: a `running` job whose lease is older than this was left by a worker
 * that died, and is reclaimed. Longer than the route's `maxDuration`, so a live
 * run can never hold a job past it.
 */
const LEASE_TIMEOUT_MS = 10 * 60_000;
/** Deliberately longer than the interval: a failing upstream is polled less. */
const BACKOFF_MINUTES = [5, 15, 45];
const EMPTY_RUNS_BEFORE_UNHEALTHY = 3;

/**
 * The interval every criteria set is polled at.
 *
 * Stretches uniformly once the criteria count would push the request rate past
 * the ceiling. Uniformly, and not by how useful each alert is: the alert that
 * matches once a month is usually the rare car someone set the alert *for*, so
 * demoting quiet alerts would delay exactly the ones that matter most.
 */
function effectiveIntervalMs(criteriaCount: number): number {
  const minutesNeeded = (criteriaCount * REQUESTS_PER_POLL) / REQUESTS_PER_MINUTE_CEILING;
  return Math.max(BASE_INTERVAL_MS, Math.ceil(minutesNeeded) * 60_000);
}

/**
 * One full alert run: enqueue, drain, deliver, then report source health —
 * unless the "nothing due" gate says no work can be due yet (ALERT-51), in
 * which case not a single query is made. A run that does work ends by storing
 * when the next one can have any (ALERT-52).
 */
export async function runAlerts(now: Date): Promise<RunSummary> {
  const summary: RunSummary = {
    claimed: 0,
    polled: 0,
    matched: 0,
    emailed: 0,
    skippedNoEmail: 0,
    criteriaCount: 0,
    intervalMs: BASE_INTERVAL_MS,
    oldestPendingAgeMs: 0,
    unhealthySources: [],
    failures: [],
    nothingDue: false,
  };

  const gate = await openRunGate(now);
  if (gate.nothingDue) return { ...summary, nothingDue: true };

  await enqueueDueCriteria(now, summary);
  await drainQueue(now, summary);
  const undelivered = await deliverPendingMatches(summary);
  await reportUnhealthySources(summary);

  if (gate.observed !== undefined) {
    await closeRunGate(gate, now, await findNextDueAt(now, summary.intervalMs, undelivered));
  }

  return summary;
}

/**
 * ALERT-52: the earliest moment the next run can have work, read after this
 * run's own writes — two small reads on a compute that is already awake.
 */
async function findNextDueAt(now: Date, intervalMs: number, undelivered: boolean): Promise<number> {
  const [criteria, jobs] = await Promise.all([
    prisma.alertCriteria.findMany({
      where: { alerts: { some: { active: true, deletedAt: null } } },
      select: { id: true, lastPolledAt: true },
    }),
    prisma.alertPollJob.findMany({
      select: { criteriaId: true, status: true, availableAt: true, lockedAt: true },
    }),
  ]);

  return nextDueAt({
    now: now.getTime(),
    intervalMs,
    leaseTimeoutMs: LEASE_TIMEOUT_MS,
    undelivered,
    criteria,
    jobs,
  });
}

async function enqueueDueCriteria(now: Date, summary: RunSummary): Promise<void> {
  // Only criteria with at least one *active*, non-soft-deleted subscriber. An
  // alert everyone has unsubscribed from, or soft-deleted (DATA-10), must
  // stop consuming upstream requests.
  const subscribed = await prisma.alertCriteria.findMany({
    where: { alerts: { some: { active: true, deletedAt: null } } },
  });

  summary.criteriaCount = subscribed.length;
  summary.intervalMs = effectiveIntervalMs(subscribed.length);

  const due = subscribed.filter((criteria) => {
    if (!criteria.lastPolledAt) return true;
    return now.getTime() - criteria.lastPolledAt.getTime() >= summary.intervalMs;
  });

  summary.oldestPendingAgeMs = due.reduce((oldest, criteria) => {
    // A never-polled criteria set is exactly due rather than infinitely stale —
    // it has no poll to measure from, and reporting Infinity would make the
    // number useless as an alarm.
    const age = criteria.lastPolledAt
      ? now.getTime() - criteria.lastPolledAt.getTime()
      : summary.intervalMs;
    return Math.max(oldest, age);
  }, 0);

  await Promise.all(
    due.map((criteria) =>
      // Upsert on the unique criteriaId, so enqueuing something already queued
      // leaves one job rather than a pile.
      prisma.alertPollJob.upsert({
        where: { criteriaId: criteria.id },
        create: { criteriaId: criteria.id, status: "pending", enqueuedAt: now },
        update: {},
      }),
    ),
  );
}

async function drainQueue(now: Date, summary: RunSummary): Promise<void> {
  await reclaimStaleLeases(now);

  // Raw SQL because Prisma cannot express SKIP LOCKED, and SKIP LOCKED is the
  // whole point: plain FOR UPDATE would make a second worker queue behind the
  // first, which is a slower version of one worker.
  const claimed = await prisma.$queryRaw<{ id: string }[]>`
    UPDATE alert_poll_jobs SET status = 'running', locked_at = now()
    WHERE id IN (
      SELECT id FROM alert_poll_jobs
      WHERE status = 'pending' AND available_at <= now()
      ORDER BY enqueued_at ASC
      LIMIT ${SLICE_SIZE}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id
  `;

  summary.claimed = claimed.length;

  const startedAt = Date.now();
  for (const [index, { id }] of claimed.entries()) {
    // The slice bounds how much is claimed; this bounds how long holding it
    // lasts. Three upstream calls per criteria set means a slow afternoon can
    // outrun the platform's invocation timeout, and being killed mid-loop would
    // strand every remaining job in `running` until its lease went stale.
    if (Date.now() - startedAt > WORKER_BUDGET_MS) {
      await releaseUnprocessed(claimed.slice(index).map((job) => job.id));
      break;
    }
    await pollOne(asAlertPollJobId(id), now, summary);
  }
}

/**
 * ALERT-48: hands back every job whose worker died holding it. The lost run
 * counts as a failed attempt, so a job that kills its worker every time is
 * parked after the third loss (ALERT-19) instead of being reclaimed for ever.
 * `availableAt` is kept, so the claim that follows can take a reclaimed job at
 * once. The two filters are disjoint on `attempts`, so no row is counted twice.
 */
async function reclaimStaleLeases(now: Date): Promise<void> {
  const stale = {
    status: "running",
    // Strictly older: a lease exactly at the timeout still belongs to its worker.
    lockedAt: { lt: new Date(now.getTime() - LEASE_TIMEOUT_MS) },
  } satisfies Prisma.AlertPollJobWhereInput;
  const released = { attempts: { increment: 1 }, lockedAt: null, lastError: "lease expired" };

  await prisma.alertPollJob.updateMany({
    where: { ...stale, attempts: { gte: MAX_ATTEMPTS - 1 } },
    data: { ...released, status: "failed" },
  });
  await prisma.alertPollJob.updateMany({
    where: { ...stale, attempts: { lt: MAX_ATTEMPTS - 1 } },
    data: { ...released, status: "pending" },
  });
}

/** Puts unprocessed claims back so the next run picks them up immediately. */
async function releaseUnprocessed(jobIds: string[]): Promise<void> {
  await prisma.alertPollJob.updateMany({
    where: { id: { in: jobIds } },
    data: { status: "pending", lockedAt: null },
  });
}

async function pollOne(jobId: AlertPollJobId, now: Date, summary: RunSummary): Promise<void> {
  const job = await prisma.alertPollJob.findUnique({ where: { id: jobId } });
  if (!job) return;

  const criteriaId = asAlertCriteriaId(job.criteriaId);
  const criteriaRow = await prisma.alertCriteria.findUnique({
    where: { id: criteriaId },
  });
  const criteria = criteriaRow && parseStoredCriteria(criteriaRow.criteria);
  if (!criteria) {
    await prisma.alertPollJob.delete({ where: { id: jobId } });
    return;
  }

  try {
    const result = await searchAllSources(criteria);
    // Outside the transaction below: a run's source health is true whether or
    // not recording its matches succeeds.
    await recordSourceHealth(result.perSourceCounts, now);

    // A source that failed contributes nothing. If it were treated as polled,
    // listings that appeared there during the outage would never be new again.
    const usable = result.listings.filter(
      (listing) => !result.failedSources.includes(listing.source),
    );

    // ALERT-47: opened only once every source has answered, so no network I/O
    // runs inside it. Matches, the seen-list, `lastPolledAt` and the job's
    // removal commit together; a failure rolls all four back and the catch
    // below reschedules the job, so the next poll finds the same listings new.
    const matched = await prisma.$transaction(async (tx) => {
      const seen = await tx.alertSeenListing.findMany({
        where: { criteriaId },
      });
      const seenIds = new Set(seen.map((row) => row.listingId));
      const fresh = usable.filter((listing) => !seenIds.has(listing.id));

      let created = 0;
      if (fresh.length > 0) {
        created = await createMatches(criteriaId, fresh, tx);
        await recordSeen(criteriaId, fresh, tx);
      }

      await tx.alertCriteria.update({
        where: { id: criteriaId },
        data: { lastPolledAt: now },
      });
      // Success removes the row; the next enqueue recreates it.
      await tx.alertPollJob.delete({ where: { id: jobId } });
      return created;
    });

    // Counted after the commit, so a rolled-back poll reports no matches.
    summary.matched += matched;
    summary.polled += 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const attempts = job.attempts + 1;
    const exhausted = attempts >= MAX_ATTEMPTS;

    summary.failures.push(`${criteriaId}: ${message}`);

    await prisma.alertPollJob.update({
      where: { id: jobId },
      data: {
        // A failed job is parked, not retried forever, and never blocks the
        // rest of the queue either way.
        status: exhausted ? "failed" : "pending",
        attempts,
        lastError: message,
        lockedAt: null,
        availableAt: new Date(
          now.getTime() +
            BACKOFF_MINUTES[Math.min(attempts - 1, BACKOFF_MINUTES.length - 1)] * 60_000,
        ),
      },
    });
  }
}

/**
 * Fans one poll out to every active subscriber, in the database. Returns how
 * many matches were created.
 */
async function createMatches(
  criteriaId: AlertCriteriaId,
  listings: CarListing[],
  db: Prisma.TransactionClient = prisma,
): Promise<number> {
  // Soft-deleted subscribers (DATA-10) are not notified.
  const subscribers = await db.alert.findMany({
    where: { criteriaId, active: true, ...notDeleted },
  });
  if (subscribers.length === 0) return 0;

  const rows = subscribers.flatMap((alert) =>
    listings.map(({ id, ...snapshot }) => ({
      alertId: alert.id,
      listingId: id,
      ...snapshot,
      notifiedAt: null,
    })),
  );

  const { count } = await db.alertMatch.createMany({
    data: rows,
    skipDuplicates: true,
  });
  return count;
}

/**
 * A source returning nothing when it used to return something.
 *
 * A Milanuncios parse failure returns zero ads rather than an error, so without
 * this "quietly broken" and "nothing new" are the same observation and an alert
 * can be dead for weeks while looking healthy.
 */
async function recordSourceHealth(counts: Record<string, number>, now: Date): Promise<void> {
  await Promise.all(
    Object.entries(counts).map(([source, count]) =>
      prisma.sourceHealth.upsert({
        where: { source },
        create: {
          source,
          lastOkAt: count > 0 ? now : null,
          consecutiveEmptyRuns: count > 0 ? 0 : 1,
        },
        update:
          count > 0
            ? { lastOkAt: now, consecutiveEmptyRuns: 0 }
            : { consecutiveEmptyRuns: { increment: 1 } },
      }),
    ),
  );
}

async function reportUnhealthySources(summary: RunSummary): Promise<void> {
  const health = await prisma.sourceHealth.findMany();
  summary.unhealthySources = health
    .filter((row) => row.consecutiveEmptyRuns >= EMPTY_RUNS_BEFORE_UNHEALTHY)
    .map((row) => row.source);
}

/**
 * Sends what discovery recorded.
 *
 * Separate from discovery on purpose. `sendEmail` returns false rather than
 * throwing, so a one-stage design would mark a listing seen with nobody told —
 * and it is never new again. Scanning every un-notified match, not only this
 * run's, is what makes a failed send retry rather than vanish.
 *
 * Returns whether a match of an active alert is still un-notified, so the
 * next run is due at once (ALERT-52).
 */
async function deliverPendingMatches(summary: RunSummary): Promise<boolean> {
  const pending = await prisma.alertMatch.findMany({
    where: { notifiedAt: null },
  });
  if (pending.length === 0) return false;

  const byAlert = new Map<string, typeof pending>();
  for (const match of pending) {
    const bucket = byAlert.get(match.alertId) ?? [];
    bucket.push(match);
    byAlert.set(match.alertId, bucket);
  }

  const alerts = await prisma.alert.findMany({
    where: { id: { in: [...byAlert.keys()] }, active: true, ...notDeleted },
    include: { user: true },
  });

  let undelivered = false;
  for (const alert of alerts) {
    const matches = byAlert.get(alert.id) ?? [];
    if (matches.length === 0) continue;

    if (!isEmailConfigured) {
      // Recorded but undeliverable. Counted rather than silently skipped, so
      // "alerts are working" is not something the run implies falsely.
      summary.skippedNoEmail += 1;
      undelivered = true;
      continue;
    }

    const locale =
      alert.user.locale && isValidLocale(alert.user.locale) ? alert.user.locale : DEFAULT_LOCALE;

    const token = unsubscribeTokenFor(alert.unsubscribeSubject);
    const digestProps = {
      locale,
      alertLabel: alert.label,
      matches: matches.map((match) => ({ ...match, id: match.listingId })),
      unsubscribeUrl: `${appUrl}/api/alerts/unsubscribe?token=${token}`,
      alertUrl: `${appUrl}/alerts/${alert.id}`,
      manageUrl: `${appUrl}/alerts`,
    };
    const { html, text } = await renderEmail(createElement(AlertDigestEmail, digestProps));

    // One mail per user per run carrying every match, not one per listing.
    const sent = await sendEmail({
      to: alert.user.email,
      subject: alertDigestSubject(locale, digestProps),
      html,
      text,
    });

    if (!sent) {
      undelivered = true;
      continue;
    }

    await prisma.alertMatch.updateMany({
      where: { id: { in: matches.map((match) => match.id) } },
      data: { notifiedAt: new Date() },
    });
    summary.emailed += 1;
  }
  return undelivered;
}
