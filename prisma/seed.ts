// TEST-11/TEST-12 (docs/specs/core-testing.md): fills an empty local database
// with deterministic development data — 3 users (one with two-factor on), 10
// favorites and 3 alerts with matches — and refuses to run against anything
// but a local database.
//
// Uses its own seeded `Faker` instance (`en`/`es` locales), separate from
// test/factories/*.ts's shared default `faker` — STACK.md §3: seed data is
// written by its own code, not by the test factories.

import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { en, es, Faker } from "@faker-js/faker";
import type { PrismaClient, User } from "@/app/generated/prisma/client";
import { hashPassword } from "@/lib/auth/hash";
import { encryptSecret } from "@/lib/auth/two-factor/encryption";
import { generateTotpSecret } from "@/lib/auth/two-factor/totp";

export const SEED_PASSWORD = "buycarmap-dev-1";

const SEED_FAKER_SEED = 20260930;
const SEED_EMAILS = ["seed-1@example.test", "seed-2@example.test", "seed-3@example.test"] as const;
const FAVORITE_COUNT = 10;

/**
 * Refuses to proceed against anything but a local database, naming the host
 * in the thrown message (TEST-12).
 */
export function assertLocalDatabase(url: string): void {
  const { hostname } = new URL(url);
  if (hostname !== "localhost" && hostname !== "127.0.0.1") {
    throw new Error(`Refusing to seed "${hostname}": only localhost and 127.0.0.1 are allowed.`);
  }
}

function vehicleSnapshot(faker: Faker, listingId: string) {
  return {
    listingId,
    source: "Wallapop",
    title: faker.vehicle.vehicle(),
    subtitle: faker.lorem.words(3),
    image: faker.image.urlPicsumPhotos(),
    brand: faker.vehicle.manufacturer(),
    model: faker.vehicle.model(),
    location: faker.location.city(),
    fuel: faker.helpers.arrayElement(["gasoil", "gasolina", "hibrido", "electrico"]),
    url: faker.internet.url(),
    price: faker.number.int({ min: 3000, max: 40000 }),
    mileage: faker.number.int({ min: 0, max: 200000 }),
    year: faker.number.int({ min: 2000, max: 2025 }),
    lat: 40.4168,
    lng: -3.7038,
  };
}

async function seedUsers(
  prisma: PrismaClient,
  faker: Faker,
  passwordHash: string,
): Promise<User[]> {
  const users: User[] = [];
  for (const email of SEED_EMAILS) {
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        password: passwordHash,
        name: faker.person.fullName(),
        locale: faker.helpers.arrayElement(["es", "en"]),
      },
    });
    users.push(user);
  }
  return users;
}

/**
 * Enrols the first seeded user in two-factor, encrypted the way the app does
 * (`encryptSecret`, `lib/auth/two-factor/encryption.ts`). Without
 * `TWO_FACTOR_ENCRYPTION_KEY` the app itself refuses to enable two-factor at
 * all (`server/two-factor/actions.ts`), so a throwaway key encrypts the row
 * instead — the printed secret then only authenticates until the process
 * exits, which is what "skipped" means below: not a missing row, a row whose
 * working secret was never actually usable.
 */
export async function ensureTwoFactorUser(
  prisma: PrismaClient,
  user: User,
  configuredKey: string | undefined = process.env.TWO_FACTOR_ENCRYPTION_KEY,
): Promise<void> {
  const existing = await prisma.user.findUnique({ where: { id: user.id } });
  if (existing?.twoFactorEnabledAt) {
    console.log(`  two-factor already enabled for ${user.email}`);
    return;
  }

  const secret = generateTotpSecret();
  if (!configuredKey) {
    console.log(
      "  TWO_FACTOR_ENCRYPTION_KEY is not set — encryption skipped in the sense that this secret " +
        "will not be usable after this process exits; a throwaway key encrypts the row so it still exists.",
    );
  }
  const encryptionKey = configuredKey ?? randomBytes(32).toString("base64");

  await prisma.user.update({
    where: { id: user.id },
    data: {
      twoFactorSecret: encryptSecret(secret, encryptionKey),
      twoFactorEnabledAt: new Date(),
    },
  });
  console.log(`  two-factor enabled for ${user.email} — TOTP secret: ${secret}`);
}

async function seedFavorites(prisma: PrismaClient, faker: Faker, users: User[]): Promise<void> {
  for (let index = 0; index < FAVORITE_COUNT; index++) {
    const user = users[index % users.length];
    if (!user) continue;
    const listingId = `seed-favorite-${index + 1}`;
    await prisma.favorite.upsert({
      where: { userId_listingId: { userId: user.id, listingId } },
      update: {},
      create: {
        user: { connect: { id: user.id } },
        ...vehicleSnapshot(faker, listingId),
      },
    });
  }
}

async function seedAlerts(prisma: PrismaClient, faker: Faker, users: User[]): Promise<void> {
  for (let index = 0; index < 3; index++) {
    const user = users[index % users.length];
    if (!user) continue;

    const brand = faker.vehicle.manufacturer();
    const model = faker.vehicle.model();

    const criteria = await prisma.alertCriteria.upsert({
      where: { criteriaHash: `seed-criteria-hash-${index + 1}` },
      update: {},
      create: {
        criteriaHash: `seed-criteria-hash-${index + 1}`,
        criteria: {
          brand,
          model,
          maxPrice: faker.number.int({ min: 10000, max: 40000 }),
          latitude: 40.4168,
          longitude: -3.7038,
          distanceInKm: 50,
        },
        lastPolledAt: new Date(),
      },
    });

    const alert = await prisma.alert.upsert({
      where: { unsubscribeTokenHash: `seed-alert-token-hash-${index + 1}` },
      update: {},
      create: {
        user: { connect: { id: user.id } },
        criteria: { connect: { id: criteria.id } },
        label: `${brand} ${model} alert`,
        unsubscribeTokenHash: `seed-alert-token-hash-${index + 1}`,
        // Mirrors the real service: a freshly minted alert's
        // unsubscribeSubject is its own id, but the id is not known before
        // the insert here (the upsert key is the token hash, not an
        // explicit id) — a seed-stable placeholder is fine, since no seeded
        // alert's unsubscribe link is ever actually emailed.
        unsubscribeSubject: `seed-alert-subject-${index + 1}`,
      },
    });

    const listingId = `seed-match-${index + 1}-1`;
    await prisma.alertMatch.upsert({
      where: { alertId_listingId: { alertId: alert.id, listingId } },
      update: {},
      create: {
        alert: { connect: { id: alert.id } },
        ...vehicleSnapshot(faker, listingId),
      },
    });
  }
}

/**
 * Fills an empty database with development data. Deterministic (faker is
 * seeded) and idempotent: rerunning it on a seeded database changes nothing.
 */
export async function seed(prisma: PrismaClient): Promise<void> {
  const faker = new Faker({ locale: [es, en] });
  faker.seed(SEED_FAKER_SEED);

  const passwordHash = await hashPassword(SEED_PASSWORD);
  const users = await seedUsers(prisma, faker, passwordHash);

  const firstUser = users[0];
  if (firstUser) await ensureTwoFactorUser(prisma, firstUser);

  await seedFavorites(prisma, faker, users);
  await seedAlerts(prisma, faker, users);

  console.log(`\n  seeded users: ${users.map((user) => user.email).join(", ")}`);
}

// TEST-11/TEST-12: `env`, the Prisma client loader and `seed` itself are
// injected, real implementation as default, so the colocated test can drive
// both the refusal and the happy path without a real database — the loader
// stays a dynamic import by default so importing this module never pulls in
// `@/lib/db/prisma` (and so `lib/env.ts`'s required variables) as a side effect.
export async function main({
  env = process.env,
  loadPrisma = async () => (await import("@/lib/db/prisma")).prisma,
  seedFn = seed,
}: {
  env?: Record<string, string | undefined>;
  loadPrisma?: () => Promise<PrismaClient>;
  seedFn?: typeof seed;
} = {}): Promise<void> {
  assertLocalDatabase(env.DATABASE_URL ?? "");
  const prisma = await loadPrisma();
  await seedFn(prisma);
}

// Guarded so the exports above can be imported by the colocated tests without
// running the seed as a side effect of `import`, the same pattern
// scripts/db-branch.mjs and scripts/require-branch-db.mjs use.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  // No top-level await: tsx compiles this file as CommonJS, since the package
  // has no "type": "module".
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
