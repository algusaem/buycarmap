import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import type { AlertSummary } from "@/interfaces/alert";
import { findAlertSummaries, findAlertWithMatches } from "./service";

/**
 * One of the signed-in user's alerts with its matches, for the alert matches
 * page. Signed-out visitors are sent to log in and come back here.
 */
export async function getAlertWithMatches(alertId: string) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?callbackUrl=%2Falerts%2F${alertId}`);

  // Scoped by userId, so another account's alert is a 404 rather than a 403 —
  // confirming it exists would leak that someone else watches this search.
  const alert = await findAlertWithMatches(user.id, alertId);
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

  try {
    return await findAlertSummaries(user.id);
  } catch {
    // The page rendered an empty list when the read failed before this query
    // existed, and it still does (ADR 0012, until phase 6).
    return [];
  }
}
