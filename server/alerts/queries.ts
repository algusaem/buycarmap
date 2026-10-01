import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { asAlertId, asUserId } from "@/lib/ids";
import type { AlertSummary } from "@/interfaces/alert";
import { findAlertSummaries, findAlertWithMatches } from "./service";

/**
 * One of the signed-in user's alerts with its matches, for the alert matches
 * page. Signed-out visitors are sent to log in and come back here.
 *
 * `id` is the raw URL segment — not yet known to be a well-formed id — cast
 * to `AlertId` with `asAlertId` rather than parsed: `findAlertWithMatches`
 * re-validates its shape with `alertIdSchema` before it reaches Prisma, so an
 * id that does not look like a UUID reaches that lookup exactly like one that
 * is well-formed but does not exist, and gets the same 404.
 */
export async function getAlertWithMatches(id: string) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?callbackUrl=%2Falerts%2F${id}`);

  // Scoped by userId, so another account's alert is a 404 rather than a 403 —
  // confirming it exists would leak that someone else watches this search.
  const alert = await findAlertWithMatches(asUserId(user.id), asAlertId(id));
  if (!alert) notFound();

  return alert;
}

/**
 * The signed-in user's alerts, for the alert list page. Signed-out visitors
 * are sent to log in and come back here.
 */
export async function listAlertsForPage(): Promise<AlertSummary[]> {
  // `proxy.ts` already redirects anonymous visitors, but this is the check that
  // matters: the proxy only decodes the JWT, while `getCurrentUser` runs the
  // session callback and honours revocation.
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=%2Falerts");

  // A failed read throws (PLAT-14, docs/specs/core-platform.md): the page
  // rendered an empty list on a failed read until this phase (ADR 0012),
  // which showed "no alerts yet" to a user whose alerts exist. The new
  // app/alerts/error.tsx shows a translated error and a retry instead.
  return await findAlertSummaries(asUserId(user.id));
}
