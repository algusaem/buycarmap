import { describe, expect, it } from "vitest";
import { createLogger, logger, type LogDestination } from "./logger";

// PLAT-15 worked example (docs/specs/core-platform.md):
//   createLogger(dest).info({ user: { email: "ana@example.test" }, token: "abc" }, "x")
//   -> the line carries "email":"[Redacted]" and "token":"[Redacted]"

function makeDestination(): LogDestination & { lines: string[] } {
  const lines: string[] = [];
  return {
    lines,
    write(line: string) {
      lines.push(line);
    },
  };
}

describe("logger under Vitest", () => {
  it("PLAT-15: the shared logger is silent under Vitest", () => {
    expect(logger.level).toBe("silent");
  });
});

describe("createLogger redaction", () => {
  it("PLAT-15: redacts a nested email and a top-level token", () => {
    const dest = makeDestination();
    const log = createLogger(dest);

    log.info({ user: { email: "ana@example.test" }, token: "abc" }, "x");

    expect(dest.lines.length).toBeGreaterThan(0);
    const parsed = JSON.parse(dest.lines[0]) as Record<string, unknown>;
    expect((parsed.user as Record<string, unknown>).email).toBe("[Redacted]");
    expect(parsed.token).toBe("[Redacted]");
  });

  it("PLAT-15: redacts password", () => {
    const dest = makeDestination();
    const log = createLogger(dest);

    log.info({ password: "hunter2" }, "x");

    expect(dest.lines.length).toBeGreaterThan(0);
    const parsed = JSON.parse(dest.lines[0]) as Record<string, unknown>;
    expect(parsed.password).toBe("[Redacted]");
  });

  it("PLAT-15: redacts headers.authorization and headers.cookie, not the rest of headers", () => {
    const dest = makeDestination();
    const log = createLogger(dest);

    log.info(
      {
        headers: { authorization: "Bearer secret", cookie: "session=abc", "user-agent": "vitest" },
      },
      "x",
    );

    expect(dest.lines.length).toBeGreaterThan(0);
    const parsed = JSON.parse(dest.lines[0]) as Record<string, unknown>;
    const headers = parsed.headers as Record<string, unknown>;
    expect(headers.authorization).toBe("[Redacted]");
    expect(headers.cookie).toBe("[Redacted]");
    expect(headers["user-agent"]).toBe("vitest");
  });

  it("PLAT-15: leaves an unrelated field untouched", () => {
    const dest = makeDestination();
    const log = createLogger(dest);

    log.info({ requestId: "0f8f2b1e-6a3c-4c1e-9d7a-2b5e8f1c3a4d" }, "x");

    expect(dest.lines.length).toBeGreaterThan(0);
    const parsed = JSON.parse(dest.lines[0]) as Record<string, unknown>;
    expect(parsed.requestId).toBe("0f8f2b1e-6a3c-4c1e-9d7a-2b5e8f1c3a4d");
  });
});
