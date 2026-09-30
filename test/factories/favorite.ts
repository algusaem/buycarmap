// TEST-10 (docs/specs/core-testing.md): a faker-based builder for `Favorite`,
// replacing test/fixtures/favorites.ts's in-memory store now that the
// converted tests write through a real database.
//
// `user` has no sensible default — a favorite never exists without one — so
// the overrides type requires it rather than defaulting it away or casting
// around a missing required field.
//
// See test/factories/user.ts for why `build*` reseeds internally and why
// `create*` appends a counter to the field the unique index depends on
// (here, `listingId`, unique together with `userId`) when it was not
// overridden.

import { faker } from "@faker-js/faker";
import type { Favorite, Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

const BUILD_SEED = 20260930;

type FavoriteOverrides = Partial<Prisma.FavoriteCreateInput> &
  Pick<Prisma.FavoriteCreateInput, "user">;

export function buildFavorite(overrides: FavoriteOverrides): Prisma.FavoriteCreateInput {
  faker.seed(BUILD_SEED);
  return {
    listingId: `wallapop-${faker.string.alphanumeric(8)}`,
    source: "Wallapop",
    title: faker.vehicle.vehicle(),
    subtitle: faker.lorem.words(3),
    image: faker.image.url(),
    brand: faker.vehicle.manufacturer(),
    model: faker.vehicle.model(),
    location: faker.location.city(),
    fuel: "gasoil",
    url: faker.internet.url(),
    price: faker.number.int({ min: 3000, max: 40000 }),
    mileage: faker.number.int({ min: 0, max: 200000 }),
    year: faker.number.int({ min: 2000, max: 2025 }),
    lat: 40.4168,
    lng: -3.7038,
    ...overrides,
  };
}

let sequence = 0;

export async function createFavorite(overrides: FavoriteOverrides): Promise<Favorite> {
  const data = buildFavorite(overrides);
  if (!("listingId" in overrides)) {
    sequence += 1;
    data.listingId = `${data.listingId}-${sequence}`;
  }
  return prisma.favorite.create({ data });
}
