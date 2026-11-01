import { afterEach, describe, expect, it, vi } from "vitest";

// docs/specs/map-description-search.md (DESC-32): the browser's Sentry.init
// must be wired with the query-stripping `beforeSend`/`beforeBreadcrumb`
// from lib/sentry-privacy.ts, and must stay inert without a DSN. Lives here,
// not colocated with instrumentation-client.ts at the repo root, so the
// vitest "unit" project's glob ({lib,components,app,server}/**/*.test.ts)
// picks it up without a config change (RULES.md §1).

afterEach(() => {
  vi.doUnmock("@sentry/nextjs");
  vi.doUnmock("@/lib/env");
});

describe("instrumentation-client: Sentry.init wiring", () => {
  it("DESC-32: with a DSN, wires beforeSend and beforeBreadcrumb to strip the query string", async () => {
    const init = vi.fn();
    vi.resetModules();
    vi.doMock("@sentry/nextjs", () => ({ init }));
    vi.doMock("@/lib/env", () => ({
      env: { NEXT_PUBLIC_SENTRY_DSN: "https://key@o0.ingest.sentry.io/0" },
    }));

    await import("@/instrumentation-client");

    expect(init).toHaveBeenCalledTimes(1);
    const options = init.mock.calls[0][0];

    const event = { request: { url: "https://buycarmap.test/map?q=e46" } };
    expect(options.beforeSend(event)).toEqual({
      request: { url: "https://buycarmap.test/map" },
    });

    const breadcrumb = { category: "navigation", data: { from: "/map?q=e46", to: "/map?q=gti" } };
    expect(options.beforeBreadcrumb(breadcrumb)).toEqual({
      category: "navigation",
      data: { from: "/map", to: "/map" },
    });
  });

  it("DESC-32: with no DSN, Sentry.init is never called", async () => {
    const init = vi.fn();
    vi.resetModules();
    vi.doMock("@sentry/nextjs", () => ({ init }));
    vi.doMock("@/lib/env", () => ({ env: { NEXT_PUBLIC_SENTRY_DSN: undefined } }));

    await import("@/instrumentation-client");

    expect(init).not.toHaveBeenCalled();
  });
});
