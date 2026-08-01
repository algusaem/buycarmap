import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";

// `isEmailConfigured` is computed when lib/env.ts is first imported, so each
// test resets the module registry and re-imports with the environment it needs.
async function loadClient() {
  vi.resetModules();
  return import("./client");
}

const MESSAGE = {
  to: "ada@example.com",
  subject: "Reset your password",
  html: "<p>hello</p>",
  text: "hello",
};

beforeEach(() => {
  vi.stubEnv("RESEND_API_KEY", "re_test_key");
  vi.stubEnv("EMAIL_FROM", "BuyCarMap <no-reply@buycarmap.com>");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("sendEmail when configured", () => {
  it("posts the message to Resend with the API key", async () => {
    let authorization: string | null = null;
    let body: Record<string, unknown> = {};

    server.use(
      http.post("https://api.resend.com/emails", async ({ request }) => {
        authorization = request.headers.get("Authorization");
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: "msg_1" });
      }),
    );

    const { sendEmail } = await loadClient();

    expect(await sendEmail(MESSAGE)).toBe(true);
    expect(authorization).toBe("Bearer re_test_key");
    expect(body).toEqual({
      from: "BuyCarMap <no-reply@buycarmap.com>",
      to: ["ada@example.com"],
      subject: "Reset your password",
      html: "<p>hello</p>",
      text: "hello",
    });
  });

  it("reports failure without throwing when Resend rejects the request", async () => {
    server.use(
      http.post("https://api.resend.com/emails", () =>
        HttpResponse.json({ message: "invalid from address" }, { status: 422 }),
      ),
    );

    const { sendEmail } = await loadClient();

    // Throwing would let a mail failure become an account-enumeration oracle
    // in the reset flow, where the response must not vary by account.
    await expect(sendEmail(MESSAGE)).resolves.toBe(false);
  });

  it("reports failure without throwing when the network errors", async () => {
    server.use(
      http.post("https://api.resend.com/emails", () => HttpResponse.error()),
    );

    const { sendEmail } = await loadClient();

    await expect(sendEmail(MESSAGE)).resolves.toBe(false);
  });
});

describe("sendEmail when not configured", () => {
  it("no-ops without making a request", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("EMAIL_FROM", "");

    let called = false;
    server.use(
      http.post("https://api.resend.com/emails", () => {
        called = true;
        return HttpResponse.json({ id: "msg_1" });
      }),
    );

    const { sendEmail } = await loadClient();

    // Email is optional configuration, so a fresh environment must not crash
    // the request that triggered the send.
    expect(await sendEmail(MESSAGE)).toBe(false);
    expect(called).toBe(false);
  });

  it("treats a key without a from-address as unconfigured", async () => {
    vi.stubEnv("EMAIL_FROM", "");

    const { sendEmail } = await loadClient();

    // Resend rejects a send with no `from`; better to skip than to fail.
    expect(await sendEmail(MESSAGE)).toBe(false);
  });
});
