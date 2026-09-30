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

    expect(result).toEqual({ ok: true, value: undefined });
    expect(store.users()[0].locale).toBe("en");
  });

  it("ALERT-33: a signed-out visitor writes nothing, the cookie already carries it", async () => {
    store = createAlertStore();
    store.seedUser({ id: ADA.id, email: ADA.email, locale: "es" });
    signedOut();

    const result = await setLocale("en");

    expect(result).toEqual({ ok: true, value: undefined });
    expect(store.users()[0].locale).toBe("es");
  });

  it("ALERT-33: refuses a locale the app does not support (PLAT-11)", async () => {
    store = createAlertStore();
    store.seedUser({ id: ADA.id, email: ADA.email, locale: "es" });
    signedInAs(ADA);

    const result = await setLocale("de" as never);

    expect(result).toEqual({
      ok: false,
      error: { code: "invalidLocale", messageKey: "localeErrors.invalidLocale" },
    });
    expect(store.users()[0].locale).toBe("es");
  });

  it("PLAT-12: a database failure rejects instead of returning an error Result", async () => {
    store = createAlertStore();
    store.seedUser({ id: ADA.id, email: ADA.email, locale: "es" });
    signedInAs(ADA);
    vi.mocked(store.client.user.update).mockRejectedValueOnce(new Error("connection refused"));

    await expect(setLocale("en")).rejects.toThrow();
  });
});
