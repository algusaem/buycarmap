import { beforeEach, describe, expect, it, vi } from "vitest";
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

import { getCurrentUser } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/hash";
import { consumeRateLimit } from "@/server/rate-limit/service";
import {
  changePassword,
  deleteAccount,
  listMySessions,
  revokeMySession,
  signOutEverywhere,
  unlinkAccount,
  updateProfile,
} from "./actions";

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
    const found = await prisma.user.findUnique({ where: { id: user.id } });
    expect(found?.password).toBe("old-hash");
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

  it("AUTH-5: bumps passwordChangedAt and clears sessions on success", async () => {
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

    const found = await prisma.user.findUnique({ where: { id: user.id } });
    expect(found?.password).toBe(`hashed:${NEW_PASSWORD}`);
    expect(found?.passwordChangedAt.getTime()).toBeGreaterThan(user.passwordChangedAt.getTime());
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

  it("bumps the revocation clock and clears adapter sessions", async () => {
    const user = await signedInAsNewUser();
    await prisma.session.create({
      data: {
        user: { connect: { id: user.id } },
        sessionToken: "session-token-1",
        expires: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    expect(await signOutEverywhere()).toEqual({ success: true });

    // `passwordChangedAt` is the "sessions valid from" marker: every JWT
    // stamped before it is rejected at the next revalidation.
    const found = await prisma.user.findUnique({ where: { id: user.id } });
    expect(found?.passwordChangedAt.getTime()).toBeGreaterThan(user.passwordChangedAt.getTime());
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
  });

  it("leaves the password untouched", async () => {
    const user = await signedInAsNewUser({ password: "old-hash" });

    await signOutEverywhere();

    const found = await prisma.user.findUnique({ where: { id: user.id } });
    expect(found?.password).toBe("old-hash");
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

    expect(await unlinkAccount(formData({ provider: "github" }))).toEqual({ success: true });
  });

  // Security review BLOCKER (item 1): "credential" is Better Auth's own
  // sign-in plumbing (BAUTH-14's dual-write), not a provider the user chose
  // to connect, and must never be removable from this action.
  it("security review BLOCKER: refuses to unlink the credential row, which survives", async () => {
    const user = await signedInAsNewUser({ password: "hash" });
    const credential = await prisma.account.findFirst({
      where: { userId: user.id, provider: "credential" },
    });
    if (!credential) throw new Error("expected createUser to dual-write a credential account");

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
});
