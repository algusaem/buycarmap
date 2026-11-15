import { afterEach, describe, expect, it, vi } from "vitest";

// docs/specs/map-description-search.md (DESC-32): the edge runtime's
// Sentry.init must also carry lib/sentry-privacy.ts's query-stripping
// `beforeSend`. `.node.test.ts` (not colocated with instrumentation.ts at
// the repo root) so the vitest "node" project's glob
// ({lib,app,server}/**/*.node.test.ts) picks it up without a config change
// (RULES.md §1) — the "edge" branch under test needs no Edge runtime itself,
// only `process.env.NEXT_RUNTIME` read as a plain string.

const originalRuntime = process.env.NEXT_RUNTIME;
const CONSOLE_BREADCRUMB = {
  category: "console",
  message: "Failed to fetch RSC payload for /map?q=e46.",
  data: { arguments: ["x"] },
};

afterEach(() => {
  // `process.env.NEXT_RUNTIME` was unset before this file ran: writing
  // `undefined` back to it would coerce to the string "undefined" instead
  // of restoring the absence.
  if (originalRuntime === undefined) {
    delete process.env.NEXT_RUNTIME;
  } else {
    process.env.NEXT_RUNTIME = originalRuntime;
  }
  vi.doUnmock("@sentry/nextjs");
  vi.doUnmock("@/lib/env");
});

describe("instrumentation: nodejs Sentry.init wiring", () => {
  it("DESC-32: with a DSN, the nodejs init's options strip the same event and breadcrumb", async () => {
    const init = vi.fn();
    vi.resetModules();
    process.env.NEXT_RUNTIME = "nodejs";
    vi.doMock("@sentry/nextjs", () => ({ init, captureRequestError: vi.fn() }));
    vi.doMock("@/lib/env", () => ({ env: { SENTRY_DSN: "https://key@o0.ingest.sentry.io/0" } }));

    const { register } = await import("@/instrumentation");
    await register();

    expect(init).toHaveBeenCalledTimes(1);
    const options = init.mock.calls[0][0];
    const event = { request: { url: "https://buycarmap.test/map?q=e46" } };
    // `toMatchObject`, not `toEqual`: lib/sentry.ts's own `beforeSend` also
    // tags the event with the request's correlation id (PLAT-18), on top of
    // the query-stripping under test here.
    expect(options.beforeSend(event)).toMatchObject({
      request: { url: "https://buycarmap.test/map" },
    });
    const breadcrumb = options.beforeBreadcrumb(structuredClone(CONSOLE_BREADCRUMB));
    expect(breadcrumb.message).toBe("Failed to fetch RSC payload for /map.");
    expect(breadcrumb.data).not.toHaveProperty("arguments");
  });
});

describe("instrumentation: edge Sentry.init wiring", () => {
  it("DESC-32: with a DSN, the edge init's beforeSend strips the query string", async () => {
    const init = vi.fn();
    vi.resetModules();
    process.env.NEXT_RUNTIME = "edge";
    vi.doMock("@sentry/nextjs", () => ({ init, captureRequestError: vi.fn() }));
    vi.doMock("@/lib/env", () => ({ env: { SENTRY_DSN: "https://key@o0.ingest.sentry.io/0" } }));

    const { register } = await import("@/instrumentation");
    await register();

    expect(init).toHaveBeenCalledTimes(1);
    const options = init.mock.calls[0][0];
    const event = { request: { url: "https://buycarmap.test/map?q=e46" } };
    expect(options.beforeSend(event)).toEqual({
      request: { url: "https://buycarmap.test/map" },
    });
  });

  it("DESC-32: with a DSN, the edge init's beforeBreadcrumb strips the same breadcrumb", async () => {
    const init = vi.fn();
    vi.resetModules();
    process.env.NEXT_RUNTIME = "edge";
    vi.doMock("@sentry/nextjs", () => ({ init, captureRequestError: vi.fn() }));
    vi.doMock("@/lib/env", () => ({ env: { SENTRY_DSN: "https://key@o0.ingest.sentry.io/0" } }));

    const { register } = await import("@/instrumentation");
    await register();

    expect(init).toHaveBeenCalledTimes(1);
    const options = init.mock.calls[0][0];
    const breadcrumb = options.beforeBreadcrumb(structuredClone(CONSOLE_BREADCRUMB));
    expect(breadcrumb.message).toBe("Failed to fetch RSC payload for /map.");
    expect(breadcrumb.data).not.toHaveProperty("arguments");
  });

  it("DESC-32: with no DSN, the edge Sentry.init is never called", async () => {
    const init = vi.fn();
    vi.resetModules();
    process.env.NEXT_RUNTIME = "edge";
    vi.doMock("@sentry/nextjs", () => ({ init, captureRequestError: vi.fn() }));
    vi.doMock("@/lib/env", () => ({ env: { SENTRY_DSN: undefined } }));

    const { register } = await import("@/instrumentation");
    await register();

    expect(init).not.toHaveBeenCalled();
  });
});
