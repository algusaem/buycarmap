import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { findAccountOverview } from "./service";

/**
 * The signed-in user's account, for the account page.
 *
 * Middleware already redirects unauthenticated visitors, but this is the check
 * that actually matters: middleware only decodes the JWT, while
 * `getCurrentUser` runs the session callback and honours revocation.
 */
export async function getAccountOverview() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?callbackUrl=/account");
  }

  // `password` is null for OAuth-only accounts, which changes which forms
  // apply. Only the presence flag crosses to the client, never the hash.
  const record = await findAccountOverview(user.id);

  if (!record) {
    redirect("/login");
  }

  return record;
}
