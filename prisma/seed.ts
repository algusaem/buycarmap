// TEST-11/TEST-12 (docs/specs/core-testing.md): fills an empty local database
// with deterministic development data — 3 users (one with two-factor on), 10
// favorites and 3 alerts with matches — and refuses to run against anything
// but a local database. ENV-4 (docs/specs/core-environments.md) amends
// TEST-12's guard so the shared `preview` Neon branch can still be seeded
// deliberately, by naming its exact host in SEED_TARGET_HOST.
//
// Uses its own seeded `Faker` instance (`en`/`es` locales), separate from
// test/factories/*.ts's shared default `faker` — STACK.md §3: seed data is
// written by its own code, not by the test factories.

import { createHmac } from "node:crypto";
import { fileURLToPath } from "node:url";
import { en, es, Faker } from "@faker-js/faker";
import type { PrismaClient, User } from "@/app/generated/prisma/client";
import { hashPassword } from "@/lib/auth/hash";
import { auth, createSessionCookie } from "@/lib/auth/auth";

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

/**
 * ENV-4 (docs/specs/core-environments.md): amends TEST-12 so the shared
 * `preview` Neon branch can be seeded deliberately. Allows `localhost` and
 * `127.0.0.1` exactly as `assertLocalDatabase` does; otherwise allows only
 * when `targetHost` names that exact hostname, and refuses — naming the
 * hostname — in every other case, including when `targetHost` is set but
 * differs.
 */
export function assertSeedTarget(url: string, targetHost: string | undefined): void {
  const { hostname } = new URL(url);
  if (hostname === "localhost" || hostname === "127.0.0.1") return;
  if (targetHost === hostname) return;
  throw new Error(`Refusing to seed "${hostname}": SEED_TARGET_HOST does not name it.`);
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

/**
 * BAUTH-14 (docs/specs/core-better-auth.md): Better Auth's sign-in (and,
 * for `ensureTwoFactorUser` below, `auth.api.enableTwoFactor`) looks up the
 * "credential" `accounts` row, not `users.password` — the same gap
 * test/factories/user.ts's `createUser()` closes for the Vitest suite.
 */
async function upsertCredentialAccount(
  prisma: PrismaClient,
  userId: string,
  passwordHash: string,
): Promise<void> {
  await prisma.account.upsert({
    where: { provider_providerAccountId: { provider: "credential", providerAccountId: userId } },
    create: {
      userId,
      provider: "credential",
      providerAccountId: userId,
      type: "credential",
      password: passwordHash,
    },
    update: { password: passwordHash },
  });
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
    await upsertCredentialAccount(prisma, user.id, passwordHash);
    users.push(user);
  }
  return users;
}

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function decodeBase32(input: string): Buffer {
  const bytes: number[] = [];
  let buffer = 0;
  let bitsCollected = 0;

  for (const char of input.toUpperCase()) {
    if (char === "=") continue;
    const value = BASE32_ALPHABET.indexOf(char);
    if (value === -1) continue;
    buffer = (buffer << 5) | value;
    bitsCollected += 5;
    if (bitsCollected >= 8) {
      bitsCollected -= 8;
      bytes.push((buffer >> bitsCollected) & 0xff);
    }
  }

  return Buffer.from(bytes);
}

/**
 * The current 6-digit TOTP code for an `otpauth://` URI Better Auth's
 * `twoFactor` plugin just minted — RFC 4226 §5.3's dynamic truncation,
 * against the URI's own `secret` parameter (BAUTH-11,
 * docs/specs/core-better-auth.md).
 */
function currentTotpCode(otpauthUri: string): string {
  const query = otpauthUri.split("?")[1] ?? "";
  const secretParam = new URLSearchParams(query).get("secret") ?? "";
  const key = decodeBase32(secretParam);
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 1000 / 30)));

  const digest = createHmac("sha1", key).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const truncated =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  return (truncated % 1_000_000).toString().padStart(6, "0");
}

/**
 * Enrols the first seeded user in two-factor through Better Auth's own
 * `twoFactor` plugin (BAUTH-11, docs/specs/core-better-auth.md) — enrolment
 * is always available now, encrypted with `BETTER_AUTH_SECRET`, which every
 * environment already requires.
 */
export async function ensureTwoFactorUser(prisma: PrismaClient, user: User): Promise<void> {
  const existing = await prisma.user.findUnique({ where: { id: user.id } });
  if (existing?.twoFactorEnabled) {
    console.log(`  two-factor already enabled for ${user.email}`);
    return;
  }

  const cookie = await createSessionCookie(user.id);
  const headers = new Headers({ cookie: `${cookie.name}=${cookie.value}` });

  const enabled = await auth.api.enableTwoFactor({ body: { password: SEED_PASSWORD }, headers });
  if (enabled.method !== "totp" || !enabled.totpURI) {
    throw new Error("expected a TOTP enrolment");
  }

  await auth.api.verifyTOTP({ body: { code: currentTotpCode(enabled.totpURI) }, headers });

  const secretParam = new URLSearchParams(enabled.totpURI.split("?")[1] ?? "").get("secret") ?? "";
  console.log(`  two-factor enabled for ${user.email} — TOTP secret: ${secretParam}`);
  console.log(`  recovery codes: ${enabled.backupCodes.join(", ")}`);
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
  assertSeedTarget(env.DATABASE_URL ?? "", env.SEED_TARGET_HOST);
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
