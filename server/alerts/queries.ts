import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { findAlertWithMatches } from "./service";

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
