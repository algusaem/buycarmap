import { describe, expect, it } from "vitest";
import { requestPasswordReset } from "./forgot-password";

function formData(fields: Record<string, string | undefined>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) fd.set(key, value);
  }
  return fd;
}

describe("requestPasswordReset action", () => {
  it("returns a generic success for a well-formed email", async () => {
    const result = await requestPasswordReset(
      formData({ email: "ada@example.com" }),
    );
    expect(result).toEqual({ success: true });
  });

  it("returns success regardless of the address (no account enumeration)", async () => {
    // The action must not reveal whether an account exists — an unknown but
    // valid email gets the same generic success as a known one.
    const result = await requestPasswordReset(
      formData({ email: "nobody-here@example.com" }),
    );
    expect(result).toEqual({ success: true });
  });

  it("rejects a malformed email with the schema's message", async () => {
    const result = await requestPasswordReset(formData({ email: "nope" }));
    expect(result).toEqual({
      success: false,
      error: "Invalid email address",
    });
  });

  it("rejects an empty email as required", async () => {
    // The form always submits the field, so the empty case is a blank string.
    const result = await requestPasswordReset(formData({ email: "" }));
    expect(result).toEqual({ success: false, error: "Email is required" });
  });
});
