import { afterEach, describe, expect, it, vi } from "vitest";

// docs/specs/core-integrations.md, INT-12. lib/platform/email.ts is a stub
// (every send throws "not implemented"), so every case below fails as an
// assertion. `resend` is not installed; mocked here as the brief allows,
// reported structurally below if vitest cannot register a mock for a module
// that resolves nowhere on disk.
vi.mock("resend", () => ({ Resend: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { logger } from "@/lib/logger";
import { sendEmail } from "./email";

const MESSAGE = {
  to: "ada@example.com",
  subject: "Reset your password",
  html: "<p>hello</p>",
  text: "hello",
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("sendEmail when RESEND_API_KEY or EMAIL_FROM is missing", () => {
  it("INT-12: no-ops and warns exactly once across two calls", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("EMAIL_FROM", "");
    vi.mocked(logger.warn).mockClear();

    await expect(sendEmail(MESSAGE)).resolves.toBe(false);
    await expect(sendEmail(MESSAGE)).resolves.toBe(false);

    expect(logger.warn).toHaveBeenCalledTimes(1);
  });
});

describe("sendEmail when Resend rejects the send", () => {
  it("INT-12: returns failure and logs the error's name and status, never the recipient", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("EMAIL_FROM", "BuyCarMap <no-reply@buycarmap.com>");
    vi.mocked(logger.error).mockClear();

    await expect(sendEmail(MESSAGE)).resolves.toBe(false);

    expect(logger.error).toHaveBeenCalledTimes(1);
    const loggedMeta = JSON.stringify(vi.mocked(logger.error).mock.calls[0]?.[0] ?? {});
    expect(loggedMeta).not.toContain(MESSAGE.to);
    expect(loggedMeta).toMatch(/name|status/i);
  });
});
