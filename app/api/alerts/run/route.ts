import { timingSafeEqual } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { appUrl, env, isEmailConfigured } from "@/lib/env";
import { sendEmail } from "@/lib/email/client";
import { renderAlertEmail } from "@/lib/email/templates/alert-emails";
import { DEFAULT_LOCALE, isValidLocale } from "@/lib/i18n/config";
import type { CarListing } from "@/interfaces/listing";
import type { RunSummary } from "@/interfaces/alert";
import { parseStoredCriteria } from "@/lib/validations/alerts";
import { searchAllSources } from "@/lib/alerts/search";
import { unsubscribeTokenFor } from "@/lib/alerts/unsubscribe-token";

// The alert runner. Called by the GitHub Actions cron, K jobs in parallel.
//
// A route handler rather than a server action because the caller is a machine,
// not a user — the "prefer server actions" rule is about mutations from the UI.
// Authorised by a shared secret, never by getCurrentUser().
//
// One invocation does three things in order: enqueue what is due, drain a
// bounded slice of the queue, then deliver whatever is pending. See
// docs/specs/alerts.md › Decisions and rationale.

const BASE_INTERVAL_MS = 5 * 60_000;
/** The upstream budget the cadence stretches to respect. Unmeasured — §6. */
const REQUESTS_PER_MINUTE_CEILING = 60;
const REQUESTS_PER_POLL = 3;
const SLICE_SIZE = 25;
/** Returns before the platform's invocation timeout, leaving the rest queued. */
const WORKER_BUDGET_MS = 45_000;
const MAX_ATTEMPTS = 3;
/** Deliberately longer than the interval: a failing upstream is polled less. */
const BACKOFF_MINUTES = [5, 15, 45];
const EMPTY_RUNS_BEFORE_UNHEALTHY = 3;

function isAuthorised(request: NextRequest): boolean {
  const secret = env.ALERTS_CRON_SECRET;
  if (!secret) return false;

  const offered = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!offered) return false;

  const a = Buffer.from(offered);
  const b = Buffer.from(secret);
  // Length must match before timingSafeEqual, which throws on mismatch.
  return a.length === b.length && timingSafeEqual(a, b);
}

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

export async function POST(request: NextRequest) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
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

  return NextResponse.json(summary);
}

async function enqueueDueCriteria(now: Date, summary: RunSummary): Promise<void> {
  // Only criteria with at least one *active* subscriber. An alert everyone has
  // unsubscribed from must stop consuming upstream requests.
  const subscribed = await prisma.alertCriteria.findMany({
    where: { alerts: { some: { active: true } } },
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
    UPDATE "AlertPollJob" SET status = 'running', "lockedAt" = now()
    WHERE id IN (
      SELECT id FROM "AlertPollJob"
      WHERE status = 'pending' AND "availableAt" <= now()
      ORDER BY "enqueuedAt" ASC
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
    await pollOne(id, now, summary);
  }
}

/** Puts unprocessed claims back so the next run picks them up immediately. */
async function releaseUnprocessed(jobIds: string[]): Promise<void> {
  await prisma.alertPollJob.updateMany({
    where: { id: { in: jobIds } },
    data: { status: "pending", lockedAt: null },
  });
}

async function pollOne(jobId: string, now: Date, summary: RunSummary): Promise<void> {
  const job = await prisma.alertPollJob.findUnique({ where: { id: jobId } });
  if (!job) return;

  const criteriaRow = await prisma.alertCriteria.findUnique({
    where: { id: job.criteriaId },
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
      where: { criteriaId: job.criteriaId },
    });
    const seenIds = new Set(seen.map((row) => row.listingId));

    // A source that failed contributes nothing. If it were treated as polled,
    // listings that appeared there during the outage would never be new again.
    const usable = result.listings.filter(
      (listing) => !result.failedSources.includes(listing.source),
    );
    const fresh = usable.filter((listing) => !seenIds.has(listing.id));

    if (fresh.length > 0) {
      await createMatches(job.criteriaId, fresh, summary);
      await prisma.alertSeenListing.createMany({
        data: fresh.map((listing) => ({
          criteriaId: job.criteriaId,
          listingId: listing.id,
          source: listing.source,
        })),
        skipDuplicates: true,
      });
    }

    await prisma.alertCriteria.update({
      where: { id: job.criteriaId },
      data: { lastPolledAt: now },
    });
    // Success removes the row; the next enqueue recreates it.
    await prisma.alertPollJob.delete({ where: { id: jobId } });
    summary.polled += 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const attempts = job.attempts + 1;
    const exhausted = attempts >= MAX_ATTEMPTS;

    summary.failures.push(`${job.criteriaId}: ${message}`);

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
  criteriaId: string,
  listings: CarListing[],
  summary: RunSummary,
): Promise<void> {
  const subscribers = await prisma.alert.findMany({
    where: { criteriaId, active: true },
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
    where: { id: { in: [...byAlert.keys()] }, active: true },
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

    const token = unsubscribeTokenFor(alert.id);
    const email = await renderAlertEmail({
      locale,
      alertLabel: alert.label,
      matches: matches.map((match) => ({ ...match, id: match.listingId })),
      unsubscribeUrl: `${appUrl}/api/alerts/unsubscribe?token=${token}`,
      alertUrl: `${appUrl}/alerts/${alert.id}`,
    });

    // One mail per user per run carrying every match, not one per listing.
    const sent = await sendEmail({
      to: alert.user.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });

    if (!sent) continue;

    await prisma.alertMatch.updateMany({
      where: { id: { in: matches.map((match) => match.id) } },
      data: { notifiedAt: new Date() },
    });
    summary.emailed += 1;
  }
}
