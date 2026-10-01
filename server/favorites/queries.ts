import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { asUserId } from "@/lib/ids";
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

  // A failed read throws (PLAT-14, docs/specs/core-platform.md): the page
  // rendered an empty list on a failed read until this phase (ADR 0012),
  // which showed "no favorites yet" to a user whose favorites exist. The new
  // app/favorites/error.tsx shows a translated error and a retry instead.
  return await findFavorites(asUserId(user.id));
}
