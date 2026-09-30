import { describe, expect, it } from "vitest";
import { requestIdTag, sentryOptions } from "./sentry";
import { runWithRequestId } from "./request-context";

describe("sentryOptions", () => {
  it("PLAT-18: is inert without a DSN", () => {
    expect(sentryOptions(undefined)).toBeUndefined();
  });

  it("PLAT-18: is inert with an empty DSN", () => {
    expect(sentryOptions("")).toBeUndefined();
  });

  it("PLAT-18: with a DSN, sends no default PII and no tracing", () => {
    const options = sentryOptions("https://key@o0.ingest.sentry.io/0");

    expect(options).toBeDefined();
    expect(options?.dsn).toBe("https://key@o0.ingest.sentry.io/0");
    expect(options?.dataCollection).toEqual({
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      stackFrameVariables: false,
      queues: false,
      graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false },
    });
    expect(options?.tracesSampleRate).toBe(0);
  });

  it("PLAT-18: with a DSN, configures no session replay", () => {
    const options = sentryOptions("https://key@o0.ingest.sentry.io/0");

    const hasReplay = (options?.integrations ?? []).some((integration) =>
      /replay/i.test(integration.name ?? ""),
    );
    expect(hasReplay).toBe(false);
  });
});

describe("requestIdTag", () => {
  it("PLAT-18: carries no request_id tag outside a request", () => {
    expect(requestIdTag()).toEqual({});
  });

  it("PLAT-18: carries the correlation id as request_id inside a request", () => {
    const tag = runWithRequestId("0f8f2b1e-6a3c-4c1e-9d7a-2b5e8f1c3a4d", () => requestIdTag());

    expect(tag).toEqual({ request_id: "0f8f2b1e-6a3c-4c1e-9d7a-2b5e8f1c3a4d" });
  });
});
