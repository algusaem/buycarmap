import { vi } from "vitest";
import { CarListing } from "@/interfaces/listing";

// A stored favorite: every CarListing field, snapshotted at save time (see
// docs/specs/favorites.md §4), plus the row's own identity and ordering.
export interface FavoriteRow extends CarListing {
  rowId: string;
  userId: string;
  listingId: string;
  createdAt: Date;
}

export function makeFavoriteInput(
  overrides: Partial<CarListing> = {},
): CarListing {
  return {
    id: "wallapop-abc123",
    image: "https://cdn.wallapop.com/img1-big.jpg",
    title: "Audi A3 2.0 TDI",
    subtitle: "Great condition",
    price: 14500,
    mileage: 95000,
    year: 2018,
    fuel: "gasoil",
    brand: "Audi",
    model: "A3",
    location: "Madrid",
    source: "Wallapop",
    lat: 40.4168,
    lng: -3.7038,
    url: "https://es.wallapop.com/item/audi-a3-abc123",
    ...overrides,
  };
}

/**
 * An in-memory stand-in for `prisma.favorite`.
 *
 * Asserting that `prisma.favorite.upsert` was called twice would not prove
 * FAV-2 — "exactly one record" is a claim about stored state, and a call
 * counter cannot make it. This fake holds rows and enforces the
 * `@@unique([userId, listingId])` constraint the schema declares, so the tests
 * can read the store back and assert what is actually in it.
 *
 * It models Postgres, so it can disagree with Postgres. The constraint is the
 * only behaviour it reproduces, and that is deliberate: anything more would be
 * re-implementing the database inside the test suite.
 */
export function createFavoriteStore(seed: FavoriteRow[] = []) {
  let rows: FavoriteRow[] = [...seed];
  let sequence = 0;

  const keyOf = (userId: string, listingId: string) => `${userId}::${listingId}`;
  const indexOf = (userId: string, listingId: string) =>
    rows.findIndex((row) => keyOf(row.userId, row.listingId) === keyOf(userId, listingId));

  function toRow(userId: string, listing: CarListing): FavoriteRow {
    sequence += 1;
    return {
      ...listing,
      rowId: `fav-${sequence}`,
      userId,
      listingId: listing.id,
      // Distinct, increasing timestamps so "newest first" is unambiguous.
      createdAt: new Date(2026, 0, 1, 0, 0, sequence),
    };
  }

  const uniqueViolation = () =>
    Object.assign(new Error("Unique constraint failed"), { code: "P2002" });

  const client = {
    create: vi.fn(async ({ data }: { data: FavoriteRow | (CarListing & { userId: string }) }) => {
      const userId = (data as { userId: string }).userId;
      const listing = data as unknown as CarListing;
      const listingId =
        (data as { listingId?: string }).listingId ?? listing.id;
      if (indexOf(userId, listingId) !== -1) throw uniqueViolation();
      const row = toRow(userId, { ...listing, id: listingId });
      rows.push(row);
      return row;
    }),

    upsert: vi.fn(
      async ({
        where,
        create,
      }: {
        where: { userId_listingId: { userId: string; listingId: string } };
        create: CarListing & { userId: string; listingId?: string };
        update: Record<string, unknown>;
      }) => {
        const { userId, listingId } = where.userId_listingId;
        const existing = indexOf(userId, listingId);
        if (existing !== -1) return rows[existing];
        const row = toRow(userId, { ...create, id: listingId });
        rows.push(row);
        return row;
      },
    ),

    deleteMany: vi.fn(
      async ({ where }: { where: { userId: string; listingId: string } }) => {
        const before = rows.length;
        rows = rows.filter(
          (row) =>
            !(row.userId === where.userId && row.listingId === where.listingId),
        );
        return { count: before - rows.length };
      },
    ),

    findMany: vi.fn(async ({ where }: { where: { userId: string } }) =>
      rows
        .filter((row) => row.userId === where.userId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    ),
  };

  return {
    client,
    /** Everything stored, for assertions the action's return value cannot make. */
    all: () => [...rows],
    forUser: (userId: string) => rows.filter((row) => row.userId === userId),
    seedFor: (userId: string, listing: CarListing) => {
      rows.push(toRow(userId, listing));
    },
  };
}
