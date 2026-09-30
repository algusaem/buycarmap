"use server";

import { getCurrentUser } from "@/lib/auth/session";
import { type AppError, err, ok, type Result } from "@/lib/result";
import { withRequestContext } from "@/lib/request-context";
import type { CarListing } from "@/interfaces/listing";
import { FAVORITE_ERROR, type FavoriteErrorCode, favoriteListingSchema } from "./schema";
import { deleteFavorite, findFavorites, upsertFavorite } from "./service";

type FavoriteError = AppError<FavoriteErrorCode>;

function favoriteError(code: FavoriteErrorCode): FavoriteError {
  return { code, messageKey: `favoriteErrors.${code}` };
}

export async function saveFavorite(listing: CarListing): Promise<Result<void, FavoriteError>> {
  return withRequestContext(async () => {
    const user = await getCurrentUser();
    if (!user) return err(favoriteError(FAVORITE_ERROR.unauthenticated));

    const parsed = favoriteListingSchema.safeParse(listing);
    if (!parsed.success) {
      return err(favoriteError(FAVORITE_ERROR.invalidListing));
    }

    const { id: listingId, ...snapshot } = parsed.data;

    await upsertFavorite(user.id, listingId, snapshot);
    return ok(undefined);
  });
}

export async function removeFavorite(listingId: string): Promise<Result<void, FavoriteError>> {
  return withRequestContext(async () => {
    const user = await getCurrentUser();
    if (!user) return err(favoriteError(FAVORITE_ERROR.unauthenticated));

    // Scoped by userId, so this cannot reach another account's row. It reports
    // success whether or not anything matched: the caller asked for the
    // listing not to be saved, and it is not saved. Distinguishing "removed"
    // from "was never yours" would confirm that someone else's favorite
    // exists, which is the kind of thing the rest of this codebase avoids
    // leaking.
    await deleteFavorite(user.id, listingId);
    return ok(undefined);
  });
}

export async function listFavorites(): Promise<Result<CarListing[], FavoriteError>> {
  return withRequestContext(async () => {
    const user = await getCurrentUser();
    if (!user) return err(favoriteError(FAVORITE_ERROR.unauthenticated));

    return ok(await findFavorites(user.id));
  });
}
