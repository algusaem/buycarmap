// TEST-10 (docs/specs/core-testing.md): a faker-based builder for
// `AlertCriteria`, replacing test/fixtures/alerts.ts's in-memory store now
// that the converted tests write through a real database.
//
// `criteriaHash` is `@unique` in the schema, but its default here is an
// unrelated random hex string, not a real hash of `criteria` — several
// converted tests (e.g. app/api/alerts/run/route.integration.test.ts's
// draining-the-queue cases) create many rows sharing the same `criteria`
// payload in one test, on purpose, to exercise polling order rather than the
// app's own criteria-hash dedup. `createAlertCriteria` also appends a call
// counter when the caller did not override `criteriaHash`, so even identical
// overrides across repeated calls never collide.
//
// See test/factories/user.ts for why `build*` reseeds internally.

import { faker } from "@faker-js/faker";
import type { AlertCriteria, Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

const BUILD_SEED = 20260930;

export function buildAlertCriteria(
  overrides: Partial<Prisma.AlertCriteriaCreateInput> = {},
): Prisma.AlertCriteriaCreateInput {
  faker.seed(BUILD_SEED);
  return {
    criteriaHash: faker.string.hexadecimal({ length: 64, casing: "lower", prefix: "" }),
    criteria: {
      brand: faker.vehicle.manufacturer(),
      model: faker.vehicle.model(),
      maxPrice: faker.number.int({ min: 5000, max: 40000 }),
      latitude: 40.4168,
      longitude: -3.7038,
      distanceInKm: 50,
    },
    lastPolledAt: null,
    ...overrides,
  };
}

let sequence = 0;

export async function createAlertCriteria(
  overrides: Partial<Prisma.AlertCriteriaCreateInput> = {},
): Promise<AlertCriteria> {
  const data = buildAlertCriteria(overrides);
  if (!("criteriaHash" in overrides)) {
    sequence += 1;
    data.criteriaHash = `${data.criteriaHash}-${sequence}`;
  }
  return prisma.alertCriteria.create({ data });
}
