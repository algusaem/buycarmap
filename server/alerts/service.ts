import { createHash } from "node:crypto";
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
  asAlertPollJobId,
  type UserId,
  uuidv7,
} from "@/lib/ids";
import { saveUserLocale } from "@/server/locale/service";
import { searchAllSources } from "./search";
import { hashUnsubscribeToken, unsubscribeTokenFor } from "./unsubscribe-token";
import type { CarListing } from "@/interfaces/listing";
import type { AlertSummary, RunSummary } from "@/interfaces/alert";
import type { SearchInput } from "@/lib/search/schema";
import { ALERT_ERROR, type AlertErrorCode, parseStoredCriteria } from "./schema";

// --- Domain rules ------------------------------------------------------------

/**
 * A proxy for the real constraint, which is total distinct criteria sets —
 * that is what the upstreams see. Each alert is a standing claim on a
 * rate-limited API, so an unbounded count lets one account consume the shared
 * budget that protects search.
 */
export const MAX_ALERTS_PER_USER = 20;

/**
 * Whether a criteria set is specific enough to be worth watching.
 *
 * Nothing else stops someone saving "every car in Spain": its seed poll is
 * thousands of listings, it matches on nearly every lap, and it is useless as
 * an alert because an alert that fires constantly is noise.
 *
 * A deliberately low bar — any alert a person actually wants clears it without
 * thinking, and only the degenerate case is rejected. Capping matches per run
 * instead would silently drop listings the user asked to be told about, which
 * is the one thing this feature must not do.
 */
export function isSpecificEnough(criteria: SearchInput): boolean {
  const hasLocation = criteria.latitude != null && criteria.longitude != null;
  return Boolean(criteria.brand) || criteria.maxPrice != null || hasLocation;
}

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
async function recordSeen(criteriaId: AlertCriteriaId, listings: CarListing[]): Promise<void> {
  await prisma.alertSeenListing.createMany({
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
 * Subscribes a user to an already validated, specific-enough criteria set.
 * Returns the error code to report, or null when the user now watches it.
 */
export async function createAlertForUser(
  userId: UserId,
  criteria: SearchInput,
  label: string,
): Promise<AlertErrorCode | null> {
  const criteriaHash = hashCriteria(criteria);

  // DATA-10 (docs/specs/core-data-model.md): a soft-deleted alert does not
  // count against the cap — it is no longer an active subscription.
  const count = await prisma.alert.count({ where: { ...ownedBy({ id: userId }), ...notDeleted } });
  if (count >= MAX_ALERTS_PER_USER) {
    return ALERT_ERROR.tooManyAlerts;
  }

  let criteriaRow = await prisma.alertCriteria.findUnique({
    where: { criteriaHash },
  });
  const criteriaIsNew = !criteriaRow;
  if (!criteriaRow) {
    criteriaRow = await prisma.alertCriteria.create({
      data: { criteriaHash, criteria },
    });
  }
  const criteriaId = asAlertCriteriaId(criteriaRow.id);

  // An explicit id, because the unsubscribe token is an HMAC over it and the
  // row needs the hash at insert time — and because `unsubscribeSubject`
  // needs it too (docs/decisions/0015-data-model-conventions.md). Generated
  // here, not left to the database default, so both can be set on the same
  // insert with no follow-up write.
  const alertId = uuidv7();
  const unsubscribeTokenHash = hashUnsubscribeToken(unsubscribeTokenFor(alertId));

  // DATA-11: upsert rather than create-and-catch — a row this user already
  // has (live or soft-deleted) is matched by the same unique key regardless
  // of `deletedAt`, so the `update` branch restores a deleted one (clearing
  // `deletedAt`, bumping `version`) exactly as saving over a soft-deleted
  // favorite does.
  await prisma.alert.upsert({
    where: { userId_criteriaId: { ...ownedBy({ id: userId }), criteriaId } },
    create: {
      id: alertId,
      userId,
      criteriaId,
      label,
      active: true,
      unsubscribeTokenHash,
      unsubscribeSubject: alertId,
      createdById: userId,
    },
    update: { deletedAt: null, version: { increment: 1 }, updatedById: userId },
  });

  // Only when the criteria set is new: an existing one already has a
  // seen-list, and re-seeding would spend three upstream requests to learn
  // what is already recorded.
  if (criteriaIsNew) {
    await seedSeenListings(criteriaId, criteria);
  }

  await backfillLocale(userId);

  return null;
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

export async function findAlertSummaries(userId: UserId): Promise<AlertSummary[]> {
  const rows = await prisma.alert.findMany({
    where: { ...ownedBy({ id: userId }), ...notDeleted },
    include: { criteria: true, _count: { select: { matches: true } } },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    // The column is Json, so what comes out is not typed just because what
    // went in was.
    criteria: parseStoredCriteria(row.criteria.criteria) ?? {},
    matchCount: row._count.matches,
    active: row.active,
  }));
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
  await prisma.alert.updateMany({
    where: { id: alertId, ...ownedBy({ id: userId }), ...notDeleted },
    data: { deletedAt: new Date() },
  });

  if (doomed) await releaseCriteriaIfUnused(asAlertCriteriaId(doomed.criteriaId));
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
 */
async function releaseCriteriaIfUnused(criteriaId: AlertCriteriaId): Promise<void> {
  const remaining = await prisma.alert.count({ where: { criteriaId } });
  if (remaining > 0) return;
  await prisma.alertCriteria.delete({ where: { id: criteriaId } });
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
export async function findAlertWithMatches(userId: UserId, alertId: AlertId) {
  if (!alertIdSchema.safeParse(alertId).success) return null;

  // Scoped by userId, so another account's alert is not found at all.
  return prisma.alert.findFirst({
    where: { id: alertId, ...ownedBy({ id: userId }), ...notDeleted },
    include: { matches: { orderBy: { createdAt: "desc" } } },
  });
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
  await prisma.alert.updateMany({
    where: { unsubscribeTokenHash: hashUnsubscribeToken(token) },
    data: { active: false },
  });
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

/** One full alert run: enqueue, drain, deliver, then report source health. */
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
  };

  await enqueueDueCriteria(now, summary);
  await drainQueue(now, summary);
  await deliverPendingMatches(summary);
  await reportUnhealthySources(summary);

  return summary;
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
    await recordSourceHealth(result.perSourceCounts, now);

    const seen = await prisma.alertSeenListing.findMany({
      where: { criteriaId },
    });
    const seenIds = new Set(seen.map((row) => row.listingId));

    // A source that failed contributes nothing. If it were treated as polled,
    // listings that appeared there during the outage would never be new again.
    const usable = result.listings.filter(
      (listing) => !result.failedSources.includes(listing.source),
    );
    const fresh = usable.filter((listing) => !seenIds.has(listing.id));

    if (fresh.length > 0) {
      await createMatches(criteriaId, fresh, summary);
      await recordSeen(criteriaId, fresh);
    }

    await prisma.alertCriteria.update({
      where: { id: criteriaId },
      data: { lastPolledAt: now },
    });
    // Success removes the row; the next enqueue recreates it.
    await prisma.alertPollJob.delete({ where: { id: jobId } });
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

/** Fans one poll out to every active subscriber, in the database. */
async function createMatches(
  criteriaId: AlertCriteriaId,
  listings: CarListing[],
  summary: RunSummary,
): Promise<void> {
  // Soft-deleted subscribers (DATA-10) are not notified.
  const subscribers = await prisma.alert.findMany({
    where: { criteriaId, active: true, ...notDeleted },
  });
  if (subscribers.length === 0) return;

  const rows = subscribers.flatMap((alert) =>
    listings.map(({ id, ...snapshot }) => ({
      alertId: alert.id,
      listingId: id,
      ...snapshot,
      notifiedAt: null,
    })),
  );

  const { count } = await prisma.alertMatch.createMany({
    data: rows,
    skipDuplicates: true,
  });
  summary.matched += count;
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
 */
async function deliverPendingMatches(summary: RunSummary): Promise<void> {
  const pending = await prisma.alertMatch.findMany({
    where: { notifiedAt: null },
  });
  if (pending.length === 0) return;

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

  for (const alert of alerts) {
    const matches = byAlert.get(alert.id) ?? [];
    if (matches.length === 0) continue;

    if (!isEmailConfigured) {
      // Recorded but undeliverable. Counted rather than silently skipped, so
      // "alerts are working" is not something the run implies falsely.
      summary.skippedNoEmail += 1;
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
    };
    const { html, text } = await renderEmail(createElement(AlertDigestEmail, digestProps));

    // One mail per user per run carrying every match, not one per listing.
    const sent = await sendEmail({
      to: alert.user.email,
      subject: alertDigestSubject(locale, digestProps),
      html,
      text,
    });

    if (!sent) continue;

    await prisma.alertMatch.updateMany({
      where: { id: { in: matches.map((match) => match.id) } },
      data: { notifiedAt: new Date() },
    });
    summary.emailed += 1;
  }
}
