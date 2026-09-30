import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import type { CarListing } from "@/interfaces/listing";
import { findFavorites } from "./service";

/**
 * The signed-in user's favorites, for the favorites page. Signed-out visitors
 * are sent to log in and come back here.
 */
export async function listFavoritesForPage(): Promise<CarListing[]> {
  // `proxy.ts` already redirects anonymous visitors, but this is the check that
  // matters: the proxy only decodes the JWT, while `getCurrentUser` runs the
  // session callback and honours revocation.
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=%2Ffavorites");

  try {
    return await findFavorites(user.id);
  } catch {
    // The page rendered an empty list when the read failed before this query
    // existed, and it still does (ADR 0012, until phase 6).
    return [];
  }
}
