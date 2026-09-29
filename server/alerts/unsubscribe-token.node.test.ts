import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ env: { NEXTAUTH_SECRET: "test-signing-secret" } }));

import { hashUnsubscribeToken, unsubscribeTokenFor } from "./unsubscribe-token";

describe("unsubscribeTokenFor", () => {
  it("derives the same token every time for one alert", () => {
    // Derivation rather than storage is what makes the hashed column workable:
    // the runner sends the mail long after the alert was created and only ever
    // sees the hash, so a random token would have to be kept in the clear.
    expect(unsubscribeTokenFor("alert-1")).toBe(unsubscribeTokenFor("alert-1"));
  });

  it("derives a different token for a different alert", () => {
    // Otherwise one leaked link would unsubscribe everyone.
    expect(unsubscribeTokenFor("alert-1")).not.toBe(unsubscribeTokenFor("alert-2"));
  });

  it("does not embed the alert id, so a link cannot be forged from one", () => {
    const token = unsubscribeTokenFor("alert-abc123");

    expect(token).not.toContain("alert-abc123");
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("hashUnsubscribeToken", () => {
  it("stores something other than the token itself", () => {
    const token = unsubscribeTokenFor("alert-1");

    // The raw token exists only in the email, so a database leak yields
    // digests rather than working unsubscribe links.
    expect(hashUnsubscribeToken(token)).not.toBe(token);
    expect(hashUnsubscribeToken(token)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("maps a token to the same digest every time, so lookup works", () => {
    const token = unsubscribeTokenFor("alert-1");

    expect(hashUnsubscribeToken(token)).toBe(hashUnsubscribeToken(token));
  });

  it("maps different tokens to different digests", () => {
    expect(hashUnsubscribeToken(unsubscribeTokenFor("alert-1"))).not.toBe(
      hashUnsubscribeToken(unsubscribeTokenFor("alert-2")),
    );
  });
});
