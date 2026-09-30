import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: { $queryRaw: vi.fn() },
}));

import { prisma } from "@/lib/db/prisma";
import { GET } from "./route";

beforeEach(() => {
  vi.mocked(prisma.$queryRaw).mockReset();
});

describe("GET /api/health/db", () => {
  it('PLAT-20: the database is up -> 200 { status: "ok", db: "ok" }', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ "?column?": 1 }]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "ok", db: "ok" });
  });

  it('PLAT-20: $queryRaw throws -> 503 { status: "error", db: "unreachable" }', async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error("connection refused at 10.0.0.1"));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ status: "error", db: "unreachable" });
  });

  it("PLAT-20: a failure carries no error detail (no internal host) in the body", async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error("connection refused at 10.0.0.1"));

    const response = await GET();
    const text = await response.text();

    expect(text).not.toContain("10.0.0.1");
  });

  it("PLAT-20: sends Cache-Control: no-store on success", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ "?column?": 1 }]);

    const response = await GET();

    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("PLAT-20: sends Cache-Control: no-store on failure", async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error("connection refused at 10.0.0.1"));

    const response = await GET();

    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
