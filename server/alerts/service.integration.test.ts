import { describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { asAlertId, asUserId } from "@/lib/ids";
import { createAlert } from "@/test/factories/alert";
import { createAlertCriteria } from "@/test/factories/alert-criteria";
import { createUser } from "@/test/factories/user";
import { makeCriteria } from "@/test/fixtures/alerts";

vi.mock("@/lib/email/client", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("next-intl/server", () => ({ getLocale: vi.fn(async () => "en") }));

// The seed poll (ALERT-2) is the only network createAlertForUser does. Stubbed
// at the server-side search seam, not the database.
vi.mock("@/server/alerts/search", () => ({
  searchAllSources: vi.fn(async () => ({ listings: [], failedSources: [], perSourceCounts: {} })),
}));

import { createAlertForUser, findAlertSummaries, findAlertWithMatches } from "./service";

describe("findAlertWithMatches", () => {
  it("LAYOUT-11: another user's alert is not found", async () => {
    const ada = await createUser({ email: "ada@example.com" });
    const grace = await createUser({ email: "grace@example.com" });
    const criteria = await createAlertCriteria();
    const gracesAlert = await createAlert({
      user: { connect: { id: grace.id } },
      criteria: { connect: { id: criteria.id } },
    });

    const alert = await findAlertWithMatches(asUserId(ada.id), asAlertId(gracesAlert.id));

    expect(alert).toBeNull();
  });

  it("LAYOUT-11: the user's own alert is returned", async () => {
    const ada = await createUser({ email: "ada@example.com" });
    const criteria = await createAlertCriteria();
    const adasAlert = await createAlert({
      user: { connect: { id: ada.id } },
      criteria: { connect: { id: criteria.id } },
    });

    const alert = await findAlertWithMatches(asUserId(ada.id), asAlertId(adasAlert.id));

    expect(alert).toMatchObject({ id: adasAlert.id, userId: ada.id });
  });
});

describe("findAlertSummaries", () => {
  it("ALERT-1: the alert is readable on a later request", async () => {
    const ada = await createUser({ email: "ada@example.com" });

    await createAlertForUser(asUserId(ada.id), makeCriteria(), "Audi A3 under 20k");

    const result = await findAlertSummaries(asUserId(ada.id));

    expect(result.map((row) => row.label)).toEqual(["Audi A3 under 20k"]);
  });

  it("ALERT-1: returns only the caller's own alerts", async () => {
    const ada = await createUser({ email: "ada@example.com" });
    const grace = await createUser({ email: "grace@example.com" });

    await createAlertForUser(asUserId(grace.id), makeCriteria({ brand: "BMW" }), "Grace's search");
    await createAlertForUser(asUserId(ada.id), makeCriteria(), "Ada's search");

    const result = await findAlertSummaries(asUserId(ada.id));

    expect(result.map((row) => row.label)).toEqual(["Ada's search"]);
  });

  it("ALERT-1: an empty list is a success, not an error", async () => {
    const ada = await createUser({ email: "ada@example.com" });

    const result = await findAlertSummaries(asUserId(ada.id));

    expect(result).toEqual([]);
  });

  it("ALERT-42: an inactive alert still holds its criteria set", async () => {
    const ada = await createUser({ email: "ada@example.com" });
    await createAlertForUser(asUserId(ada.id), makeCriteria(), "Audi A3 under 20k");
    const [alert] = await prisma.alert.findMany({ where: { userId: ada.id } });
    // Unsubscribing deactivates; only deletion releases the criteria, so the
    // matches page still renders and re-enabling loses nothing.
    await prisma.alert.update({ where: { id: alert.id }, data: { active: false } });

    await expect(findAlertSummaries(asUserId(ada.id))).resolves.toEqual([
      expect.objectContaining({ label: "Audi A3 under 20k", matchCount: 0, active: false }),
    ]);
    expect(await prisma.alertCriteria.count()).toBe(1);
  });
});
