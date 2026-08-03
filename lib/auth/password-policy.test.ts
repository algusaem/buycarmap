import { beforeEach, describe, expect, it, vi } from "vitest";

// The breach check is a *dependency* of the policy, not the unit under test —
// its real HTTP behaviour is pinned in pwned.node.test.ts. Stubbing it here
// keeps this file about the one thing password-policy does: compose the local
// scorer and the breach corpus into a single verdict.
vi.mock("@/lib/auth/pwned", () => ({
  checkPasswordBreached: vi.fn(),
}));

import { checkPasswordBreached } from "@/lib/auth/pwned";
import { validateNewPassword } from "./password-policy";

// Scores 4 locally: 20 characters, no sequence, keyboard run or repeat.
const STRONG = "harbour-lentil-quilt";

const clean = { breached: false, occurrences: 0, checked: true };
const breached = { breached: true, occurrences: 19075998, checked: true };
// What an HIBP outage looks like: `checked: false` means "unknown", not "safe".
const unknown = { breached: false, occurrences: 0, checked: false };

describe("validateNewPassword", () => {
  beforeEach(() => {
    vi.mocked(checkPasswordBreached).mockReset();
    vi.mocked(checkPasswordBreached).mockResolvedValue(clean);
  });

  it("AUTH-3: accepts a strong password absent from the breach corpus", async () => {
    expect(await validateNewPassword(STRONG)).toBeNull();
  });

  it("rejects a blocklisted password without querying the breach API", async () => {
    // The local scorer collapses a blocklisted password to 0, below the
    // minimum of 2 — so the outbound request is never worth making.
    expect(await validateNewPassword("password")).toBe("passwordWeak");
    expect(checkPasswordBreached).not.toHaveBeenCalled();
  });

  it("rejects a strong-looking password that appears in a breach", async () => {
    // Length and unpredictability do not help once the exact string is sitting
    // in a credential-stuffing list.
    vi.mocked(checkPasswordBreached).mockResolvedValue(breached);

    expect(await validateNewPassword(STRONG)).toBe("passwordBreached");
  });

  it("AUTH-4: accepts the password when the breach API is unreachable", async () => {
    // Fails open on purpose: a third-party outage must not block signups. The
    // length rules and the local blocklist still applied above.
    vi.mocked(checkPasswordBreached).mockResolvedValue(unknown);

    expect(await validateNewPassword(STRONG)).toBeNull();
  });

  it("forwards the caller's own email and name into the scorer", async () => {
    // Without this the user's own address would sail through as a password —
    // the first thing a targeted attacker tries.
    expect(
      await validateNewPassword("ada-lovelace-1815", ["ada@example.com"]),
    ).toBe("passwordWeak");
    expect(checkPasswordBreached).not.toHaveBeenCalled();
  });

  it("still accepts a strong password when unrelated inputs are supplied", async () => {
    // Guards the check above against being satisfied by any non-empty
    // userInputs array rather than by an actual match.
    expect(await validateNewPassword(STRONG, ["ada@example.com"])).toBeNull();
  });
});
