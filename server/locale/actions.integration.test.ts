import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createUser } from "@/test/factories/user";

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn() }));

import { getCurrentUser } from "@/lib/auth/session";
import { setLocale } from "./actions";

function signedInAs(user: { id: string; email: string }) {
  vi.mocked(getCurrentUser).mockResolvedValue(user);
}

function signedOut() {
  vi.mocked(getCurrentUser).mockResolvedValue(null);
}

beforeEach(() => {
  vi.mocked(getCurrentUser).mockReset();
});

describe("setLocale", () => {
  it("ALERT-33: persists the chosen language to the signed-in account", async () => {
    const user = await createUser({ email: "ada@example.com", locale: "es" });
    signedInAs(user);

    const result = await setLocale("en");

    expect(result).toEqual({ ok: true, value: undefined });
    const found = await prisma.user.findUnique({ where: { id: user.id } });
    expect(found?.locale).toBe("en");
  });

  it("ALERT-33: a signed-out visitor writes nothing, the cookie already carries it", async () => {
    const user = await createUser({ email: "ada@example.com", locale: "es" });
    signedOut();

    const result = await setLocale("en");

    expect(result).toEqual({ ok: true, value: undefined });
    const found = await prisma.user.findUnique({ where: { id: user.id } });
    expect(found?.locale).toBe("es");
  });

  it("ALERT-33: refuses a locale the app does not support (PLAT-11)", async () => {
    const user = await createUser({ email: "ada@example.com", locale: "es" });
    signedInAs(user);

    const result = await setLocale("de" as never);

    expect(result).toEqual({
      ok: false,
      error: { code: "invalidLocale", messageKey: "localeErrors.invalidLocale" },
    });
    const found = await prisma.user.findUnique({ where: { id: user.id } });
    expect(found?.locale).toBe("es");
  });
});
