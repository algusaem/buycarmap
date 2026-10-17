import { redirect } from "next/navigation";
import { getCurrentUserWithSessionId } from "@/lib/auth/session";
import { asUserId } from "@/lib/ids";
import { findAccountOverview, toListedSession } from "./service";

/**
 * The signed-in user's account, for the account page, with the session
 * behind this request marked `current` among the user's own, for «esta» and
 * «Este dispositivo» (docs/specs/redesign-pages.md, PAGES-35) — the user and
 * that session from one lookup.
 *
 * Middleware already redirects unauthenticated visitors, but this is the check
 * that actually matters: middleware only decodes the JWT, while the session
 * lookup runs the session callback and honours revocation.
 */
export async function getAccountOverview() {
  const current = await getCurrentUserWithSessionId();

  if (!current) {
    redirect("/login?callbackUrl=/account");
  }

  // Only whether there is a password crosses to the client, never the hash
  // (findAccountOverview, PAGES-60).
  const record = await findAccountOverview(asUserId(current.user.id));

  if (!record) {
    redirect("/login");
  }

  return {
    ...record,
    sessions: record.sessions.map((session) => toListedSession(session, current.sessionId)),
  };
}
