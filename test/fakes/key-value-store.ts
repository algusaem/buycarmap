import { vi } from "vitest";
import type { SharedKeyValueStore } from "@/lib/platform/rate-limit";

// In-memory stand-in for the Upstash client as `lib/platform/rate-limit.ts`'s
// `sharedKeyValueStore` hands it out (docs/specs/alerts.md, ALERT-51 to
// ALERT-55). It keeps each key's value and the expiry it was written with, so
// a test can read both back; it never expires anything by itself.

export function createKeyValueStoreFake() {
  const values = new Map<string, number>();
  const expiries = new Map<string, number>();

  const store = {
    get: vi.fn(async (key: string): Promise<unknown> => values.get(key) ?? null),
    set: vi.fn(async (key: string, value: number, options: { pxat: number }): Promise<unknown> => {
      values.set(key, value);
      expiries.set(key, options.pxat);
      return "OK";
    }),
  } satisfies SharedKeyValueStore;

  return { store, values, expiries };
}
