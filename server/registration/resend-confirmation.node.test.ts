import { beforeEach, describe, expect, it, vi } from "vitest";

// TEST-7 (docs/specs/core-testing.md): every other case in this file moved to
// ./resend-confirmation.integration.test.ts. These two never reach the
// database — a malformed email is rejected by the schema before any lookup,
// and the rate limit is checked before it — so this file no longer mocks
// @/lib/db/prisma.

vi.mock("@/server/rate-limit/service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/rate-limit/service")>()),
  getClientIp: vi.fn(async () => "203.0.113.1"),
  consumeRateLimit: vi.fn(async () => ({
    allowed: true,
    remaining: 3,
    retryAfterMs: 0,
  })),
}));
vi.mock("@/lib/email/client", () => ({ sendEmail: vi.fn(async () => true) }));

import { sendEmail } from "@/lib/email/client";
import { consumeRateLimit } from "@/server/rate-limit/service";
import { resendConfirmation } from "./actions";

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

beforeEach(() => {
  vi.mocked(sendEmail).mockClear();
  vi.mocked(consumeRateLimit).mockResolvedValue({
    allowed: true,
    remaining: 3,
    retryAfterMs: 0,
  });
});

describe("resendConfirmation", () => {
  it("refuses once the rate limit is spent", async () => {
    vi.mocked(consumeRateLimit).mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfterMs: 60_000,
    });

    expect(await resendConfirmation(formData({ email: "ada@example.com" }))).toEqual({
      success: false,
      error: "rateLimited",
    });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("rejects a malformed email", async () => {
    expect(await resendConfirmation(formData({ email: "nope" }))).toEqual({
      success: false,
      error: "emailInvalid",
    });
  });
});
