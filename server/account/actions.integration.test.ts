import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createUser } from "@/test/factories/user";
import { createAlertCriteria } from "@/test/factories/alert-criteria";
import { createAlert } from "@/test/factories/alert";

// BAUTH-2 (docs/specs/core-better-auth.md), harness change: changePassword
// now also asks for the current session's own id so it can spare it from
// the "revoke every other session" delete. Resolving to null here is the
// same as "no real Better Auth session cookie in this test" — exactly what
// the pre-existing session rows created directly below simulate.
vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: vi.fn(),
  getCurrentSessionId: vi.fn(async () => null),
}));
vi.mock("@/lib/auth/hash", () => ({
  hashPassword: vi.fn(async (p: string) => `hashed:${p}`),
  verifyPassword: vi.fn(),
}));
vi.mock("@/server/rate-limit/service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/rate-limit/service")>()),
  consumeRateLimit: vi.fn(async () => ({
    allowed: true,
    remaining: 9,
    retryAfterMs: 0,
  })),
}));
vi.mock("@/lib/platform/email", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("next-intl/server", () => ({ getLocale: vi.fn(async () => "en") }));
// EXPORT-11..13 (docs/specs/account-data-export.md): the export's database
// read is wrapped, still calling the real query, so a test can prove it was
// never reached (no session, budget spent) or make it fail (a database error).
vi.mock("./service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./service")>();
  return { ...actual, findMyDataExport: vi.fn(actual.findMyDataExport) };
});

import { getCurrentUser } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/hash";
import { consumeRateLimit } from "@/server/rate-limit/service";
import { findMyDataExport } from "./service";
import { createFavorite } from "@/test/factories/favorite";
import { createAlertMatch } from "@/test/factories/alert-match";
import {
  createEmailVerificationToken,
  createPasswordResetToken,
} from "@/test/factories/auth-tokens";
import {
  changePassword,
  deleteAccount,
  exportMyData,
  listMySessions,
  revokeMySession,
  signOutEverywhere,
  unlinkAccount,
  updateProfile,
} from "./actions";
import { getAccountOverview } from "./queries";

const NEW_PASSWORD = "harbour-lentil-quilt";

// DATA-15 (docs/specs/core-data-model.md): version is now required by
// updateProfileServerSchema/changePasswordServerSchema, so every call needs
// one. "1" is a fresh factory user's starting version; a test asserting the
// optimistic lock overrides it explicitly.
function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries({ version: "1", ...fields })) fd.set(key, value);
  return fd;
}

function changeRequest(overrides: Record<string, string> = {}): FormData {
  return formData({
    currentPassword: "the-old-password",
    password: NEW_PASSWORD,
    confirmPassword: NEW_PASSWORD,
    ...overrides,
  });
}

// BAUTH-19: the password lives on the user's "credential" account.
async function credentialPassword(userId: string): Promise<string | null | undefined> {
  const credential = await prisma.account.findFirst({
    where: { userId, provider: "credential" },
    select: { password: true },
  });
  return credential?.password;
}

async function signedInAsNewUser(overrides: Parameters<typeof createUser>[0] = {}) {
  const user = await createUser({ password: "old-hash", ...overrides });
  vi.mocked(getCurrentUser).mockResolvedValue({ id: user.id, email: user.email });
  return user;
}

beforeEach(() => {
  vi.mocked(getCurrentUser).mockReset();
  vi.mocked(verifyPassword).mockReset();
  vi.mocked(consumeRateLimit).mockResolvedValue({
    allowed: true,
    remaining: 9,
    retryAfterMs: 0,
  });
});

describe("updateProfile authorization", () => {
  it("refuses when there is no session", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    expect(await updateProfile(formData({ name: "Ada" }))).toEqual({
      success: false,
      error: "unauthorized",
    });
  });

  it("scopes the update to the session's own user id", async () => {
    const user = await signedInAsNewUser();

    // The form carries no user identifier, so there is nothing a caller could
    // tamper with to edit somebody else's profile.
    await updateProfile(formData({ name: "Ada", id: "someone-else" }));

    const found = await prisma.user.findUnique({ where: { id: user.id } });
    expect(found?.name).toBe("Ada");
  });

  it("stores null for a cleared name", async () => {
    const user = await signedInAsNewUser({ name: "Ada" });

    await updateProfile(formData({ name: "" }));

    const found = await prisma.user.findUnique({ where: { id: user.id } });
    expect(found?.name).toBeNull();
  });

  it("rejects a name past the length limit", async () => {
    const user = await signedInAsNewUser({ name: "Ada" });

    expect(await updateProfile(formData({ name: "a".repeat(81) }))).toEqual({
      success: false,
      error: "nameTooLong",
    });
    const found = await prisma.user.findUnique({ where: { id: user.id } });
    expect(found?.name).toBe("Ada");
  });
});

describe("changePassword", () => {
  it("refuses without a session", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    expect(await changePassword(changeRequest())).toEqual({
      success: false,
      error: "unauthorized",
    });
  });

  it("rejects an incorrect current password", async () => {
    const user = await signedInAsNewUser();
    vi.mocked(verifyPassword).mockResolvedValue(false);

    expect(await changePassword(changeRequest())).toEqual({
      success: false,
      error: "currentPasswordIncorrect",
    });
    expect(await credentialPassword(user.id)).toBe("old-hash");
  });

  it("requires the current password even with a valid session", async () => {
    // This is what stops a stolen session, or someone at an unlocked laptop,
    // from silently taking the account over for good.
    await signedInAsNewUser();
    vi.mocked(verifyPassword).mockResolvedValue(false);

    await changePassword(changeRequest());

    expect(verifyPassword).toHaveBeenCalledWith("the-old-password", "old-hash");
  });

  it("rejects setting the same password again", async () => {
    await signedInAsNewUser();
    // First call verifies the current password, second is the reuse check.
    vi.mocked(verifyPassword).mockResolvedValueOnce(true).mockResolvedValueOnce(true);

    expect(await changePassword(changeRequest())).toEqual({
      success: false,
      error: "passwordReused",
    });
  });

  it("rejects a weak new password", async () => {
    await signedInAsNewUser();
    vi.mocked(verifyPassword).mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const weak = "qwertyuiopasdfgh";

    expect(await changePassword(changeRequest({ password: weak, confirmPassword: weak }))).toEqual({
      success: false,
      error: "passwordWeak",
    });
  });

  it("refuses for an OAuth-only account with no password set", async () => {
    await signedInAsNewUser({ password: null });

    expect(await changePassword(changeRequest())).toEqual({
      success: false,
      error: "unauthorized",
    });
  });

  it("AUTH-5: updates the credential account's password and clears sessions on success", async () => {
    const user = await signedInAsNewUser();
    await prisma.session.create({
      data: {
        user: { connect: { id: user.id } },
        sessionToken: "session-token-1",
        expires: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    vi.mocked(verifyPassword).mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    expect(await changePassword(changeRequest())).toEqual({ success: true });

    expect(await credentialPassword(user.id)).toBe(`hashed:${NEW_PASSWORD}`);
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
  });

  it("refuses once the per-account rate limit is spent", async () => {
    await signedInAsNewUser();
    vi.mocked(consumeRateLimit).mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfterMs: 60_000,
    });

    expect(await changePassword(changeRequest())).toEqual({
      success: false,
      error: "rateLimited",
    });
  });
});

// DATA-15 (docs/specs/core-data-model.md): `version` does not exist on User
// yet, so passing it as an override and reading it back both fail until
// DATA-8 adds it.
describe("DATA-15: optimistic locking on updateProfile and changePassword", () => {
  it("DATA-15 (worked example): a stale version is rejected as a conflict, and the name is unchanged", async () => {
    const user = await signedInAsNewUser({ name: "Ana", version: 3 });

    const first = await updateProfile(formData({ name: "Ana María", version: "3" }));
    expect(first).toEqual({ success: true });
    const afterFirst = await prisma.user.findUnique({ where: { id: user.id } });
    expect(afterFirst?.version).toBe(4);

    const second = await updateProfile(formData({ name: "Anita", version: "3" }));

    expect(second).toEqual({ success: false, error: "conflict" });
    const afterSecond = await prisma.user.findUnique({ where: { id: user.id } });
    expect(afterSecond?.name).toBe("Ana María");
  });

  it("DATA-15: changePassword with a stale version is rejected as a conflict", async () => {
    const user = await signedInAsNewUser();
    vi.mocked(verifyPassword).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    // Bumped from under the caller, the way a concurrent edit would.
    await prisma.user.update({ where: { id: user.id }, data: { version: 4 } });

    const result = await changePassword(changeRequest({ version: "3" }));

    expect(result).toEqual({ success: false, error: "conflict" });
  });
});

describe("signOutEverywhere", () => {
  it("refuses without a session", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    expect(await signOutEverywhere()).toEqual({
      success: false,
      error: "unauthorized",
    });
  });

  it("deletes every session of the user", async () => {
    const user = await signedInAsNewUser();
    await prisma.session.create({
      data: {
        user: { connect: { id: user.id } },
        sessionToken: "session-token-1",
        expires: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    expect(await signOutEverywhere()).toEqual({ success: true });

    // Sessions live in Postgres: deleting the rows is the revocation.
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
  });

  it("leaves the password untouched", async () => {
    const user = await signedInAsNewUser({ password: "old-hash" });

    await signOutEverywhere();

    expect(await credentialPassword(user.id)).toBe("old-hash");
  });
});

describe("unlinkAccount", () => {
  it("refuses without a session", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    expect(await unlinkAccount(formData({ provider: "google" }))).toEqual({
      success: false,
      error: "unauthorized",
    });
  });

  it("disconnects a provider when a password remains", async () => {
    const user = await signedInAsNewUser({ password: "hash" });
    const account = await prisma.account.create({
      data: {
        user: { connect: { id: user.id } },
        type: "oauth",
        provider: "google",
        providerAccountId: "g-1",
      },
    });

    expect(await unlinkAccount(formData({ provider: "google" }))).toEqual({ success: true });
    expect(await prisma.account.findUnique({ where: { id: account.id } })).toBeNull();
  });

  it("disconnects one provider when another remains", async () => {
    const user = await signedInAsNewUser({ password: null });
    await prisma.account.create({
      data: {
        user: { connect: { id: user.id } },
        type: "oauth",
        provider: "google",
        providerAccountId: "g-1",
      },
    });
    await prisma.account.create({
      data: {
        user: { connect: { id: user.id } },
        type: "oauth",
        provider: "github",
        providerAccountId: "gh-1",
      },
    });

    expect(await unlinkAccount(formData({ provider: "google" }))).toEqual({ success: true });
    expect(await prisma.account.count({ where: { userId: user.id } })).toBe(1);
  });

  it("refuses to remove the only way into a passwordless account", async () => {
    const user = await signedInAsNewUser({ password: null });
    const account = await prisma.account.create({
      data: {
        user: { connect: { id: user.id } },
        type: "oauth",
        provider: "google",
        providerAccountId: "g-1",
      },
    });

    // There would be no password to fall back on, and password reset skips
    // passwordless accounts — the user would be permanently locked out.
    expect(await unlinkAccount(formData({ provider: "google" }))).toEqual({
      success: false,
      error: "lastSignInMethod",
    });
    expect(await prisma.account.findUnique({ where: { id: account.id } })).not.toBeNull();
  });

  it("is idempotent for a provider that is not linked", async () => {
    await signedInAsNewUser({ password: "hash" });

    expect(await unlinkAccount(formData({ provider: "google" }))).toEqual({ success: true });
  });

  it("PLAT-27: refuses with no provider field (unchanged)", async () => {
    await signedInAsNewUser({ password: "hash" });

    expect(await unlinkAccount(formData({ provider: "" }))).toEqual({
      success: false,
      error: "generic",
    });
  });

  // Security review BLOCKER (item 1): "credential" is Better Auth's own
  // sign-in plumbing (the row holding the password, BAUTH-19), not a
  // provider the user chose to connect, and must never be removable from
  // this action.
  it("security review BLOCKER: refuses to unlink the credential row, which survives", async () => {
    const user = await signedInAsNewUser({ password: "hash" });
    const credential = await prisma.account.findFirst({
      where: { userId: user.id, provider: "credential" },
    });
    if (!credential) throw new Error("expected createUser to write a credential account");

    expect(await unlinkAccount(formData({ provider: "credential" }))).toEqual({
      success: false,
      error: "lastSignInMethod",
    });
    expect(await prisma.account.findUnique({ where: { id: credential.id } })).not.toBeNull();
  });
});

describe("deleteAccount", () => {
  it("refuses without a session", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    expect(await deleteAccount(formData({ password: "x" }))).toEqual({
      success: false,
      error: "unauthorized",
    });
  });

  it("requires a password for a credential account", async () => {
    const user = await signedInAsNewUser();

    expect(await deleteAccount(formData({ password: "" }))).toEqual({
      success: false,
      error: "passwordRequired",
    });
    expect(await prisma.user.findUnique({ where: { id: user.id } })).not.toBeNull();
  });

  it("PLAT-27: refuses with no password field on a credential account (unchanged)", async () => {
    const user = await signedInAsNewUser();

    expect(await deleteAccount(formData({ password: "" }))).toEqual({
      success: false,
      error: "passwordRequired",
    });
    expect(await prisma.user.findUnique({ where: { id: user.id } })).not.toBeNull();
  });

  it("rejects a wrong password without deleting anything", async () => {
    const user = await signedInAsNewUser();
    vi.mocked(verifyPassword).mockResolvedValue(false);

    expect(await deleteAccount(formData({ password: "wrong" }))).toEqual({
      success: false,
      error: "currentPasswordIncorrect",
    });
    // Deletion is irreversible and cascades, so this must never be best-effort.
    expect(await prisma.user.findUnique({ where: { id: user.id } })).not.toBeNull();
  });

  it("deletes the account when the password checks out", async () => {
    const user = await signedInAsNewUser();
    vi.mocked(verifyPassword).mockResolvedValue(true);

    expect(await deleteAccount(formData({ password: "correct" }))).toEqual({ success: true });
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
  });

  it("skips the password check for an OAuth-only account", async () => {
    const user = await signedInAsNewUser({ password: null });

    expect(await deleteAccount(formData({ password: "" }))).toEqual({ success: true });
    expect(verifyPassword).not.toHaveBeenCalled();
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
  });
});

// ALERT-45 (docs/specs/alerts.md, #21): deleting an account releases every
// criteria set its alerts referenced, in the same transaction as the user
// row, unless another alert — another user's, inactive, or soft-deleted —
// still references it.
describe("ALERT-45: deleteAccount releases alert criteria", () => {
  const CRITERIA_INPUT = {
    brand: "Audi",
    model: "A3",
    maxPrice: 20000,
    latitude: 40.4168,
    longitude: -3.7038,
    distanceInKm: 50,
  };

  it("ALERT-45: keeps a criteria set and its seen listings while another user's alert still references it, and releases it once the last one is deleted", async () => {
    const ada = await createUser({ password: "old-hash" });
    const grace = await createUser({ password: "old-hash" });
    const criteria = await createAlertCriteria({ criteria: CRITERIA_INPUT });
    await createAlert({
      user: { connect: { id: ada.id } },
      criteria: { connect: { id: criteria.id } },
    });
    await createAlert({
      user: { connect: { id: grace.id } },
      criteria: { connect: { id: criteria.id } },
    });
    await prisma.alertSeenListing.createMany({
      data: [
        { criteriaId: criteria.id, listingId: "wallapop-1", source: "Wallapop" },
        { criteriaId: criteria.id, listingId: "wallapop-2", source: "Wallapop" },
      ],
    });

    vi.mocked(getCurrentUser).mockResolvedValue({ id: ada.id, email: ada.email });
    vi.mocked(verifyPassword).mockResolvedValue(true);

    expect(await deleteAccount(formData({ password: "correct" }))).toEqual({ success: true });

    expect(await prisma.user.findUnique({ where: { id: ada.id } })).toBeNull();
    expect(await prisma.alertCriteria.findUnique({ where: { id: criteria.id } })).not.toBeNull();
    expect(await prisma.alertSeenListing.count({ where: { criteriaId: criteria.id } })).toBe(2);
    expect(await prisma.alert.count({ where: { userId: grace.id, criteriaId: criteria.id } })).toBe(
      1,
    );

    vi.mocked(getCurrentUser).mockResolvedValue({ id: grace.id, email: grace.email });

    expect(await deleteAccount(formData({ password: "correct" }))).toEqual({ success: true });

    expect(await prisma.alertCriteria.findUnique({ where: { id: criteria.id } })).toBeNull();
    expect(await prisma.alertSeenListing.count({ where: { criteriaId: criteria.id } })).toBe(0);
  });

  it("ALERT-45: releases a criteria set whose sole subscriber's alert is inactive", async () => {
    const ada = await createUser({ password: "old-hash" });
    const criteria = await createAlertCriteria({ criteria: CRITERIA_INPUT });
    await createAlert({
      user: { connect: { id: ada.id } },
      criteria: { connect: { id: criteria.id } },
      active: false,
    });

    vi.mocked(getCurrentUser).mockResolvedValue({ id: ada.id, email: ada.email });
    vi.mocked(verifyPassword).mockResolvedValue(true);

    expect(await deleteAccount(formData({ password: "correct" }))).toEqual({ success: true });

    expect(await prisma.alertCriteria.findUnique({ where: { id: criteria.id } })).toBeNull();
  });

  it("ALERT-45: keeps a criteria set that another user's soft-deleted alert still references", async () => {
    const ada = await createUser({ password: "old-hash" });
    const grace = await createUser({ password: "old-hash" });
    const criteria = await createAlertCriteria({ criteria: CRITERIA_INPUT });
    await createAlert({
      user: { connect: { id: ada.id } },
      criteria: { connect: { id: criteria.id } },
    });
    await createAlert({
      user: { connect: { id: grace.id } },
      criteria: { connect: { id: criteria.id } },
      deletedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    });

    vi.mocked(getCurrentUser).mockResolvedValue({ id: ada.id, email: ada.email });
    vi.mocked(verifyPassword).mockResolvedValue(true);

    expect(await deleteAccount(formData({ password: "correct" }))).toEqual({ success: true });

    expect(await prisma.alertCriteria.findUnique({ where: { id: criteria.id } })).not.toBeNull();
  });
});

// BAUTH-4 (docs/specs/core-better-auth.md): `listMySessions` and
// `revokeMySession` are still the "not implemented" stubs server/account/actions.ts
// declares for this phase — /account has nothing to read sessions from yet.
// Every case below is red at that throw.
describe("BAUTH-4: listMySessions", () => {
  it("BAUTH-4: returns the signed-in user's own sessions, with device, browser and last use, and none of another user's", async () => {
    const user = await signedInAsNewUser();
    const other = await createUser({ password: "hash" });
    const mine = await prisma.session.create({
      data: {
        user: { connect: { id: user.id } },
        sessionToken: "session-token-mine",
        expires: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    await prisma.session.create({
      data: {
        user: { connect: { id: other.id } },
        sessionToken: "session-token-other",
        expires: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const sessions = await listMySessions();

    expect(sessions.map((session) => session.id)).toEqual([mine.id]);
    expect(sessions[0]).toMatchObject({
      userAgent: expect.anything(),
      ipAddress: expect.anything(),
      lastUsedAt: expect.anything(),
    });
  });
});

describe("BAUTH-4: revokeMySession", () => {
  it("BAUTH-4: refuses to revoke another user's session", async () => {
    await signedInAsNewUser();
    const other = await createUser({ password: "hash" });
    const othersSession = await prisma.session.create({
      data: {
        user: { connect: { id: other.id } },
        sessionToken: "session-token-other",
        expires: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const result = await revokeMySession(othersSession.id);

    expect(result).toEqual({ success: false, error: "unauthorized" });
    expect(await prisma.session.findUnique({ where: { id: othersSession.id } })).not.toBeNull();
  });

  it("BAUTH-4: deletes the signed-in user's own session", async () => {
    const user = await signedInAsNewUser();
    const mine = await prisma.session.create({
      data: {
        user: { connect: { id: user.id } },
        sessionToken: "session-token-mine",
        expires: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const result = await revokeMySession(mine.id);

    expect(result).toEqual({ success: true });
    expect(await prisma.session.findUnique({ where: { id: mine.id } })).toBeNull();
  });

  it("PLAT-27: refuses a session id that is not a UUID", async () => {
    await signedInAsNewUser();

    const result = await revokeMySession("not-a-uuid");

    expect(result).toEqual({ success: false, error: "unauthorized" });
  });
});

// BAUTH-19 (docs/specs/core-better-auth.md), worked examples (a) and (c):
// "is the email verified" reads `emailConfirmed`, and "has a password" reads
// the credential `accounts` row, never the legacy `users` columns.
describe("BAUTH-19 worked examples", () => {
  it("BAUTH-19: an OAuth-only user with emailConfirmed and no legacy emailVerified reads as verified on /account", async () => {
    // `emailVerified` is left at its default (null), as Better Auth leaves it
    // for every account it creates.
    await signedInAsNewUser({ password: null, emailConfirmed: true });

    const record = await getAccountOverview();

    expect(record).toMatchObject({ emailConfirmed: true });
  });

  it("BAUTH-19: a user with a credential account and no users.password has a password on /account and must give it to delete", async () => {
    const user = await signedInAsNewUser({ password: null });
    await prisma.account.create({
      data: {
        user: { connect: { id: user.id } },
        type: "credential",
        provider: "credential",
        providerAccountId: user.id,
        password: "credential-hash",
      },
    });

    const record = await getAccountOverview();
    expect(record.password).not.toBeNull();

    expect(await deleteAccount(formData({}))).toEqual({
      success: false,
      error: "passwordRequired",
    });

    vi.mocked(verifyPassword).mockResolvedValue(false);
    expect(await deleteAccount(formData({ password: "not-the-password" }))).toEqual({
      success: false,
      error: "currentPasswordIncorrect",
    });
    expect(verifyPassword).toHaveBeenCalledWith("not-the-password", "credential-hash");

    expect(await prisma.user.findUnique({ where: { id: user.id } })).not.toBeNull();
  });
});

// EXPORT-1..13, EXPORT-19 (docs/specs/account-data-export.md): the worked
// example's Ada (the caller) and Bob (another user), with the clock at
// 2026-10-11T09:30:00.000Z. Every expected value below is copied from the
// spec's worked examples, not computed the way the service computes it.
const EXPORT_NOW = new Date("2026-10-11T09:30:00.000Z");

const ADA_USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0";

const SNAPSHOT_KEYS = [
  "listingId",
  "source",
  "title",
  "subtitle",
  "image",
  "brand",
  "model",
  "location",
  "fuel",
  "url",
  "price",
  "mileage",
  "year",
  "lat",
  "lng",
  "createdAt",
];

async function seedAda() {
  const ada = await createUser({
    email: "ada@example.test",
    name: "Ada Lovelace",
    image: null,
    locale: "en",
    emailConfirmed: true,
    twoFactorEnabled: true,
    twoFactorEnabledAt: new Date("2026-09-03T10:00:00.000Z"),
    createdAt: new Date("2026-09-01T10:00:00.000Z"),
    password: "hashed:ada-secret",
  });
  const owner = { connect: { id: ada.id } };

  await prisma.account.create({
    data: {
      userId: ada.id,
      type: "oauth",
      provider: "google",
      providerAccountId: "google-ada-123",
      access_token: "ada-access-token",
      refresh_token: "ada-refresh-token",
      id_token: "ada-id-token",
      createdAt: new Date("2026-09-02T10:00:00.000Z"),
    },
  });
  await prisma.twoFactor.create({
    data: { userId: ada.id, secret: "ada-totp-secret", backupCodes: "ada-backup-codes" },
  });
  await prisma.session.create({
    data: {
      userId: ada.id,
      sessionToken: "ada-session-token",
      expires: new Date("2026-11-10T00:00:00.000Z"),
      ipAddress: "203.0.113.7",
      userAgent: ADA_USER_AGENT,
      createdAt: new Date("2026-10-10T00:00:00.000Z"),
    },
  });
  await createPasswordResetToken({ user: owner, tokenHash: "ada-reset-hash" });
  await createEmailVerificationToken({ user: owner, tokenHash: "ada-verify-hash" });
  await createEmailVerificationToken({
    user: owner,
    tokenHash: "ada-change-hash",
    newEmail: "ada.new@example.test",
    expiresAt: new Date("2026-10-11T10:30:00.000Z"),
    createdAt: new Date("2026-10-11T09:00:00.000Z"),
  });
  await createEmailVerificationToken({
    user: owner,
    tokenHash: "ada-older-change-hash",
    newEmail: "ada.older@example.test",
    expiresAt: new Date("2026-10-11T10:00:00.000Z"),
    createdAt: new Date("2026-10-11T08:00:00.000Z"),
  });
  await createEmailVerificationToken({
    user: owner,
    tokenHash: "ada-expired-change-hash",
    newEmail: "ada.expired@example.test",
    expiresAt: new Date("2026-10-11T09:00:00.000Z"),
    createdAt: new Date("2026-10-11T09:20:00.000Z"),
  });
  await createEmailVerificationToken({
    user: owner,
    tokenHash: "ada-used-change-hash",
    newEmail: "ada.used@example.test",
    expiresAt: new Date("2026-10-11T11:00:00.000Z"),
    createdAt: new Date("2026-10-11T09:10:00.000Z"),
    usedAt: new Date("2026-10-11T09:15:00.000Z"),
  });

  // Created newest first, so "oldest first" is proven by the query's order,
  // not by insertion order.
  await createFavorite({
    user: owner,
    listingId: "wallapop-ada-gone",
    createdAt: new Date("2026-09-04T10:00:00.000Z"),
    deletedAt: new Date("2026-09-07T10:00:00.000Z"),
  });
  await createFavorite({
    user: owner,
    listingId: "cochesnet-ada-2",
    createdAt: new Date("2026-09-06T10:00:00.000Z"),
  });
  await createFavorite({
    user: owner,
    listingId: "wallapop-ada-1",
    createdAt: new Date("2026-09-05T10:00:00.000Z"),
  });

  const removedAlert = await createAlert({
    user: owner,
    criteria: { connect: { id: (await createAlertCriteria()).id } },
    label: "Ada removed alert",
    createdAt: new Date("2026-09-12T10:00:00.000Z"),
    deletedAt: new Date("2026-09-12T10:00:00.000Z"),
  });
  await createAlert({
    user: owner,
    criteria: { connect: { id: (await createAlertCriteria()).id } },
    label: "Ada paused alert",
    active: false,
    createdAt: new Date("2026-09-11T10:00:00.000Z"),
  });
  const golfAlert = await createAlert({
    user: owner,
    criteria: {
      connect: {
        id: (
          await createAlertCriteria({
            criteria: { brand: "volkswagen", model: "golf", maxPrice: 15000 },
          })
        ).id,
      },
    },
    label: "Ada Golf alert",
    // ALERTUI-46 (redesign-alerts.md): the place name stored on the alert.
    placeName: "Valencia",
    active: true,
    unsubscribeTokenHash: "ada-unsub-hash",
    unsubscribeSubject: "ada-unsub-subject",
    createdAt: new Date("2026-09-10T10:00:00.000Z"),
  });

  await createAlertMatch({
    alert: { connect: { id: golfAlert.id } },
    listingId: "cochesnet-ada-match",
    notifiedAt: new Date("2026-10-09T08:00:00.000Z"),
  });
  await createAlertMatch({
    alert: { connect: { id: removedAlert.id } },
    listingId: "wallapop-ada-removed-match",
  });

  return ada;
}

async function seedBob() {
  const bob = await createUser({ email: "bob@example.test" });
  const owner = { connect: { id: bob.id } };

  await prisma.session.create({
    data: {
      userId: bob.id,
      sessionToken: "bob-session-token",
      expires: new Date("2026-11-10T00:00:00.000Z"),
      ipAddress: "198.51.100.4",
    },
  });
  await createFavorite({ user: owner, listingId: "wallapop-bob-1" });
  const bobAlert = await createAlert({
    user: owner,
    criteria: { connect: { id: (await createAlertCriteria()).id } },
    label: "Bob alert",
  });
  await createAlertMatch({
    alert: { connect: { id: bobAlert.id } },
    listingId: "wallapop-bob-match",
  });
  await createEmailVerificationToken({
    user: owner,
    newEmail: "bob.new@example.test",
    expiresAt: new Date("2026-10-11T11:30:00.000Z"),
    createdAt: new Date("2026-10-11T09:25:00.000Z"),
  });

  return bob;
}

/** Seeds both users and signs in as Ada. */
async function signedInAsAda() {
  const ada = await seedAda();
  await seedBob();
  vi.mocked(getCurrentUser).mockResolvedValue({ id: ada.id, email: ada.email });
  return ada;
}

/** Calls the action and returns both the raw JSON string and its parse. */
async function exportAsCaller() {
  const result = await exportMyData();
  expect(result.success).toBe(true);
  expect(typeof result.data).toBe("string");
  const json = result.data ?? "";
  return { json, data: JSON.parse(json) };
}

describe("exportMyData", () => {
  beforeEach(() => {
    // Only Date is faked: Prisma and the pg driver keep their real timers.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(EXPORT_NOW);
    vi.mocked(findMyDataExport).mockClear();
    vi.mocked(consumeRateLimit).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("EXPORT-1: returns a JSON string with exactly the top-level keys and the export time", async () => {
    await signedInAsAda();

    const { data } = await exportAsCaller();

    expect(Object.keys(data)).toEqual([
      "exportedAt",
      "profile",
      "pendingEmailChange",
      "signInMethods",
      "sessions",
      "favorites",
      "alerts",
      "alertMatches",
    ]);
    expect(data.exportedAt).toBe("2026-10-11T09:30:00.000Z");
  });

  it("EXPORT-2: the profile holds exactly the caller's fields, with null for an empty one", async () => {
    await signedInAsAda();

    const { data } = await exportAsCaller();

    expect(Object.keys(data.profile)).toEqual([
      "email",
      "name",
      "image",
      "locale",
      "emailConfirmed",
      "twoFactorEnabled",
      "twoFactorEnabledAt",
      "createdAt",
    ]);
    expect(data.profile).toEqual({
      email: "ada@example.test",
      name: "Ada Lovelace",
      image: null,
      locale: "en",
      emailConfirmed: true,
      twoFactorEnabled: true,
      twoFactorEnabledAt: "2026-09-03T10:00:00.000Z",
      createdAt: "2026-09-01T10:00:00.000Z",
    });
  });

  it("EXPORT-3: reports the password as a flag and lists linked providers, never the credential row", async () => {
    await signedInAsAda();

    const { data } = await exportAsCaller();

    expect(data.signInMethods).toEqual({
      password: true,
      providers: [{ provider: "google", linkedAt: "2026-09-02T10:00:00.000Z" }],
    });
  });

  it("EXPORT-4: lists every session as exactly createdAt, expiresAt, ipAddress and userAgent", async () => {
    await signedInAsAda();

    const { data } = await exportAsCaller();

    expect(data.sessions).toEqual([
      {
        createdAt: "2026-10-10T00:00:00.000Z",
        expiresAt: "2026-11-10T00:00:00.000Z",
        ipAddress: "203.0.113.7",
        userAgent: ADA_USER_AGENT,
      },
    ]);
    expect(Object.keys(data.sessions[0])).toEqual([
      "createdAt",
      "expiresAt",
      "ipAddress",
      "userAgent",
    ]);
  });

  it("EXPORT-5: lists live favorites with their snapshot, oldest first, and leaves soft-deleted ones out", async () => {
    await signedInAsAda();

    const { data } = await exportAsCaller();

    expect(data.favorites.map((f: { listingId: string }) => f.listingId)).toEqual([
      "wallapop-ada-1",
      "cochesnet-ada-2",
    ]);
    for (const favorite of data.favorites) {
      expect(Object.keys(favorite)).toEqual(SNAPSHOT_KEYS);
    }
    expect(data.favorites[0].createdAt).toBe("2026-09-05T10:00:00.000Z");
    expect(data.favorites[1].createdAt).toBe("2026-09-06T10:00:00.000Z");
  });

  it("EXPORT-6: lists alerts with their stored criteria and place name, oldest first, keeping inactive and dropping soft-deleted ones", async () => {
    await signedInAsAda();

    const { data } = await exportAsCaller();

    expect(data.alerts.map((a: { label: string }) => a.label)).toEqual([
      "Ada Golf alert",
      "Ada paused alert",
    ]);
    // Amended 2026-10-15 (EXPORT-6, ALERTUI-46 — redesign-alerts.md): each
    // alert also carries its place name, null when it has none.
    expect(data.alerts[0]).toEqual({
      label: "Ada Golf alert",
      placeName: "Valencia",
      criteria: { brand: "volkswagen", model: "golf", maxPrice: 15000 },
      active: true,
      createdAt: "2026-09-10T10:00:00.000Z",
    });
    expect(Object.keys(data.alerts[0])).toEqual([
      "label",
      "placeName",
      "criteria",
      "active",
      "createdAt",
    ]);
    expect(data.alerts[1].active).toBe(false);
    expect(data.alerts[1].placeName).toBeNull();
  });

  it("EXPORT-7: lists the matches of exported alerts with their alert's label, and none of a soft-deleted alert", async () => {
    await signedInAsAda();

    const { data } = await exportAsCaller();

    expect(data.alertMatches.map((m: { listingId: string }) => m.listingId)).toEqual([
      "cochesnet-ada-match",
    ]);
    expect(data.alertMatches[0].alertLabel).toBe("Ada Golf alert");
    expect(data.alertMatches[0].notifiedAt).toBe("2026-10-09T08:00:00.000Z");
    expect(Object.keys(data.alertMatches[0])).toEqual([
      "alertLabel",
      ...SNAPSHOT_KEYS,
      "notifiedAt",
    ]);
  });

  it("EXPORT-8: no secret value appears anywhere in the export", async () => {
    await signedInAsAda();

    const { json } = await exportAsCaller();

    for (const secret of [
      "hashed:ada-secret",
      "google-ada-123",
      "ada-access-token",
      "ada-refresh-token",
      "ada-id-token",
      "ada-session-token",
      "ada-totp-secret",
      "ada-backup-codes",
      "ada-unsub-hash",
      "ada-unsub-subject",
      "ada-reset-hash",
      "ada-verify-hash",
      "ada-change-hash",
    ]) {
      expect(json).not.toContain(secret);
    }
  });

  it("EXPORT-9: no row of another user, and no soft-deleted row, appears in the caller's export", async () => {
    await signedInAsAda();

    const { json } = await exportAsCaller();

    for (const foreign of [
      "bob@example.test",
      "198.51.100.4",
      "wallapop-bob-1",
      "Bob alert",
      "wallapop-bob-match",
      "bob.new@example.test",
      "wallapop-ada-gone",
      "Ada removed alert",
      "wallapop-ada-removed-match",
    ]) {
      expect(json).not.toContain(foreign);
    }
  });

  it("EXPORT-10: a caller with nothing saved still gets every key, with empty arrays", async () => {
    const grace = await createUser({ email: "grace@example.test", password: null });
    await prisma.account.create({
      data: {
        userId: grace.id,
        type: "oauth",
        provider: "github",
        providerAccountId: "github-grace-1",
        createdAt: new Date("2026-09-20T10:00:00.000Z"),
      },
    });
    await seedBob();
    vi.mocked(getCurrentUser).mockResolvedValue({ id: grace.id, email: grace.email });

    const { data } = await exportAsCaller();

    expect(data.signInMethods).toEqual({
      password: false,
      providers: [{ provider: "github", linkedAt: "2026-09-20T10:00:00.000Z" }],
    });
    expect(data.favorites).toEqual([]);
    expect(data.alerts).toEqual([]);
    expect(data.alertMatches).toEqual([]);
    expect(data.pendingEmailChange).toBeNull();

    const credentialOnly = await createUser({ email: "linus@example.test" });
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: credentialOnly.id,
      email: credentialOnly.email,
    });

    const second = await exportAsCaller();
    expect(second.data.signInMethods).toEqual({ password: true, providers: [] });
  });

  it("EXPORT-11: refuses a caller with no session without reading data or spending budget", async () => {
    await seedAda();
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    expect(await exportMyData()).toEqual({ success: false, error: "unauthorized" });
    expect(consumeRateLimit).not.toHaveBeenCalled();
    expect(findMyDataExport).not.toHaveBeenCalled();
  });

  it("EXPORT-12: refuses a caller whose per-user budget is spent, keyed on their user id", async () => {
    const ada = await signedInAsAda();
    vi.mocked(consumeRateLimit).mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfterMs: 60_000,
    });

    expect(await exportMyData()).toEqual({ success: false, error: "rateLimited" });
    expect(consumeRateLimit).toHaveBeenCalledWith(`export-data:user:${ada.id}`, {
      name: "exportDataPerUser",
      limit: 5,
      windowMs: 3_600_000,
    });
    expect(findMyDataExport).not.toHaveBeenCalled();
  });

  it("EXPORT-13: a failed database read returns generic and no partial export", async () => {
    await signedInAsAda();
    vi.mocked(findMyDataExport).mockRejectedValueOnce(new Error("connection terminated"));

    const result = await exportMyData();

    expect(result).toEqual({ success: false, error: "generic" });
    expect(result).not.toHaveProperty("data");
  });

  it("EXPORT-19: exports only the newest unused, unexpired pending email change, or null", async () => {
    const ada = await signedInAsAda();

    const { json, data } = await exportAsCaller();

    expect(data.pendingEmailChange).toEqual({
      newEmail: "ada.new@example.test",
      expiresAt: "2026-10-11T10:30:00.000Z",
    });
    for (const other of [
      "ada.older@example.test",
      "ada.expired@example.test",
      "ada.used@example.test",
      "ada-change-hash",
    ]) {
      expect(json).not.toContain(other);
    }

    // With the two live changes gone, only the expired and used rows remain.
    await prisma.emailVerificationToken.deleteMany({
      where: { userId: ada.id, tokenHash: { in: ["ada-change-hash", "ada-older-change-hash"] } },
    });

    const after = await exportAsCaller();
    expect(after.data.pendingEmailChange).toBeNull();
  });
});
