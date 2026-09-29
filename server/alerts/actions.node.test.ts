import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAlertStore, makeCriteria, makeMatchListing } from "@/test/fixtures/alerts";

let store: ReturnType<typeof createAlertStore>;

vi.mock("@/lib/db/prisma", () => ({
  get prisma() {
    return store.client;
  },
}));

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
import { createAlert, deleteAlert, listAlerts } from "./actions";

const ADA = { id: "user-ada", email: "ada@example.com" };
const GRACE = { id: "user-grace", email: "grace@example.com" };

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

beforeEach(() => {
  store = createAlertStore();
  store.seedUser({ id: ADA.id, email: ADA.email, locale: "en" });
  store.seedUser({ id: GRACE.id, email: GRACE.email, locale: "en" });
  vi.mocked(getCurrentUser).mockReset();
  vi.mocked(sendEmail).mockClear();
  // Call history too, not just the resolved value: ALERT-38 asserts the seed
  // poll never ran, which earlier tests in this file would otherwise satisfy.
  vi.mocked(searchAllSources).mockClear();
  vi.mocked(getLocale).mockResolvedValue("en");
  sourcesReturn();
});

describe("createAlert", () => {
  it("ALERT-1: records an alert against the signed-in user", async () => {
    signedInAs(ADA);

    const result = await createAlert(makeCriteria(), "Audi A3 under 20k");

    expect(result.success).toBe(true);
    const stored = store.alertsFor(ADA.id);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      userId: ADA.id,
      label: "Audi A3 under 20k",
      active: true,
    });
  });

  it("ALERT-1: the alert is readable on a later request", async () => {
    signedInAs(ADA);
    await createAlert(makeCriteria(), "Audi A3 under 20k");

    const result = await listAlerts();

    expect(result.data?.map((row: { label: string }) => row.label)).toEqual(["Audi A3 under 20k"]);
  });

  it("ALERT-2: records everything already listed as seen", async () => {
    signedInAs(ADA);
    sourcesReturn(
      makeMatchListing({ id: "wallapop-abc123" }),
      makeMatchListing({ id: "cochesnet-99", source: "Coches.net" }),
    );

    await createAlert(makeCriteria(), "Audi A3 under 20k");

    const criteriaId = store.criteria()[0].id;
    expect(
      store
        .seenFor(criteriaId)
        .map((row) => row.listingId)
        .sort(),
    ).toEqual(["cochesnet-99", "wallapop-abc123"]);
  });

  it("ALERT-2: emails nobody about what was already there", async () => {
    signedInAs(ADA);
    sourcesReturn(makeMatchListing({ id: "wallapop-abc123" }));

    await createAlert(makeCriteria(), "Audi A3 under 20k");

    // The whole point of seeding: creating an alert must not blast the user
    // with every car currently listed.
    expect(sendEmail).not.toHaveBeenCalled();
    expect(store.matches()).toEqual([]);
  });

  it("ALERT-3: two users saving identical criteria share one criteria record", async () => {
    signedInAs(ADA);
    await createAlert(makeCriteria(), "Ada's search");
    signedInAs(GRACE);
    await createAlert(makeCriteria(), "Grace's search");

    // One question, polled once — the property the upstream budget depends on.
    expect(store.criteria()).toHaveLength(1);
    expect(store.alerts()).toHaveLength(2);
    const [criteria] = store.criteria();
    expect(store.alerts().every((alert) => alert.criteriaId === criteria.id)).toBe(true);
  });

  it("ALERT-3: criteria differing only in key order still share a record", async () => {
    signedInAs(ADA);
    await createAlert({ brand: "Audi", maxPrice: 20000 }, "Ada's search");
    signedInAs(GRACE);
    await createAlert({ maxPrice: 20000, brand: "Audi" }, "Grace's search");

    // Canonicalisation before hashing is what makes the dedup real rather than
    // dependent on how the object happened to be built.
    expect(store.criteria()).toHaveLength(1);
  });

  it("ALERT-4: a caller with no session creates nothing", async () => {
    signedOut();

    const result = await createAlert(makeCriteria(), "Audi A3 under 20k");

    expect(result).toEqual({ success: false, error: "unauthenticated" });
    expect(store.alerts()).toEqual([]);
    expect(store.criteria()).toEqual([]);
  });

  it("ALERT-6: rejects criteria that fail the search schema", async () => {
    signedInAs(ADA);

    const result = await createAlert(makeCriteria({ maxPrice: -5 }), "Nonsense");

    expect(result).toEqual({ success: false, error: "invalidCriteria" });
    expect(store.alerts()).toEqual([]);
  });

  it("ALERT-6: rejects an unknown timeFilter value", async () => {
    signedInAs(ADA);

    const result = await createAlert(
      { ...makeCriteria(), timeFilter: "lastYear" } as never,
      "Nonsense",
    );

    expect(result).toEqual({ success: false, error: "invalidCriteria" });
    expect(store.alerts()).toEqual([]);
  });

  it("ALERT-7: saving criteria the user already has leaves one alert", async () => {
    signedInAs(ADA);

    const first = await createAlert(makeCriteria(), "Audi A3 under 20k");
    const second = await createAlert(makeCriteria(), "Audi A3 under 20k");

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(store.alertsFor(ADA.id)).toHaveLength(1);
  });

  it("ALERT-8: refuses to create the twenty-first alert", async () => {
    signedInAs(ADA);
    // Twenty distinct criteria sets, each a legitimate alert.
    for (let n = 0; n < 20; n++) {
      await createAlert(makeCriteria({ maxPrice: 20000 + n }), `Alert ${n}`);
    }

    const result = await createAlert(makeCriteria({ maxPrice: 99000 }), "One too many");

    expect(result).toEqual({ success: false, error: "tooManyAlerts" });
    expect(store.alertsFor(ADA.id)).toHaveLength(20);
  });

  it("ALERT-8: the cap is per user, not global", async () => {
    signedInAs(ADA);
    for (let n = 0; n < 20; n++) {
      await createAlert(makeCriteria({ maxPrice: 20000 + n }), `Alert ${n}`);
    }
    signedInAs(GRACE);

    const result = await createAlert(makeCriteria(), "Grace's first");

    expect(result.success).toBe(true);
    expect(store.alertsFor(GRACE.id)).toHaveLength(1);
  });

  it("ALERT-38: rejects criteria with no brand, no price ceiling and no location", async () => {
    signedInAs(ADA);

    const result = await createAlert({ minYear: 2010 }, "Every car in Spain");

    expect(result).toEqual({ success: false, error: "criteriaTooBroad" });
    expect(store.alerts()).toEqual([]);
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

    expect(result.success).toBe(true);
  });

  it("ALERT-34: stores the request's locale when the account has none", async () => {
    store = createAlertStore();
    store.seedUser({ id: ADA.id, email: ADA.email, locale: null });
    signedInAs(ADA);
    vi.mocked(getLocale).mockResolvedValue("en");

    await createAlert(makeCriteria(), "Audi A3 under 20k");

    expect(store.users()[0].locale).toBe("en");
  });

  it("ALERT-34: does not overwrite a locale the user already chose", async () => {
    store = createAlertStore();
    store.seedUser({ id: ADA.id, email: ADA.email, locale: "es" });
    signedInAs(ADA);
    // The request resolves to English, but the account says Spanish — an
    // explicit choice must outrank an inferred one.
    vi.mocked(getLocale).mockResolvedValue("en");

    await createAlert(makeCriteria(), "Audi A3 under 20k");

    expect(store.users()[0].locale).toBe("es");
  });
});

describe("listAlerts", () => {
  it("ALERT-4: a caller with no session gets nothing back", async () => {
    signedInAs(ADA);
    await createAlert(makeCriteria(), "Audi A3 under 20k");
    signedOut();

    const result = await listAlerts();

    expect(result).toEqual({ success: false, error: "unauthenticated" });
  });

  it("ALERT-1: returns only the caller's own alerts", async () => {
    signedInAs(GRACE);
    await createAlert(makeCriteria({ brand: "BMW" }), "Grace's search");
    signedInAs(ADA);
    await createAlert(makeCriteria(), "Ada's search");

    const result = await listAlerts();

    expect(result.data?.map((row: { label: string }) => row.label)).toEqual(["Ada's search"]);
  });

  it("ALERT-1: an empty list is a success, not an error", async () => {
    signedInAs(ADA);

    const result = await listAlerts();

    expect(result).toEqual({ success: true, data: [] });
  });
});

describe("deleteAlert", () => {
  it("ALERT-4: a caller with no session deletes nothing", async () => {
    signedInAs(ADA);
    await createAlert(makeCriteria(), "Audi A3 under 20k");
    const [alert] = store.alertsFor(ADA.id);
    signedOut();

    const result = await deleteAlert(alert.id);

    expect(result).toEqual({ success: false, error: "unauthenticated" });
    expect(store.alertsFor(ADA.id)).toHaveLength(1);
  });

  it("ALERT-5: one user cannot delete another user's alert", async () => {
    signedInAs(ADA);
    await createAlert(makeCriteria(), "Ada's search");
    const [adasAlert] = store.alertsFor(ADA.id);
    signedInAs(GRACE);

    const result = await deleteAlert(adasAlert.id);

    // Grace learns nothing about whether that alert exists, and Ada keeps hers.
    expect(result.success).toBe(true);
    expect(store.alertsFor(ADA.id)).toHaveLength(1);
  });

  it("ALERT-42: deleting the last alert for a criteria set deletes the criteria and its seen-list", async () => {
    signedInAs(ADA);
    sourcesReturn(makeMatchListing({ id: "wallapop-abc123" }));
    await createAlert(makeCriteria(), "Audi A3 under 20k");
    const [alert] = store.alertsFor(ADA.id);
    const criteriaId = store.criteria()[0].id;
    expect(store.seenFor(criteriaId)).toHaveLength(1);

    await deleteAlert(alert.id);

    expect(store.criteria()).toEqual([]);
    expect(store.seen()).toEqual([]);
  });

  it("ALERT-42: a criteria set another user still subscribes to survives", async () => {
    signedInAs(ADA);
    await createAlert(makeCriteria(), "Ada's search");
    signedInAs(GRACE);
    await createAlert(makeCriteria(), "Grace's search");
    const [adasAlert] = store.alertsFor(ADA.id);
    signedInAs(ADA);

    await deleteAlert(adasAlert.id);

    expect(store.criteria()).toHaveLength(1);
    expect(store.alertsFor(GRACE.id)).toHaveLength(1);
  });

  it("ALERT-42: an inactive alert still holds its criteria set", async () => {
    signedInAs(ADA);
    await createAlert(makeCriteria(), "Audi A3 under 20k");
    const [alert] = store.alertsFor(ADA.id);
    // Unsubscribing deactivates; only deletion releases the criteria, so the
    // matches page still renders and re-enabling loses nothing.
    await store.client.alert.update({
      where: { id: alert.id },
      data: { active: false },
    });

    const result = await listAlerts();

    expect(result.success).toBe(true);
    expect(store.criteria()).toHaveLength(1);
  });
});
