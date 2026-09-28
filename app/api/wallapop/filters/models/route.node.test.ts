import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { GET } from "./route";

const UPSTREAM = "https://api.wallapop.com/api/v3/search/filters/model";

describe("GET /api/wallapop/filters/models", () => {
  it("SRC-10: returns 400 without calling upstream when brand is missing", async () => {
    const res = await GET(new NextRequest("http://localhost/api/wallapop/filters/models"));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "brand parameter is required",
    });
  });

  it("SRC-9: forwards the brand with category_id and the required headers", async () => {
    let received: Request | undefined;
    server.use(
      http.get(UPSTREAM, ({ request }) => {
        received = request;
        return HttpResponse.json({ options: [] });
      }),
    );

    const res = await GET(
      new NextRequest("http://localhost/api/wallapop/filters/models?brand=Audi"),
    );

    expect(res.status).toBe(200);
    if (!received) throw new Error("expected the upstream request to have been captured");
    const url = new URL(received.url);
    expect(url.searchParams.get("brand")).toBe("Audi");
    expect(url.searchParams.get("category_id")).toBe("100");
    expect(received?.headers.get("x-deviceos")).toBe("0");
  });
});
describe("GET upstream error status", () => {
  it("SRC-11: passes through the upstream error status", async () => {
    server.use(http.get(UPSTREAM, () => HttpResponse.json({ error: "nope" }, { status: 429 })));

    const res = await GET(
      new NextRequest("http://localhost:3000/api/wallapop/filters/models?brand=Audi"),
    );

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

    const res = await GET(
      new NextRequest("http://localhost:3000/api/wallapop/filters/models?brand=Audi"),
    );

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: expect.stringContaining("failed") });
  });
});
