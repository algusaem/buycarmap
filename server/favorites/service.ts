import { prisma } from "@/lib/db/prisma";
import { notDeleted } from "@/lib/db/soft-delete";
import { ownedBy } from "@/lib/auth/permissions";
import type { ListingRef, UserId } from "@/lib/ids";
import type { CarListing } from "@/interfaces/listing";

// The stored row carries the row's own id and the user's; the card only ever
// wants the listing it snapshotted.
interface FavoriteRow extends Omit<CarListing, "id"> {
  listingId: ListingRef;
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

export async function upsertFavorite(
  userId: UserId,
  listingId: ListingRef,
  snapshot: Omit<CarListing, "id">,
): Promise<void> {
  // Upsert rather than create-and-catch: saving is a toggle, so a second
  // click on an already-saved listing is an ordinary event, not an error to
  // recover from. The snapshot itself is never rewritten on the `update`
  // branch — re-saving is not a refresh, and silently rewriting the stored
  // price would make the staleness harder to reason about, not easier.
  //
  // DATA-11 (docs/specs/core-data-model.md): the same branch also restores a
  // row soft-deleted by `deleteFavorite`, clearing `deletedAt` and bumping
  // `version`, instead of failing on the unique constraint — the unique key
  // is `[userId, listingId]` regardless of `deletedAt`, so a deleted row is
  // still the one this upsert matches.
  await prisma.favorite.upsert({
    where: { userId_listingId: { ...ownedBy({ id: userId }), listingId } },
    create: { userId, listingId, ...snapshot, createdById: userId },
    update: { deletedAt: null, version: { increment: 1 }, updatedById: userId },
  });
}

/** Soft delete (DATA-10): sets `deletedAt` rather than removing the row. */
export async function deleteFavorite(userId: UserId, listingId: ListingRef): Promise<void> {
  await prisma.favorite.updateMany({
    where: { ...ownedBy({ id: userId }), listingId, ...notDeleted },
    data: { deletedAt: new Date() },
  });
}

export async function findFavorites(userId: UserId): Promise<CarListing[]> {
  const rows = await prisma.favorite.findMany({
    where: { ...ownedBy({ id: userId }), ...notDeleted },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toListing);
}
