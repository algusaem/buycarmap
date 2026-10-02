import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAlertStore, makeCriteria } from "@/test/fixtures/alerts";

// TEST-7 (docs/specs/core-testing.md): every other case in this file moved to
// ./actions.integration.test.ts, which runs against a real database. A Prisma
// mock survives only here, where the point is PLAT-12 — a database failure
// rejecting instead of returning an error Result — which needs a call that
// can be made to fail on demand.

let store: ReturnType<typeof createAlertStore>;

vi.mock("@/lib/db/prisma", () => ({
  get prisma() {
    return store.client;
  },
}));

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/email/client", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("next-intl/server", () => ({ getLocale: vi.fn(async () => "en") }));
vi.mock("@/server/alerts/search", () => ({ searchAllSources: vi.fn() }));

import { getCurrentUser } from "@/lib/auth/session";
import { getLocale } from "next-intl/server";
import { searchAllSources } from "@/server/alerts/search";
import { createAlert, deleteAlert } from "./actions";

const ADA = { id: "user-ada", email: "ada@example.com" };

function signedInAs(user: { id: string; email: string }) {
  vi.mocked(getCurrentUser).mockResolvedValue(user);
}

beforeEach(() => {
  store = createAlertStore();
  store.seedUser({ id: ADA.id, email: ADA.email, locale: "en" });
  vi.mocked(getCurrentUser).mockReset();
  vi.mocked(searchAllSources).mockClear();
  vi.mocked(getLocale).mockResolvedValue("en");
  vi.mocked(searchAllSources).mockResolvedValue({
    listings: [],
    failedSources: [],
    perSourceCounts: {},
  });
});

describe("createAlert", () => {
  it("PLAT-12: a database failure rejects instead of returning an error Result", async () => {
    signedInAs(ADA);
    vi.mocked(store.client.alert.upsert).mockRejectedValueOnce(new Error("connection refused"));

    await expect(createAlert(makeCriteria(), "Audi A3 under 20k")).rejects.toThrow();
  });
});

describe("deleteAlert", () => {
  it("PLAT-12: a database failure rejects instead of returning an error Result", async () => {
    signedInAs(ADA);
    await createAlert(makeCriteria(), "Audi A3 under 20k");
    const [alert] = store.alertsFor(ADA.id);
    vi.mocked(store.client.alert.updateMany).mockRejectedValueOnce(new Error("connection refused"));

    await expect(deleteAlert(alert.id)).rejects.toThrow();
  });
});
