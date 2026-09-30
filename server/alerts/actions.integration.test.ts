import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createUser } from "@/test/factories/user";
import { makeCriteria, makeMatchListing } from "@/test/fixtures/alerts";

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/email/client", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("@/lib/i18n/server", () => ({ getLocale: vi.fn(async () => "en") }));

// The seed poll (ALERT-2) is the only network this module does. Stubbed at the
// server-side search seam rather than at fetch, so the action's own behaviour —
// what it stores, and that it stays silent — is what the tests exercise.
vi.mock("@/server/alerts/search", () => ({ searchAllSources: vi.fn() }));

import { getCurrentUser } from "@/lib/auth/session";
import { sendEmail } from "@/lib/email/client";
import { getLocale } from "@/lib/i18n/server";
import { searchAllSources } from "@/server/alerts/search";
import { createAlert, deleteAlert } from "./actions";

let ADA: { id: string; email: string };
let GRACE: { id: string; email: string };

function signedInAs(user: { id: string; email: string }) {
  vi.mocked(getCurrentUser).mockResolvedValue(user);
}

function signedOut() {
  vi.mocked(getCurrentUser).mockResolvedValue(null);
}

/** What the three sources return for the seed poll, all sources healthy. */
function sourcesReturn(...listings: ReturnType<typeof makeMatchListing>[]) {
  const perSourceCounts: Record<string, number> = {};
  for (const listing of listings) {
    perSourceCounts[listing.source] = (perSourceCounts[listing.source] ?? 0) + 1;
  }

  vi.mocked(searchAllSources).mockResolvedValue({
    listings,
    failedSources: [],
    perSourceCounts,
  });
}

async function alertsFor(userId: string) {
  return prisma.alert.findMany({ where: { userId } });
}

async function seenFor(criteriaId: string) {
  return prisma.alertSeenListing.findMany({ where: { criteriaId } });
}

beforeEach(async () => {
  ADA = await createUser({ email: "ada@example.com", locale: "en" });
  GRACE = await createUser({ email: "grace@example.com", locale: "en" });
  vi.mocked(getCurrentUser).mockReset();
  vi.mocked(sendEmail).mockClear();
  vi.mocked(searchAllSources).mockClear();
  vi.mocked(getLocale).mockResolvedValue("en");
  sourcesReturn();
});

describe("createAlert", () => {
  it("ALERT-1: records an alert against the signed-in user", async () => {
    signedInAs(ADA);

    const result = await createAlert(makeCriteria(), "Audi A3 under 20k");

    expect(result).toEqual({ ok: true, value: undefined });
    const stored = await alertsFor(ADA.id);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ userId: ADA.id, label: "Audi A3 under 20k", active: true });
  });

  it("ALERT-2: records everything already listed as seen", async () => {
    signedInAs(ADA);
    sourcesReturn(
      makeMatchListing({ id: "wallapop-abc123" }),
      makeMatchListing({ id: "cochesnet-99", source: "Coches.net" }),
    );

    await createAlert(makeCriteria(), "Audi A3 under 20k");

    const [criteria] = await prisma.alertCriteria.findMany();
    expect((await seenFor(criteria.id)).map((row) => row.listingId).sort()).toEqual([
      "cochesnet-99",
      "wallapop-abc123",
    ]);
  });

  it("ALERT-2: emails nobody about what was already there", async () => {
    signedInAs(ADA);
    sourcesReturn(makeMatchListing({ id: "wallapop-abc123" }));

    await createAlert(makeCriteria(), "Audi A3 under 20k");

    // The whole point of seeding: creating an alert must not blast the user
    // with every car currently listed.
    expect(sendEmail).not.toHaveBeenCalled();
    expect(await prisma.alertMatch.count()).toBe(0);
  });

  it("ALERT-3: two users saving identical criteria share one criteria record", async () => {
    signedInAs(ADA);
    await createAlert(makeCriteria(), "Ada's search");
    signedInAs(GRACE);
    await createAlert(makeCriteria(), "Grace's search");

    // One question, polled once — the property the upstream budget depends on.
    const criteria = await prisma.alertCriteria.findMany();
    expect(criteria).toHaveLength(1);
    const alerts = await prisma.alert.findMany();
    expect(alerts).toHaveLength(2);
    expect(alerts.every((alert) => alert.criteriaId === criteria[0].id)).toBe(true);
  });

  it("ALERT-3: criteria differing only in key order still share a record", async () => {
    signedInAs(ADA);
    await createAlert({ brand: "Audi", maxPrice: 20000 }, "Ada's search");
    signedInAs(GRACE);
    await createAlert({ maxPrice: 20000, brand: "Audi" }, "Grace's search");

    // Canonicalisation before hashing is what makes the dedup real rather than
    // dependent on how the object happened to be built.
    expect(await prisma.alertCriteria.count()).toBe(1);
  });

  it("ALERT-4: a caller with no session creates nothing (PLAT-11)", async () => {
    signedOut();

    const result = await createAlert(makeCriteria(), "Audi A3 under 20k");

    expect(result).toEqual({
      ok: false,
      error: { code: "unauthenticated", messageKey: "alertErrors.unauthenticated" },
    });
    expect(await prisma.alert.count()).toBe(0);
    expect(await prisma.alertCriteria.count()).toBe(0);
  });

  it("ALERT-6: rejects criteria that fail the search schema (PLAT-11)", async () => {
    signedInAs(ADA);

    const result = await createAlert(makeCriteria({ maxPrice: -5 }), "Nonsense");

    expect(result).toEqual({
      ok: false,
      error: { code: "invalidCriteria", messageKey: "alertErrors.invalidCriteria" },
    });
    expect(await prisma.alert.count()).toBe(0);
  });

  it("ALERT-6: rejects an unknown timeFilter value", async () => {
    signedInAs(ADA);

    const result = await createAlert(
      { ...makeCriteria(), timeFilter: "lastYear" } as never,
      "Nonsense",
    );

    expect(result).toEqual({
      ok: false,
      error: { code: "invalidCriteria", messageKey: "alertErrors.invalidCriteria" },
    });
    expect(await prisma.alert.count()).toBe(0);
  });

  it("ALERT-7: saving criteria the user already has leaves one alert", async () => {
    signedInAs(ADA);

    const first = await createAlert(makeCriteria(), "Audi A3 under 20k");
    const second = await createAlert(makeCriteria(), "Audi A3 under 20k");

    expect(first).toEqual({ ok: true, value: undefined });
    expect(second).toEqual({ ok: true, value: undefined });
    expect(await alertsFor(ADA.id)).toHaveLength(1);
  });

  it("ALERT-8: refuses to create the twenty-first alert (PLAT-11)", async () => {
    signedInAs(ADA);
    for (let n = 0; n < 20; n++) {
      await createAlert(makeCriteria({ maxPrice: 20000 + n }), `Alert ${n}`);
    }

    const result = await createAlert(makeCriteria({ maxPrice: 99000 }), "One too many");

    expect(result).toEqual({
      ok: false,
      error: { code: "tooManyAlerts", messageKey: "alertErrors.tooManyAlerts" },
    });
    expect(await alertsFor(ADA.id)).toHaveLength(20);
  });

  it("ALERT-8: the cap is per user, not global", async () => {
    signedInAs(ADA);
    for (let n = 0; n < 20; n++) {
      await createAlert(makeCriteria({ maxPrice: 20000 + n }), `Alert ${n}`);
    }
    signedInAs(GRACE);

    const result = await createAlert(makeCriteria(), "Grace's first");

    expect(result).toEqual({ ok: true, value: undefined });
    expect(await alertsFor(GRACE.id)).toHaveLength(1);
  });

  it("ALERT-38: rejects criteria with no brand, no price ceiling and no location (PLAT-11)", async () => {
    signedInAs(ADA);

    const result = await createAlert({ minYear: 2010 }, "Every car in Spain");

    expect(result).toEqual({
      ok: false,
      error: { code: "criteriaTooBroad", messageKey: "alertErrors.criteriaTooBroad" },
    });
    expect(await prisma.alert.count()).toBe(0);
    // Nothing was polled either — the rejection has to happen before the seed.
    expect(searchAllSources).not.toHaveBeenCalled();
  });

  it.each([
    ["a brand", { brand: "Audi" }],
    ["a maximum price", { maxPrice: 20000 }],
    ["a location", { latitude: 40.4168, longitude: -3.7038 }],
  ])("ALERT-38: %s alone is specific enough", async (_label, criteria) => {
    signedInAs(ADA);

    const result = await createAlert(criteria, "Narrow enough");

    expect(result).toEqual({ ok: true, value: undefined });
  });

  it("ALERT-34: stores the request's locale when the account has none", async () => {
    const userWithNoLocale = await createUser({ email: "no-locale@example.com", locale: null });
    signedInAs(userWithNoLocale);
    vi.mocked(getLocale).mockResolvedValue("en");

    await createAlert(makeCriteria(), "Audi A3 under 20k");

    const found = await prisma.user.findUnique({ where: { id: userWithNoLocale.id } });
    expect(found?.locale).toBe("en");
  });

  it("ALERT-34: does not overwrite a locale the user already chose", async () => {
    const spanishUser = await createUser({ email: "es-locale@example.com", locale: "es" });
    signedInAs(spanishUser);
    // The request resolves to English, but the account says Spanish — an
    // explicit choice must outrank an inferred one.
    vi.mocked(getLocale).mockResolvedValue("en");

    await createAlert(makeCriteria(), "Audi A3 under 20k");

    const found = await prisma.user.findUnique({ where: { id: spanishUser.id } });
    expect(found?.locale).toBe("es");
  });
});

describe("deleteAlert", () => {
  it("ALERT-4: a caller with no session deletes nothing (PLAT-11)", async () => {
    signedInAs(ADA);
    await createAlert(makeCriteria(), "Audi A3 under 20k");
    const [alert] = await alertsFor(ADA.id);
    signedOut();

    const result = await deleteAlert(alert.id);

    expect(result).toEqual({
      ok: false,
      error: { code: "unauthenticated", messageKey: "alertErrors.unauthenticated" },
    });
    expect(await alertsFor(ADA.id)).toHaveLength(1);
  });

  it("ALERT-5 / TEST-8: one user cannot delete another user's alert", async () => {
    signedInAs(ADA);
    await createAlert(makeCriteria(), "Ada's search");
    const [adasAlert] = await alertsFor(ADA.id);
    signedInAs(GRACE);

    const result = await deleteAlert(adasAlert.id);

    // Grace learns nothing about whether that alert exists, and Ada keeps hers.
    expect(result).toEqual({ ok: true, value: undefined });
    const stillThere = await prisma.alert.findUnique({ where: { id: adasAlert.id } });
    expect(stillThere).not.toBeNull();
    expect(await alertsFor(ADA.id)).toHaveLength(1);
  });

  it("ALERT-42: deleting the last alert for a criteria set deletes the criteria and its seen-list", async () => {
    signedInAs(ADA);
    sourcesReturn(makeMatchListing({ id: "wallapop-abc123" }));
    await createAlert(makeCriteria(), "Audi A3 under 20k");
    const [alert] = await alertsFor(ADA.id);
    const [criteria] = await prisma.alertCriteria.findMany();
    expect(await seenFor(criteria.id)).toHaveLength(1);

    await deleteAlert(alert.id);

    expect(await prisma.alertCriteria.count()).toBe(0);
    expect(await prisma.alertSeenListing.count()).toBe(0);
  });

  it("ALERT-42: a criteria set another user still subscribes to survives", async () => {
    signedInAs(ADA);
    await createAlert(makeCriteria(), "Ada's search");
    signedInAs(GRACE);
    await createAlert(makeCriteria(), "Grace's search");
    const [adasAlert] = await alertsFor(ADA.id);
    signedInAs(ADA);

    await deleteAlert(adasAlert.id);

    expect(await prisma.alertCriteria.count()).toBe(1);
    expect(await alertsFor(GRACE.id)).toHaveLength(1);
  });
});
