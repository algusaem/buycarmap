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

export function buildUser(overrides: Partial<Prisma.UserCreateInput> = {}): Prisma.UserCreateInput {
  faker.seed(BUILD_SEED);
  return {
    email: faker.internet.email({ provider: "example.test" }).toLowerCase(),
    password: PASSWORD_HASH,
    name: faker.person.fullName(),
    ...overrides,
  };
}

let sequence = 0;

// BAUTH-14 (docs/specs/core-better-auth.md): in the real database, every user
// with a password has a matching `accounts` row with `provider = "credential"`
// — the migration backfills it once for existing rows, and the app's own
// flows (registration, password reset, change-password) keep writing it for
// the rest. `createUser()` bypasses all of that and writes straight to
// `User`, so without this a factory-created user is invisible to
// `auth.api.signInEmail`, which looks the credential account up, not
// `User.password`.
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

export async function createUser(overrides: Partial<Prisma.UserCreateInput> = {}): Promise<User> {
  const data = buildUser(overrides);
  let user: User;

  if (!("email" in overrides)) {
    sequence += 1;
    data.email = `${sequence}-${data.email}`;
    user = await prisma.user.create({ data });
  } else {
    user = await prisma.user.upsert({ where: { email: data.email }, create: data, update: data });
  }

  if (data.password) {
    await upsertCredentialAccount(user.id, data.password);
  }

  return user;
}
