import { beforeEach, describe, expect, it, vi } from "vitest";

// PLAT-19 (docs/specs/core-platform.md): /api/health never touches the
// database — every prisma method here is a spy that throws if called.
vi.mock("@/lib/db/prisma", () => ({
  prisma: new Proxy(
    {},
    {
      get() {
        return vi.fn(() => {
          throw new Error("GET /api/health must not touch the database");
        });
      },
    },
  ),
}));

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/health", () => {
  it('PLAT-19: answers 200 with { status: "ok" }', async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "ok" });
  });

  it("PLAT-19: sends Cache-Control: no-store", async () => {
    const response = await GET();

    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("PLAT-19: the database is down and the health check still succeeds, having never touched it", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
  });
});
