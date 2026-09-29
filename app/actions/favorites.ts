"use server";

import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import type { CarListing } from "@/interfaces/listing";
import {
  FAVORITE_ERROR,
  type FavoriteErrorCode,
  favoriteListingSchema,
} from "@/lib/validations/favorites";

interface FavoriteResult {
  success: boolean;
  error?: FavoriteErrorCode;
}

interface FavoriteListResult extends FavoriteResult {
  data?: CarListing[];
}

// The stored row carries the row's own id and the user's; the card only ever
// wants the listing it snapshotted.
interface FavoriteRow extends Omit<CarListing, "id"> {
  listingId: string;
}

function toListing(row: FavoriteRow): CarListing {
  return {
    id: row.listingId,
    image: row.image,
    title: row.title,
    subtitle: row.subtitle,
    price: row.price,
    mileage: row.mileage,
    year: row.year,
    fuel: row.fuel,
    brand: row.brand,
    model: row.model,
    location: row.location,
    source: row.source,
    lat: row.lat,
    lng: row.lng,
    url: row.url,
  };
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
    // Upsert rather than create-and-catch: saving is a toggle, so a second
    // click on an already-saved listing is an ordinary event, not an error to
    // recover from. `update: {}` deliberately leaves the original snapshot
    // alone — re-saving is not a refresh, and silently rewriting the stored
    // price would make the staleness harder to reason about, not easier.
    await prisma.favorite.upsert({
      where: { userId_listingId: { userId: user.id, listingId } },
      create: { userId: user.id, listingId, ...snapshot },
      update: {},
    });
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
    await prisma.favorite.deleteMany({ where: { userId: user.id, listingId } });
    return { success: true };
  } catch {
    return { success: false, error: FAVORITE_ERROR.unexpected };
  }
}

export async function listFavorites(): Promise<FavoriteListResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: FAVORITE_ERROR.unauthenticated };

  try {
    const rows = await prisma.favorite.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    return { success: true, data: rows.map(toListing) };
  } catch {
    return { success: false, error: FAVORITE_ERROR.unexpected };
  }
}
