import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { GET } from "./route";

const UPSTREAM = "https://web.gw.coches.net/models";

describe("GET /api/cochesnet/models", () => {
  it("returns 400 without calling upstream when makeId is missing", async () => {
    const res = await GET(
      new NextRequest("http://localhost/api/cochesnet/models"),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "makeId parameter is required",
    });
  });

  it("forwards the makeId and injects the tenant header", async () => {
    let received: Request | undefined;
    server.use(
      http.get(UPSTREAM, ({ request }) => {
        received = request;
        return HttpResponse.json({ items: [] });
      }),
    );

    const res = await GET(
      new NextRequest("http://localhost/api/cochesnet/models?makeId=4"),
    );

    expect(res.status).toBe(200);
    expect(new URL(received!.url).searchParams.get("makeId")).toBe("4");
    expect(received?.headers.get("X-Schibsted-Tenant")).toBe("coches");
  });
});
