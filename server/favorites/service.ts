import { prisma } from "@/lib/db/prisma";
import type { CarListing } from "@/interfaces/listing";

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

export async function upsertFavorite(
  userId: string,
  listingId: string,
  snapshot: Omit<CarListing, "id">,
): Promise<void> {
  // Upsert rather than create-and-catch: saving is a toggle, so a second
  // click on an already-saved listing is an ordinary event, not an error to
  // recover from. `update: {}` deliberately leaves the original snapshot
  // alone — re-saving is not a refresh, and silently rewriting the stored
  // price would make the staleness harder to reason about, not easier.
  await prisma.favorite.upsert({
    where: { userId_listingId: { userId, listingId } },
    create: { userId, listingId, ...snapshot },
    update: {},
  });
}

export async function deleteFavorite(userId: string, listingId: string): Promise<void> {
  await prisma.favorite.deleteMany({ where: { userId, listingId } });
}

export async function findFavorites(userId: string): Promise<CarListing[]> {
  const rows = await prisma.favorite.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toListing);
}
