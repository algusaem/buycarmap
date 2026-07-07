import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import {
  makeMilanunciosAd,
  makeMilanunciosHtml,
  makeMilanunciosResponse,
} from "@/test/fixtures/milanuncios";
import { GET } from "./route";

const UPSTREAM = "https://www.milanuncios.com/*";

function getRequest(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/milanuncios/search?${query}`);
}

describe("GET /api/milanuncios/search", () => {
  it("builds the make-slug path, forwards the other params, and returns extracted JSON", async () => {
    let received: URL | undefined;
    server.use(
      http.get(UPSTREAM, ({ request }) => {
        received = new URL(request.url);
        return HttpResponse.html(
          makeMilanunciosHtml(
            makeMilanunciosResponse([makeMilanunciosAd({ id: "77" })], 4),
          ),
        );
      }),
    );

    const res = await GET(
      getRequest("slug=audi-de-segunda-mano&anod=2018&palabras=familiar"),
    );

    expect(res.status).toBe(200);
    // slug becomes the path segment; it must not leak into the query.
    expect(received?.pathname).toBe("/audi-de-segunda-mano/");
    expect(received?.searchParams.get("anod")).toBe("2018");
    expect(received?.searchParams.get("palabras")).toBe("familiar");
    expect(received?.searchParams.has("slug")).toBe(false);

    const body = await res.json();
    expect(body.ads[0].id).toBe("77");
    expect(body.pagination.totalPages).toBe(4);
  });

  it("defaults to the all-cars slug when none is given", async () => {
    let received: URL | undefined;
    server.use(
      http.get(UPSTREAM, ({ request }) => {
        received = new URL(request.url);
        return HttpResponse.html(
          makeMilanunciosHtml(makeMilanunciosResponse([])),
        );
      }),
    );

    await GET(getRequest("palabras=coche"));
    expect(received?.pathname).toBe("/coches-de-segunda-mano/");
  });

  it("passes through the upstream error status", async () => {
    server.use(
      http.get(UPSTREAM, () => new HttpResponse(null, { status: 403 })),
    );

    const res = await GET(getRequest("slug=coches-de-segunda-mano"));
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      error: "Milanuncios error: 403",
    });
  });

  it("returns 502 when the upstream request throws", async () => {
    server.use(http.get(UPSTREAM, () => HttpResponse.error()));

    const res = await GET(getRequest("slug=coches-de-segunda-mano"));
    expect(res.status).toBe(502);
  });
});
