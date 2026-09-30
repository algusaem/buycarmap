// TEST-10 (docs/specs/core-testing.md): faker-based builders for the three
// auth token rows the converted tests use — `PasswordResetToken`,
// `EmailVerificationToken` and `PendingRegistration` — replacing the
// hand-built `tokenRecord()`/`pendingRecord()` fixtures the mocked versions of
// those tests declared locally.
//
// `user` has no sensible default for the two token tables that relate to one
// — a token never exists without an owner — so their overrides type requires
// it. `create*` appends a call counter to `tokenHash` when it was not
// overridden, the unique column on all three models.
//
// See test/factories/user.ts for why `build*` reseeds internally.

import { faker } from "@faker-js/faker";
import type {
  EmailVerificationToken,
  PasswordResetToken,
  PendingRegistration,
  Prisma,
} from "@/app/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

const BUILD_SEED = 20260930;
const ONE_HOUR_MS = 60 * 60 * 1000;

function freshTokenHash(): string {
  return faker.string.hexadecimal({ length: 64, casing: "lower", prefix: "" });
}

// --- PasswordResetToken ------------------------------------------------------

type PasswordResetTokenOverrides = Partial<Prisma.PasswordResetTokenCreateInput> &
  Pick<Prisma.PasswordResetTokenCreateInput, "user">;

export function buildPasswordResetToken(
  overrides: PasswordResetTokenOverrides,
): Prisma.PasswordResetTokenCreateInput {
  faker.seed(BUILD_SEED);
  return {
    tokenHash: freshTokenHash(),
    expiresAt: new Date(Date.now() + ONE_HOUR_MS),
    usedAt: null,
    ...overrides,
  };
}

let passwordResetSequence = 0;

export async function createPasswordResetToken(
  overrides: PasswordResetTokenOverrides,
): Promise<PasswordResetToken> {
  const data = buildPasswordResetToken(overrides);
  if (!("tokenHash" in overrides)) {
    passwordResetSequence += 1;
    data.tokenHash = `${data.tokenHash}-${passwordResetSequence}`;
  }
  return prisma.passwordResetToken.create({ data });
}

// --- EmailVerificationToken ---------------------------------------------------

type EmailVerificationTokenOverrides = Partial<Prisma.EmailVerificationTokenCreateInput> &
  Pick<Prisma.EmailVerificationTokenCreateInput, "user">;

export function buildEmailVerificationToken(
  overrides: EmailVerificationTokenOverrides,
): Prisma.EmailVerificationTokenCreateInput {
  faker.seed(BUILD_SEED);
  return {
    tokenHash: freshTokenHash(),
    newEmail: null,
    expiresAt: new Date(Date.now() + ONE_HOUR_MS),
    usedAt: null,
    ...overrides,
  };
}

let emailVerificationSequence = 0;

export async function createEmailVerificationToken(
  overrides: EmailVerificationTokenOverrides,
): Promise<EmailVerificationToken> {
  const data = buildEmailVerificationToken(overrides);
  if (!("tokenHash" in overrides)) {
    emailVerificationSequence += 1;
    data.tokenHash = `${data.tokenHash}-${emailVerificationSequence}`;
  }
  return prisma.emailVerificationToken.create({ data });
}

// --- PendingRegistration -------------------------------------------------------

export function buildPendingRegistration(
  overrides: Partial<Prisma.PendingRegistrationCreateInput> = {},
): Prisma.PendingRegistrationCreateInput {
  faker.seed(BUILD_SEED);
  return {
    email: faker.internet.email({ provider: "example.test" }).toLowerCase(),
    password: "$2b$12$factoryPendingRegistrationHashxxxxxxxxxxxxxxxxxxxxxxx",
    name: faker.person.fullName(),
    tokenHash: freshTokenHash(),
    expiresAt: new Date(Date.now() + ONE_HOUR_MS),
    ...overrides,
  };
}

let pendingRegistrationSequence = 0;

export async function createPendingRegistration(
  overrides: Partial<Prisma.PendingRegistrationCreateInput> = {},
): Promise<PendingRegistration> {
  const data = buildPendingRegistration(overrides);
  if (!("tokenHash" in overrides)) {
    pendingRegistrationSequence += 1;
    data.tokenHash = `${data.tokenHash}-${pendingRegistrationSequence}`;
  }
  return prisma.pendingRegistration.create({ data });
}
