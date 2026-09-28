import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { GET } from "./route";

const UPSTREAM = "https://web.gw.coches.net/models";

describe("GET /api/cochesnet/models", () => {
  it("SRC-10: returns 400 without calling upstream when makeId is missing", async () => {
    const res = await GET(new NextRequest("http://localhost/api/cochesnet/models"));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "makeId parameter is required",
    });
  });

  it("SRC-9: forwards the makeId and injects the tenant header", async () => {
    let received: Request | undefined;
    server.use(
      http.get(UPSTREAM, ({ request }) => {
        received = request;
        return HttpResponse.json({ items: [] });
      }),
    );

    const res = await GET(new NextRequest("http://localhost/api/cochesnet/models?makeId=4"));

    expect(res.status).toBe(200);
    if (!received) throw new Error("expected the upstream request to have been captured");
    expect(new URL(received.url).searchParams.get("makeId")).toBe("4");
    expect(received?.headers.get("X-Schibsted-Tenant")).toBe("coches");
  });
});
describe("GET upstream error status", () => {
  it("SRC-11: passes through the upstream error status", async () => {
    server.use(http.get(UPSTREAM, () => HttpResponse.json({ error: "nope" }, { status: 429 })));

    const res = await GET(new NextRequest("http://localhost:3000/api/cochesnet/models?makeId=101"));

    expect(res.status).toBe(429);
  });
});

describe("GET upstream connection failure", () => {
  it("SRC-12: answers 502 rather than throwing when the connection fails", async () => {
    server.use(
      http.get(UPSTREAM, () =>
        // A rejected fetch, not an error status: DNS failure, reset, timeout.
        // HttpResponse.error() is what makes fetch itself reject.
        HttpResponse.error(),
      ),
    );

    const res = await GET(new NextRequest("http://localhost:3000/api/cochesnet/models?makeId=101"));

    expect(res.status).toBe(502);
    const body: { error: string } = await res.json();
    expect(body).toEqual({ error: expect.stringContaining("failed") });
  });
});
