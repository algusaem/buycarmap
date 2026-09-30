import { describe, expect, it } from "vitest";
import { createLogger, type LogDestination } from "./logger";
import { getRequestId, runWithRequestId } from "./request-context";

const REQUEST_ID = "0f8f2b1e-6a3c-4c1e-9d7a-2b5e8f1c3a4d";

function makeDestination(): LogDestination & { lines: string[] } {
  const lines: string[] = [];
  return {
    lines,
    write(line: string) {
      lines.push(line);
    },
  };
}

describe("getRequestId outside a request", () => {
  it("PLAT-17: returns undefined when no request is in progress", () => {
    expect(getRequestId()).toBeUndefined();
  });
});

describe("runWithRequestId", () => {
  it("PLAT-17: getRequestId reads back the id inside the callback", async () => {
    const seen = await runWithRequestId(REQUEST_ID, () => getRequestId());

    expect(seen).toBe(REQUEST_ID);
  });

  it("PLAT-17: getRequestId reports undefined again once the callback returns", async () => {
    await runWithRequestId(REQUEST_ID, () => getRequestId());

    expect(getRequestId()).toBeUndefined();
  });

  it("PLAT-17: a log line written inside the context carries the requestId", () => {
    const dest = makeDestination();
    const log = createLogger(dest);

    runWithRequestId(REQUEST_ID, () => {
      log.info({}, "inside the request");
    });

    expect(dest.lines.length).toBeGreaterThan(0);
    const parsed = JSON.parse(dest.lines[0]) as Record<string, unknown>;
    expect(parsed.requestId).toBe(REQUEST_ID);
  });
});
