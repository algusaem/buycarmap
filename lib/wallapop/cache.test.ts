import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCached, setCached } from "./cache";

describe("wallapop cache", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("returns null for a key that was never set", () => {
    expect(getCached("cache-miss-key")).toBeNull();
  });

  it("returns the stored value within the TTL", () => {
    setCached("k-fresh", { hello: "world" });
    vi.advanceTimersByTime(59_000);
    expect(getCached<{ hello: string }>("k-fresh")).toEqual({ hello: "world" });
  });

  it("expires the entry after 60s and returns null", () => {
    setCached("k-stale", [1, 2, 3]);
    vi.advanceTimersByTime(60_001);
    expect(getCached("k-stale")).toBeNull();
  });
});
