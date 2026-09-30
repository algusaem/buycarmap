import { describe, expect, it, vi } from "vitest";
import { createAlertStore } from "@/test/fixtures/alerts";

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

import { getCurrentUser } from "@/lib/auth/session";
import { setLocale } from "./actions";

const ADA = { id: "user-ada", email: "ada@example.com" };

function signedInAs(user: { id: string; email: string }) {
  vi.mocked(getCurrentUser).mockResolvedValue(user);
}

describe("setLocale", () => {
  it("PLAT-12: a database failure rejects instead of returning an error Result", async () => {
    store = createAlertStore();
    store.seedUser({ id: ADA.id, email: ADA.email, locale: "es" });
    signedInAs(ADA);
    vi.mocked(store.client.user.update).mockRejectedValueOnce(new Error("connection refused"));

    await expect(setLocale("en")).rejects.toThrow();
  });
});
