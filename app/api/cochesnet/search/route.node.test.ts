import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { makeCochesNetResponse } from "@/test/fixtures/cochesnet";
import { POST } from "./route";

const UPSTREAM = "https://web.gw.coches.net/search/listing";

function postRequest(body: string): NextRequest {
  return new NextRequest("http://localhost/api/cochesnet/search", {
    method: "POST",
    body,
  });
}

describe("POST /api/cochesnet/search", () => {
  it("SRC-9: forwards the raw body and injects the tenant header", async () => {
    let received: { tenant: string | null; body: string } | undefined;
    server.use(
      http.post(UPSTREAM, async ({ request }) => {
        received = {
          tenant: request.headers.get("X-Schibsted-Tenant"),
          body: await request.text(),
        };
        return HttpResponse.json(makeCochesNetResponse([]));
      }),
    );

    const payload = JSON.stringify({ pagination: { page: 1, size: 40 } });
    const res = await POST(postRequest(payload));

    expect(res.status).toBe(200);
    expect(received?.tenant).toBe("coches");
    expect(received?.body).toBe(payload);
  });

  it("SRC-11: passes through the upstream error status", async () => {
    server.use(http.post(UPSTREAM, () => HttpResponse.json({}, { status: 500 })));

    const res = await POST(postRequest("{}"));

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      error: "Coches.net API error: 500",
    });
  });
});
describe("POST upstream connection failure", () => {
  it("SRC-12: answers 502 rather than throwing when the connection fails", async () => {
    server.use(
      http.post(UPSTREAM, () =>
        // A rejected fetch, not an error status: DNS failure, reset, timeout.
        // HttpResponse.error() is what makes fetch itself reject.
        HttpResponse.error(),
      ),
    );

    const res = await POST(
      new NextRequest("http://localhost:3000/api/cochesnet/search", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: expect.stringContaining("failed") });
  });
});
