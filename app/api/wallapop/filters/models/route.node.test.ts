import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { GET } from "./route";

const UPSTREAM = "https://api.wallapop.com/api/v3/search/filters/model";

describe("GET /api/wallapop/filters/models", () => {
  it("returns 400 without calling upstream when brand is missing", async () => {
    const res = await GET(
      new NextRequest("http://localhost/api/wallapop/filters/models"),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "brand parameter is required",
    });
  });

  it("forwards the brand with category_id and the required headers", async () => {
    let received: Request | undefined;
    server.use(
      http.get(UPSTREAM, ({ request }) => {
        received = request;
        return HttpResponse.json({ options: [] });
      }),
    );

    const res = await GET(
      new NextRequest(
        "http://localhost/api/wallapop/filters/models?brand=Audi",
      ),
    );

    expect(res.status).toBe(200);
    const url = new URL(received!.url);
    expect(url.searchParams.get("brand")).toBe("Audi");
    expect(url.searchParams.get("category_id")).toBe("100");
    expect(received?.headers.get("x-deviceos")).toBe("0");
  });
});
