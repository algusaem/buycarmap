import { beforeEach, describe, expect, it, vi } from "vitest";

const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException }));

import { settleAction } from "./settle-action";

// docs/specs/redesign-pages.md (PAGES-4, PAGES-71): an action that throws
// reads as the `generic` refusal and reaches Sentry; an answer passes through.
describe("settleAction", () => {
  beforeEach(() => captureException.mockClear());

  it("PAGES-4: passes an action's own answer through untouched", async () => {
    const answer = { success: false, error: "rateLimited" as const };

    await expect(settleAction(async () => answer)).resolves.toBe(answer);
    expect(captureException).not.toHaveBeenCalled();
  });

  it("PAGES-71: a thrown action reads as the generic refusal and is reported", async () => {
    const error = new Error("network down");

    await expect(
      settleAction(async () => {
        throw error;
      }),
    ).resolves.toEqual({ success: false, error: "generic", thrown: true });
    expect(captureException).toHaveBeenCalledWith(error);
  });
});
