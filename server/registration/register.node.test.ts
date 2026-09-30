import { beforeEach, describe, expect, it, vi } from "vitest";

// TEST-7 (docs/specs/core-testing.md): every other case in this file moved to
// ./register.integration.test.ts. These three never reach @/lib/db/prisma —
// password validation happens before any lookup — so that mock is gone. The
// rate-limit mock stays: register() consumes it before validation runs, and
// server/rate-limit/service.ts itself queries Prisma, so leaving it real
// would make these "no database" cases open a connection anyway.
vi.mock("@/server/rate-limit/service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/rate-limit/service")>()),
  getClientIp: vi.fn(async () => "203.0.113.1"),
  consumeRateLimit: vi.fn(async () => ({
    allowed: true,
    remaining: 4,
    retryAfterMs: 0,
  })),
}));

import { register } from "./actions";

const valid = {
  name: "Ada",
  email: "ada@example.com",
  password: "harbour-lentil-quilt",
  confirmPassword: "harbour-lentil-quilt",
};

function formData(fields: Record<string, string | undefined>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) fd.set(key, value);
  }
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("register input validation", () => {
  it("rejects mismatched passwords without touching the database", async () => {
    const result = await register(formData({ ...valid, confirmPassword: "different" }));

    expect(result).toEqual({
      success: false,
      error: "passwordsDoNotMatch",
    });
  });

  it("rejects a password below the 12-character minimum", async () => {
    const short = "harbour1";

    expect(await register(formData({ ...valid, password: short, confirmPassword: short }))).toEqual(
      { success: false, error: "passwordTooShort" },
    );
  });

  it("rejects a long-but-trivial password on strength grounds", async () => {
    // Passes the length rule at 16 characters, but is a keyboard run — exactly
    // the case a length-only policy would wave through.
    const weak = "qwertyuiopasdfgh";

    expect(await register(formData({ ...valid, password: weak, confirmPassword: weak }))).toEqual({
      success: false,
      error: "passwordWeak",
    });
  });
});
