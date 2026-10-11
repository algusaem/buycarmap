// TEST-10 (docs/specs/core-testing.md): a faker-based builder for `User`,
// replacing the hand-built fixtures the mocked tests used.
//
// `buildUser` reseeds the shared faker instance to a fixed value before
// generating, so two builds are equal regardless of whatever the harness's
// own per-test `faker.seed()` (test/setup.integration.ts) left the stream at
// — "uses a seeded faker, so a failing test reproduces" (the spec's own
// words). `createUser`:
//   - with no email override, appends a call counter to the generated email,
//     so creating several rows in the same test never collides on the unique
//     column;
//   - with an email override, upserts on it instead of inserting, so a test
//     helper that seeds "the same user" more than once in one test (several
//     converted tests do, deliberately, to re-seed a token against an
//     already-created account) gets that one row back rather than a unique
//     constraint violation.

import { faker } from "@faker-js/faker";
import type { Prisma, User } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

const BUILD_SEED = 20260930;

// bcrypt's cost factor makes hashing on every call slow enough to defeat the
// point of a cheap factory, so this is `hashPassword("buycarmap-factory-password")`'s
// output, computed once rather than at every import — a top-level `await
// hashPassword(...)` would also break any test file that mocks
// `@/lib/auth/hash` without including `hashPassword` in its mock factory
// (several auth integration tests do exactly that, deliberately, since they
// only need `verifyPassword` mocked). Not a real secret: it only ever backs
// rows this factory creates, and most callers override `password` anyway.
const PASSWORD_HASH = "$2b$12$uKQ1mJNDQvCvb2dYdyxU5u6xFQS03YaZm0alg6X6nMHQXAvIcHCne";

/**
 * `createUser`'s overrides: the `User` fields, plus `password` — the hash
 * stored on the user's "credential" account, or null for an OAuth-only user
 * with no credential account at all.
 */
interface UserOverrides extends Partial<Prisma.UserCreateInput> {
  password?: string | null;
}

export function buildUser(overrides: Partial<Prisma.UserCreateInput> = {}): Prisma.UserCreateInput {
  faker.seed(BUILD_SEED);
  return {
    email: faker.internet.email({ provider: "example.test" }).toLowerCase(),
    name: faker.person.fullName(),
    ...overrides,
  };
}

let sequence = 0;

// BAUTH-19 (docs/specs/core-better-auth.md): a user's password lives only on
// a matching `accounts` row with `provider = "credential"` — the row the
// app's own flows (registration, password reset, change-password) write and
// `auth.api.signInEmail` looks up. `createUser()` bypasses those flows, so it
// writes the row itself.
async function upsertCredentialAccount(userId: string, password: string): Promise<void> {
  await prisma.account.upsert({
    where: { provider_providerAccountId: { provider: "credential", providerAccountId: userId } },
    create: {
      userId,
      provider: "credential",
      providerAccountId: userId,
      type: "credential",
      password,
    },
    update: { password },
  });
}

export async function createUser({
  password = PASSWORD_HASH,
  ...overrides
}: UserOverrides = {}): Promise<User> {
  const data = buildUser(overrides);
  let user: User;

  if (!("email" in overrides)) {
    sequence += 1;
    data.email = `${sequence}-${data.email}`;
    user = await prisma.user.create({ data });
  } else {
    user = await prisma.user.upsert({ where: { email: data.email }, create: data, update: data });
  }

  if (password) {
    await upsertCredentialAccount(user.id, password);
  }

  return user;
}
