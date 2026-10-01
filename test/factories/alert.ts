// TEST-10 (docs/specs/core-testing.md): a faker-based builder for `Alert`,
// replacing test/fixtures/alerts.ts's in-memory store now that the converted
// tests write through a real database.
//
// `user` and `criteria` have no sensible default — an alert never exists
// without both — so the overrides type requires them. `createAlert` appends a
// call counter to `unsubscribeTokenHash` when it was not overridden, the same
// way test/factories/alert-criteria.ts does for `criteriaHash`: several
// converted tests create many alerts in one test (app/api/alerts/run), always
// varying only `user`/`criteria`.
//
// See test/factories/user.ts for why `build*` reseeds internally.

import { faker } from "@faker-js/faker";
import type { Alert, Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

const BUILD_SEED = 20260930;

type AlertOverrides = Partial<Prisma.AlertCreateInput> &
  Pick<Prisma.AlertCreateInput, "user" | "criteria">;

export function buildAlert(overrides: AlertOverrides): Prisma.AlertCreateInput {
  faker.seed(BUILD_SEED);
  return {
    label: `${faker.vehicle.manufacturer()} ${faker.vehicle.model()} alert`,
    active: true,
    unsubscribeTokenHash: faker.string.hexadecimal({ length: 64, casing: "lower", prefix: "" }),
    // Mirrors the real service (server/alerts/service.ts): a freshly minted
    // alert's unsubscribeSubject is its own id. This factory does not control
    // the id the database assigns, so it uses an independent UUID instead —
    // nothing reads the two back as equal here, only that the column is set.
    unsubscribeSubject: faker.string.uuid(),
    ...overrides,
  };
}

let sequence = 0;

export async function createAlert(overrides: AlertOverrides): Promise<Alert> {
  const data = buildAlert(overrides);
  if (!("unsubscribeTokenHash" in overrides)) {
    sequence += 1;
    data.unsubscribeTokenHash = `${data.unsubscribeTokenHash}-${sequence}`;
  }
  return prisma.alert.create({ data });
}
