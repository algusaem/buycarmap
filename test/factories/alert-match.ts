// TEST-10 (docs/specs/core-testing.md): a faker-based builder for
// `AlertMatch`, replacing test/fixtures/alerts.ts's in-memory store now that
// the converted tests write through a real database.
//
// `alert` has no sensible default — a match never exists without one — so
// the overrides type requires it. `createAlertMatch` appends a call counter
// to `listingId` when it was not overridden, the unique column together with
// `alertId`.
//
// See test/factories/user.ts for why `build*` reseeds internally.

import { faker } from "@faker-js/faker";
import type { AlertMatch, Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

const BUILD_SEED = 20260930;

type AlertMatchOverrides = Partial<Prisma.AlertMatchCreateInput> &
  Pick<Prisma.AlertMatchCreateInput, "alert">;

export function buildAlertMatch(overrides: AlertMatchOverrides): Prisma.AlertMatchCreateInput {
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
    notifiedAt: null,
    ...overrides,
  };
}

let sequence = 0;

export async function createAlertMatch(overrides: AlertMatchOverrides): Promise<AlertMatch> {
  const data = buildAlertMatch(overrides);
  if (!("listingId" in overrides)) {
    sequence += 1;
    data.listingId = `${data.listingId}-${sequence}`;
  }
  return prisma.alertMatch.create({ data });
}
