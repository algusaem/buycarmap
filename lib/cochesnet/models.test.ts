import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { makeCochesNetTaxonomy } from "@/test/fixtures/cochesnet";
import { resolveCochesNetModelId } from "./models";

// `modelsByMake` is a module-level Map with no expiry and no reset hook, so
// every case uses a makeId of its own. Reusing one would let an earlier test's
// cached list answer a later test's fetch.
describe("resolveCochesNetModelId", () => {
  it("SRC-7: resolves a model name to its numeric id, case-insensitively", async () => {
    server.use(
      http.get("*/api/cochesnet/models", () =>
        HttpResponse.json(makeCochesNetTaxonomy([{ id: 4321, label: "Serie 3" }])),
      ),
    );

    expect(await resolveCochesNetModelId(101, "serie 3")).toBe(4321);
  });

  it("SRC-7: returns undefined when the name matches nothing", async () => {
    server.use(
      http.get("*/api/cochesnet/models", () =>
        HttpResponse.json(makeCochesNetTaxonomy([{ id: 4321, label: "Serie 3" }])),
      ),
    );

    expect(await resolveCochesNetModelId(102, "Mustang")).toBeUndefined();
  });

  it("SRC-14: fetches a make's model list once and reuses it", async () => {
    let calls = 0;
    server.use(
      http.get("*/api/cochesnet/models", () => {
        calls += 1;
        return HttpResponse.json(
          makeCochesNetTaxonomy([{ id: 4321, label: "Serie 3" }]),
        );
      }),
    );

    await resolveCochesNetModelId(103, "Serie 3");
    await resolveCochesNetModelId(103, "Serie 3");

    expect(calls).toBe(1);
  });

  it("SRC-14: a failed fetch does not disable model filtering for that make", async () => {
    let calls = 0;
    server.use(
      http.get("*/api/cochesnet/models", () => {
        calls += 1;
        // Fail once, then recover — the shape of a transient upstream blip.
        if (calls === 1) return HttpResponse.json({}, { status: 503 });
        return HttpResponse.json(
          makeCochesNetTaxonomy([{ id: 4321, label: "Serie 3" }]),
        );
      }),
    );

    // The failing search degrades to brand-only, which is correct.
    expect(await resolveCochesNetModelId(104, "Serie 3")).toBeUndefined();

    // The next one must retry rather than serve a cached empty list forever.
    expect(await resolveCochesNetModelId(104, "Serie 3")).toBe(4321);
    expect(calls).toBe(2);
  });
});
