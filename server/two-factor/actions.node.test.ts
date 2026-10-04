import { describe, expect, it, vi } from "vitest";

// TEST-7 (docs/specs/core-testing.md): every other case in this file moved to
// ./actions.integration.test.ts. This is the only one that never reaches the
// database — getCurrentUser returning null short-circuits before any query —
// so this file no longer mocks @/lib/db/prisma.

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn() }));

import { getCurrentUser } from "@/lib/auth/session";
import { startTwoFactorSetup } from "./actions";

describe("startTwoFactorSetup", () => {
  it("refuses without a session", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    expect(await startTwoFactorSetup(new FormData())).toEqual({
      success: false,
      error: "unauthorized",
    });
  });
});
