import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { makeWallapopResponse } from "@/test/fixtures/wallapop";
import { GET } from "./route";

const UPSTREAM = "https://api.wallapop.com/api/v3/search/section";

describe("GET /api/wallapop/search", () => {
  it("forwards the query string and injects the required Wallapop headers", async () => {
    let received: Request | undefined;
    server.use(
      http.get(UPSTREAM, ({ request }) => {
        received = request;
        return HttpResponse.json(makeWallapopResponse([]));
      }),
    );

    const res = await GET(
      new NextRequest(
        "http://localhost/api/wallapop/search?keywords=golf&brand=Seat",
      ),
    );

    expect(res.status).toBe(200);
    expect(received?.headers.get("x-deviceos")).toBe("0");
    expect(received?.headers.get("x-appversion")).toBe("85000");
    const url = new URL(received!.url);
    expect(url.searchParams.get("keywords")).toBe("golf");
    expect(url.searchParams.get("brand")).toBe("Seat");
  });

  it("passes through the upstream error status", async () => {
    server.use(
      http.get(UPSTREAM, () => HttpResponse.json({}, { status: 503 })),
    );

    const res = await GET(
      new NextRequest("http://localhost/api/wallapop/search"),
    );

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({
      error: "Wallapop API error: 503",
    });
  });
});
