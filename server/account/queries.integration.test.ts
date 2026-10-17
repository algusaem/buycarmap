import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createUser } from "@/test/factories/user";
import { createFavorite } from "@/test/factories/favorite";
import { createAlert } from "@/test/factories/alert";
import { createAlertCriteria } from "@/test/factories/alert-criteria";

vi.mock("@/lib/auth/session", () => ({ getCurrentUserWithSessionId: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
}));

import { getCurrentUserWithSessionId } from "@/lib/auth/session";
import { asSessionId } from "@/lib/ids";
import { getAccountOverview } from "./queries";

// docs/specs/redesign-pages.md (PAGES-60, worked example "Account query"),
// against real Postgres: the spec's own Contracts › Tests section puts the
// count filtering here, in the integration project, rather than mocked —
// this is the permission-filtered query RULES.md §10 asks to prove (also
// Permissions: "Its integration test proves that Ada's page counts none of
// Grace's rows"). getAccountOverview hands the client `hasPassword` rather
// than the password hash, the providers other than `credential`, and the
// sessions with their id, user agent and last use only.

/** Signed in as `user`, through `sessionId` (by default one no listed session has). */
function signedInAs(user: { id: string; email: string }, sessionId: string = randomUUID()) {
  vi.mocked(getCurrentUserWithSessionId).mockResolvedValue({
    user,
    sessionId: asSessionId(sessionId),
  });
}

async function seedSession(
  userId: string,
  userAgent: string | null,
  updatedAt: Date,
  expires = new Date("2099-01-01T00:00:00.000Z"),
) {
  return prisma.session.create({
    data: { sessionToken: randomUUID(), userId, expires, userAgent, updatedAt },
  });
}

/** Links Google to `userId`, as Better Auth's OAuth callback writes it. */
async function linkGoogle(userId: string) {
  await prisma.account.create({
    data: { userId, provider: "google", providerAccountId: `google-${userId}`, type: "oauth" },
  });
}

let ADA: { id: string; email: string; createdAt: Date };
let GRACE: { id: string; email: string };

beforeEach(async () => {
  ADA = await createUser({ email: "ada@example.com", name: "Ada Lovelace" });
  GRACE = await createUser({ email: "grace@example.com" });
  vi.mocked(getCurrentUserWithSessionId).mockReset();
});

describe("PAGES-60: the /account page query (worked example «Account query»)", () => {
  it("PAGES-60: Ada's page counts her 8 kept favorites and 3 kept alerts, leaving out 1 soft-deleted favorite and 1 soft-deleted alert, while Grace holds her own 2 and 5", async () => {
    // Alert has a real unique constraint on (user_id, criteria_id)
    // (prisma/schema.prisma), so each of a user's alerts needs its own
    // AlertCriteria row — sharing one across several alerts for the same
    // user, as a first draft of this test did, fails for real against
    // Postgres, not only against the (still missing) PAGES-60 behaviour.
    for (let i = 0; i < 8; i++) await createFavorite({ user: { connect: { id: ADA.id } } });
    await createFavorite({ user: { connect: { id: ADA.id } }, deletedAt: new Date() });
    for (let i = 0; i < 3; i++) {
      const criteria = await createAlertCriteria();
      await createAlert({
        user: { connect: { id: ADA.id } },
        criteria: { connect: { id: criteria.id } },
      });
    }
    const adaDeletedCriteria = await createAlertCriteria();
    await createAlert({
      user: { connect: { id: ADA.id } },
      criteria: { connect: { id: adaDeletedCriteria.id } },
      deletedAt: new Date(),
    });

    for (let i = 0; i < 2; i++) await createFavorite({ user: { connect: { id: GRACE.id } } });
    for (let i = 0; i < 5; i++) {
      const criteria = await createAlertCriteria();
      await createAlert({
        user: { connect: { id: GRACE.id } },
        criteria: { connect: { id: criteria.id } },
      });
    }

    signedInAs(ADA);
    const ada = await getAccountOverview();
    signedInAs(GRACE);
    const grace = await getAccountOverview();

    expect(ada.favoritesCount).toBe(8);
    expect(ada.alertsCount).toBe(3);
    expect(grace.favoritesCount).toBe(2);
    expect(grace.alertsCount).toBe(5);
  });

  it("PAGES-60: Ada's page reads only her own 2 sessions, newest-used first, with no token field, while Grace holds her own 1", async () => {
    // Seeded oldest first, so insertion order alone cannot pass.
    await seedSession(ADA.id, "Safari/604 iPhone", new Date("2026-10-14T10:00:00.000Z"));
    const adaLaptop = await seedSession(
      ADA.id,
      "Chrome/120 Windows",
      new Date("2026-10-16T10:00:00.000Z"),
    );
    await seedSession(GRACE.id, "Firefox/121", new Date("2026-10-15T10:00:00.000Z"));

    signedInAs(ADA, adaLaptop.id);
    const ada = await getAccountOverview();
    signedInAs(GRACE);
    const grace = await getAccountOverview();

    expect(ada.sessions.map((session) => session.userAgent)).toEqual([
      "Chrome/120 Windows",
      "Safari/604 iPhone",
    ]);
    // PAGES-35: the session behind the request is marked, from the same lookup.
    expect(ada.sessions.map((session) => session.current)).toEqual([true, false]);
    expect(grace.sessions).toHaveLength(1);
    for (const session of [...ada.sessions, ...grace.sessions]) {
      // The id, the user agent and the last use, and whether it is this
      // request's: no token, no IP.
      expect(Object.keys(session).sort()).toEqual(["current", "id", "lastUsedAt", "userAgent"]);
    }
  });

  it("PAGES-60: an expired session is neither counted nor listed (decided 2026-10-16, owner)", async () => {
    await seedSession(ADA.id, "Chrome/120 Windows", new Date("2026-10-16T10:00:00.000Z"));
    await seedSession(
      ADA.id,
      "Safari/604 iPhone",
      new Date("2026-10-01T10:00:00.000Z"),
      new Date("2026-10-08T10:00:00.000Z"),
    );
    signedInAs(ADA);

    const ada = await getAccountOverview();

    expect(ada.sessions.map((session) => session.userAgent)).toEqual(["Chrome/120 Windows"]);
  });

  it("PAGES-60: Ada's page reads her own name, email and createdAt", async () => {
    signedInAs(ADA);

    const ada = await getAccountOverview();

    expect(ada.name).toBe("Ada Lovelace");
    expect(ada.email).toBe("ada@example.com");
    expect(ada.createdAt).toEqual(ADA.createdAt);
  });

  it("PAGES-60: a Google-only account reads hasPassword false and providers ['google']", async () => {
    const google = await createUser({ email: "google-only@example.com", password: null });
    await linkGoogle(google.id);
    signedInAs(google);

    const record = await getAccountOverview();

    expect(record.hasPassword).toBe(false);
    expect(record.providers).toEqual(["google"]);
  });

  it("PAGES-60: a password account with Google linked lists ['google'], never the credential row", async () => {
    await linkGoogle(ADA.id);
    signedInAs(ADA);

    const record = await getAccountOverview();

    expect(record.hasPassword).toBe(true);
    expect(record.providers).toEqual(["google"]);
  });

  it("PAGES-60: never returns the password hash, only whether the account has one", async () => {
    signedInAs(ADA);

    const record = await getAccountOverview();

    expect(record).not.toHaveProperty("password");
    expect(typeof record.hasPassword).toBe("boolean");
    expect(record.hasPassword).toBe(true);
  });

  it("PAGES-60: signed out, redirects to /login?callbackUrl=/account before any read", async () => {
    vi.mocked(getCurrentUserWithSessionId).mockResolvedValue(null);

    await expect(getAccountOverview()).rejects.toThrow("NEXT_REDIRECT /login?callbackUrl=/account");
  });
});
