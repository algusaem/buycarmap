import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { makeWallapopResponse } from "@/test/fixtures/wallapop";
import { GET } from "./route";

const UPSTREAM = "https://api.wallapop.com/api/v3/search/section";

describe("GET /api/wallapop/search", () => {
  it("SRC-9: forwards the query string and injects the required Wallapop headers", async () => {
    let received: Request | undefined;
    server.use(
      http.get(UPSTREAM, ({ request }) => {
        received = request;
        return HttpResponse.json(makeWallapopResponse([]));
      }),
    );

    const res = await GET(
      new NextRequest("http://localhost/api/wallapop/search?keywords=golf&brand=Seat"),
    );

    expect(res.status).toBe(200);
    expect(received?.headers.get("x-deviceos")).toBe("0");
    expect(received?.headers.get("x-appversion")).toBe("85000");
    if (!received) throw new Error("expected the upstream request to have been captured");
    const url = new URL(received.url);
    expect(url.searchParams.get("keywords")).toBe("golf");
    expect(url.searchParams.get("brand")).toBe("Seat");
  });

  it("SRC-11: passes through the upstream error status", async () => {
    server.use(http.get(UPSTREAM, () => HttpResponse.json({}, { status: 503 })));

    const res = await GET(new NextRequest("http://localhost/api/wallapop/search"));

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({
      error: "Wallapop API error: 503",
    });
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

    const res = await GET(
      new NextRequest("http://localhost:3000/api/wallapop/search?keywords=golf"),
    );

    expect(res.status).toBe(502);
    const body: { error: string } = await res.json();
    const expected: { error: string } = { error: expect.stringContaining("failed") };
    expect(body).toEqual(expected);
  });
});
