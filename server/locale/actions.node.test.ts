import { describe, expect, it, vi } from "vitest";
import { createAlertStore } from "@/test/fixtures/alerts";

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

function signedOut() {
  vi.mocked(getCurrentUser).mockResolvedValue(null);
}
describe("setLocale", () => {
  it("ALERT-33: persists the chosen language to the signed-in account", async () => {
    store = createAlertStore();
    store.seedUser({ id: ADA.id, email: ADA.email, locale: "es" });
    signedInAs(ADA);

    const result = await setLocale("en");

    expect(result.success).toBe(true);
    expect(store.users()[0].locale).toBe("en");
  });

  it("ALERT-33: a signed-out visitor writes nothing, the cookie already carries it", async () => {
    store = createAlertStore();
    store.seedUser({ id: ADA.id, email: ADA.email, locale: "es" });
    signedOut();

    const result = await setLocale("en");

    expect(result.success).toBe(true);
    expect(store.users()[0].locale).toBe("es");
  });

  it("ALERT-33: refuses a locale the app does not support", async () => {
    store = createAlertStore();
    store.seedUser({ id: ADA.id, email: ADA.email, locale: "es" });
    signedInAs(ADA);

    const result = await setLocale("de" as never);

    expect(result).toEqual({ success: false, error: "invalidCriteria" });
    expect(store.users()[0].locale).toBe("es");
  });
});
