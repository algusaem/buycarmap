"use server";

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/server";
import { isValidLocale, Locale } from "@/lib/i18n/config";
import { AlertSummary } from "@/interfaces/alert";
import { searchSchema, SearchInput } from "@/lib/validations/search";
import {
  ALERT_ERROR,
  type AlertErrorCode,
  hashCriteria,
  isSpecificEnough,
  MAX_ALERTS_PER_USER,
  parseStoredCriteria,
} from "@/lib/validations/alerts";
import { hashUnsubscribeToken, unsubscribeTokenFor } from "@/lib/alerts/unsubscribe-token";
import { searchAllSources } from "@/lib/alerts/search";

interface AlertResult {
  success: boolean;
  error?: AlertErrorCode;
}

interface AlertListResult extends AlertResult {
  data?: AlertSummary[];
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
async function seedSeenListings(criteriaId: string, criteria: SearchInput): Promise<void> {
  try {
    const { listings } = await searchAllSources(criteria);
    if (listings.length === 0) return;

    await prisma.alertSeenListing.createMany({
      data: listings.map((listing) => ({
        criteriaId,
        listingId: listing.id,
        source: listing.source,
      })),
      skipDuplicates: true,
    });
  } catch {
    // Nothing to do — see above.
  }
}

export async function createAlert(criteria: SearchInput, label: string): Promise<AlertResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: ALERT_ERROR.unauthenticated };

  const parsed = searchSchema.safeParse(criteria);
  if (!parsed.success) {
    return { success: false, error: ALERT_ERROR.invalidCriteria };
  }

  // Before the seed poll, not after: a criteria set this broad must cost zero
  // upstream requests.
  if (!isSpecificEnough(parsed.data)) {
    return { success: false, error: ALERT_ERROR.criteriaTooBroad };
  }

  const trimmedLabel = label.trim();
  if (!trimmedLabel) {
    return { success: false, error: ALERT_ERROR.invalidCriteria };
  }

  try {
    const criteriaHash = hashCriteria(parsed.data);

    const count = await prisma.alert.count({ where: { userId: user.id } });
    if (count >= MAX_ALERTS_PER_USER) {
      return { success: false, error: ALERT_ERROR.tooManyAlerts };
    }

    let criteriaRow = await prisma.alertCriteria.findUnique({
      where: { criteriaHash },
    });
    const criteriaIsNew = !criteriaRow;
    if (!criteriaRow) {
      criteriaRow = await prisma.alertCriteria.create({
        data: { criteriaHash, criteria: parsed.data },
      });
    }

    // An explicit id, because the unsubscribe token is an HMAC over it and the
    // row needs the hash at insert time.
    const alertId = randomUUID();
    try {
      await prisma.alert.create({
        data: {
          id: alertId,
          userId: user.id,
          criteriaId: criteriaRow.id,
          label: trimmedLabel,
          active: true,
          unsubscribeTokenHash: hashUnsubscribeToken(unsubscribeTokenFor(alertId)),
        },
      });
    } catch (error) {
      // The unique index on (userId, criteriaId) firing means this user already
      // watches this search. Saving is idempotent, so that is an ordinary
      // event, not a failure to recover from.
      if ((error as { code?: string }).code === "P2002") {
        return { success: true };
      }
      throw error;
    }

    // Only when the criteria set is new: an existing one already has a
    // seen-list, and re-seeding would spend three upstream requests to learn
    // what is already recorded.
    if (criteriaIsNew) {
      await seedSeenListings(criteriaRow.id, parsed.data);
    }

    await backfillLocale(user.id);

    return { success: true };
  } catch {
    return { success: false, error: ALERT_ERROR.unexpected };
  }
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
async function backfillLocale(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  // An explicit choice outranks an inferred one, so a stored value is never
  // overwritten here.
  if (!user || user.locale) return;

  const locale = await getLocale();
  await prisma.user.update({ where: { id: userId }, data: { locale } });
}

export async function listAlerts(): Promise<AlertListResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: ALERT_ERROR.unauthenticated };

  try {
    const rows = await prisma.alert.findMany({
      where: { userId: user.id },
      include: { criteria: true, _count: { select: { matches: true } } },
      orderBy: { createdAt: "desc" },
    });

    return {
      success: true,
      data: rows.map((row) => ({
        id: row.id,
        label: row.label,
        // The column is Json, so what comes out is not typed just because what
        // went in was.
        criteria: parseStoredCriteria(row.criteria.criteria) ?? {},
        matchCount: row._count.matches,
        active: row.active,
      })),
    };
  } catch {
    return { success: false, error: ALERT_ERROR.unexpected };
  }
}

export async function deleteAlert(alertId: string): Promise<AlertResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: ALERT_ERROR.unauthenticated };

  try {
    const doomed = await prisma.alert.findFirst({
      where: { id: alertId, userId: user.id },
    });

    // Scoped by userId, so this cannot reach another account's row. Reports
    // success whether or not anything matched: the caller asked for the alert
    // not to exist, and it does not. Saying otherwise would confirm that
    // someone else's alert does.
    await prisma.alert.deleteMany({ where: { id: alertId, userId: user.id } });

    if (doomed) await releaseCriteriaIfUnused(doomed.criteriaId);

    return { success: true };
  } catch {
    return { success: false, error: ALERT_ERROR.unexpected };
  }
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
 * criteria and its history.
 */
async function releaseCriteriaIfUnused(criteriaId: string): Promise<void> {
  const remaining = await prisma.alert.count({ where: { criteriaId } });
  if (remaining > 0) return;
  await prisma.alertCriteria.delete({ where: { id: criteriaId } });
}

export async function setLocale(locale: Locale): Promise<AlertResult> {
  if (!isValidLocale(locale)) {
    return { success: false, error: ALERT_ERROR.invalidCriteria };
  }

  // A signed-out visitor is not an error: the cookie already carries their
  // preference, and there is no account to write it to.
  const user = await getCurrentUser();
  if (!user) return { success: true };

  try {
    await prisma.user.update({ where: { id: user.id }, data: { locale } });
    return { success: true };
  } catch {
    return { success: false, error: ALERT_ERROR.unexpected };
  }
}
