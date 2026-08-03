import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieStore = { get: vi.fn() };
const headerStore = { get: vi.fn() };
vi.mock("next/headers", () => ({
  cookies: async () => cookieStore,
  headers: async () => headerStore,
}));

import { getLocale } from "./server";

beforeEach(() => {
  cookieStore.get.mockReset().mockReturnValue(undefined);
  headerStore.get.mockReset().mockReturnValue(null);
});

describe("getLocale", () => {
  it("CORE-1: prefers an explicit choice over the browser's preference", async () => {
    cookieStore.get.mockReturnValue({ value: "en" });
    headerStore.get.mockReturnValue("es-ES,es;q=0.9");

    expect(await getLocale()).toBe("en");
  });

  it("CORE-2: falls back to the browser's preferred language when it is supported", async () => {
    headerStore.get.mockReturnValue("en-GB,en;q=0.9,fr;q=0.8");

    expect(await getLocale()).toBe("en");
  });

  it("CORE-2: honours the q-value order rather than the written order", async () => {
    // fr is listed first but ranked lower; en is the highest-weighted match.
    headerStore.get.mockReturnValue("fr;q=0.2,en;q=0.9");

    expect(await getLocale()).toBe("en");
  });

  it("CORE-3: defaults to Spanish when nothing else applies", async () => {
    expect(await getLocale()).toBe("es");
  });

  it("CORE-3: defaults to Spanish when no supported language is requested", async () => {
    headerStore.get.mockReturnValue("ja-JP,ja;q=0.9");

    expect(await getLocale()).toBe("es");
  });

  it("CORE-4: ignores a cookie holding an unsupported locale", async () => {
    // The cookie is user-writable. Using it as a key straight into the
    // translations map is how an undefined lookup becomes blank UI.
    cookieStore.get.mockReturnValue({ value: "de" });
    headerStore.get.mockReturnValue("en-GB,en;q=0.9");

    expect(await getLocale()).toBe("en");
  });

  it("CORE-4: ignores a cookie holding a malformed value", async () => {
    cookieStore.get.mockReturnValue({ value: "../../etc/passwd" });

    expect(await getLocale()).toBe("es");
  });
});
