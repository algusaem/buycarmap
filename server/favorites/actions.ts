"use server";

import { getCurrentUser } from "@/lib/auth/session";
import type { CarListing } from "@/interfaces/listing";
import { FAVORITE_ERROR, type FavoriteErrorCode, favoriteListingSchema } from "./schema";
import { deleteFavorite, findFavorites, upsertFavorite } from "./service";

interface FavoriteResult {
  success: boolean;
  error?: FavoriteErrorCode;
}

interface FavoriteListResult extends FavoriteResult {
  data?: CarListing[];
}

export async function saveFavorite(listing: CarListing): Promise<FavoriteResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: FAVORITE_ERROR.unauthenticated };

  const parsed = favoriteListingSchema.safeParse(listing);
  if (!parsed.success) {
    return { success: false, error: FAVORITE_ERROR.invalidListing };
  }

  const { id: listingId, ...snapshot } = parsed.data;

  try {
    await upsertFavorite(user.id, listingId, snapshot);
    return { success: true };
  } catch {
    return { success: false, error: FAVORITE_ERROR.unexpected };
  }
}

export async function removeFavorite(listingId: string): Promise<FavoriteResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: FAVORITE_ERROR.unauthenticated };

  try {
    // Scoped by userId, so this cannot reach another account's row. It reports
    // success whether or not anything matched: the caller asked for the
    // listing not to be saved, and it is not saved. Distinguishing "removed"
    // from "was never yours" would confirm that someone else's favorite
    // exists, which is the kind of thing the rest of this codebase avoids
    // leaking.
    await deleteFavorite(user.id, listingId);
    return { success: true };
  } catch {
    return { success: false, error: FAVORITE_ERROR.unexpected };
  }
}

export async function listFavorites(): Promise<FavoriteListResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: FAVORITE_ERROR.unauthenticated };

  try {
    return { success: true, data: await findFavorites(user.id) };
  } catch {
    return { success: false, error: FAVORITE_ERROR.unexpected };
  }
}
