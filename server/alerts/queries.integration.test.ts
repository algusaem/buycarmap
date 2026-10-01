import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createAlert } from "@/test/factories/alert";
import { createAlertCriteria } from "@/test/factories/alert-criteria";
import { createUser } from "@/test/factories/user";

// TEST-8 (docs/specs/core-testing.md): the alerts/[id] read, run against a
// real database, for a signed-in user who is not the alert's owner. This is
// a new file — server/alerts/queries.node.test.ts already covers
// getAlertWithMatches against a mocked @/server/alerts/service and stays as
// it is; this proves the same property end to end, through the real
// database-backed findAlertWithMatches.

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getAlertWithMatches, listAlertsForPage } from "./queries";

beforeEach(() => {
  vi.mocked(getCurrentUser).mockReset();
  vi.mocked(notFound).mockClear();
});

describe("getAlertWithMatches", () => {
  it("TEST-8: user B reading user A's alert gets notFound(), and A's alert is unchanged", async () => {
    const userA = await createUser({ email: "ada@example.com" });
    const userB = await createUser({ email: "grace@example.com" });
    const criteria = await createAlertCriteria();
    const adasAlert = await createAlert({
      user: { connect: { id: userA.id } },
      criteria: { connect: { id: criteria.id } },
      label: "Ada's search",
    });
    vi.mocked(getCurrentUser).mockResolvedValue(userB);

    await expect(getAlertWithMatches(adasAlert.id)).rejects.toThrow("NEXT_NOT_FOUND");

    expect(notFound).toHaveBeenCalledTimes(1);
    const stillThere = await prisma.alert.findUnique({ where: { id: adasAlert.id } });
    expect(stillThere).toMatchObject({ id: adasAlert.id, userId: userA.id, label: "Ada's search" });
  });

  it("TEST-8: user A can still read their own alert", async () => {
    const userA = await createUser({ email: "ada@example.com" });
    const criteria = await createAlertCriteria();
    const adasAlert = await createAlert({
      user: { connect: { id: userA.id } },
      criteria: { connect: { id: criteria.id } },
      label: "Ada's search",
    });
    vi.mocked(getCurrentUser).mockResolvedValue(userA);

    const alert = await getAlertWithMatches(adasAlert.id);

    expect(alert).toMatchObject({ id: adasAlert.id, userId: userA.id });
  });
});

// DATA-10 (docs/specs/core-data-model.md): `deletedAt` does not exist on
// Alert yet, so the update below is expected to fail until DATA-8 adds it.
describe("listAlertsForPage", () => {
  it("DATA-10: excludes a soft-deleted alert", async () => {
    const userA = await createUser({ email: "ada@example.com" });
    const criteria = await createAlertCriteria();
    const adasAlert = await createAlert({
      user: { connect: { id: userA.id } },
      criteria: { connect: { id: criteria.id } },
      label: "Ada's search",
    });
    await prisma.alert.update({ where: { id: adasAlert.id }, data: { deletedAt: new Date() } });
    vi.mocked(getCurrentUser).mockResolvedValue(userA);

    const summaries = await listAlertsForPage();

    expect(summaries.map((row) => row.id)).not.toContain(adasAlert.id);
  });
});
