import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAlertStore, makeCriteria } from "@/test/fixtures/alerts";

let store: ReturnType<typeof createAlertStore>;

vi.mock("@/lib/db/prisma", () => ({
  get prisma() {
    return store.client;
  },
}));

vi.mock("@/lib/email/client", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("@/lib/i18n/server", () => ({ getLocale: vi.fn(async () => "en") }));

// The seed poll (ALERT-2) is the only network createAlertForUser does. Stubbed
// at the server-side search seam, as server/alerts/actions.node.test.ts does.
vi.mock("@/server/alerts/search", () => ({
  searchAllSources: vi.fn(async () => ({ listings: [], failedSources: [], perSourceCounts: {} })),
}));

import { createAlertForUser, findAlertSummaries, findAlertWithMatches } from "./service";

const ADA = { id: "user-ada", email: "ada@example.com" };
const GRACE = { id: "user-grace", email: "grace@example.com" };

beforeEach(() => {
  store = createAlertStore();
  store.seedUser({ id: ADA.id, email: ADA.email, locale: "en" });
  store.seedUser({ id: GRACE.id, email: GRACE.email, locale: "en" });
});

describe("findAlertWithMatches", () => {
  it("LAYOUT-11: another user's alert is not found", async () => {
    const criteria = store.seedCriteria();
    const gracesAlert = store.seedAlert({ userId: GRACE.id, criteriaId: criteria.id });

    const alert = await findAlertWithMatches(ADA.id, gracesAlert.id);

    expect(alert).toBeNull();
  });

  it("LAYOUT-11: the user's own alert is returned", async () => {
    const criteria = store.seedCriteria();
    const adasAlert = store.seedAlert({ userId: ADA.id, criteriaId: criteria.id });

    const alert = await findAlertWithMatches(ADA.id, adasAlert.id);

    expect(alert).toMatchObject({ id: adasAlert.id, userId: "user-ada" });
  });
});

describe("findAlertSummaries", () => {
  it("ALERT-1: the alert is readable on a later request", async () => {
    await createAlertForUser(ADA.id, makeCriteria(), "Audi A3 under 20k");

    const result = await findAlertSummaries(ADA.id);

    expect(result.map((row: { label: string }) => row.label)).toEqual(["Audi A3 under 20k"]);
  });

  it("ALERT-1: returns only the caller's own alerts", async () => {
    await createAlertForUser(GRACE.id, makeCriteria({ brand: "BMW" }), "Grace's search");
    await createAlertForUser(ADA.id, makeCriteria(), "Ada's search");

    const result = await findAlertSummaries(ADA.id);

    expect(result.map((row: { label: string }) => row.label)).toEqual(["Ada's search"]);
  });

  it("ALERT-1: an empty list is a success, not an error", async () => {
    const result = await findAlertSummaries(ADA.id);

    expect(result).toEqual([]);
  });

  it("ALERT-42: an inactive alert still holds its criteria set", async () => {
    await createAlertForUser(ADA.id, makeCriteria(), "Audi A3 under 20k");
    const [alert] = store.alertsFor(ADA.id);
    // Unsubscribing deactivates; only deletion releases the criteria, so the
    // matches page still renders and re-enabling loses nothing.
    await store.client.alert.update({
      where: { id: alert.id },
      data: { active: false },
    });

    await expect(findAlertSummaries(ADA.id)).resolves.toBeDefined();
    expect(store.criteria()).toHaveLength(1);
  });
});
