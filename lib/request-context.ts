import { AsyncLocalStorage } from "node:async_hooks";
import { headers } from "next/headers";

// PLAT-17 (docs/specs/core-platform.md): the correlation id proxy.ts assigns
// to every request travels through Server Actions and route handlers via this
// AsyncLocalStorage, so every log line written while handling a request
// carries its `requestId` without threading it through every function
// signature. Node-only — proxy.ts runs on the Edge and forwards the id as a
// header instead.

const storage = new AsyncLocalStorage<string>();

export function runWithRequestId<T>(id: string, fn: () => T): T {
  return storage.run(id, fn);
}

export function getRequestId(): string | undefined {
  return storage.getStore();
}

/**
 * Runs `fn` inside the request's correlation-id context, reading the id proxy.ts
 * forwarded as `x-request-id`.
 *
 * A request that bypasses the proxy (a static asset, the Sentry tunnel) has no
 * such header; `getRequestId()` then returns `undefined` inside `fn`, same as
 * outside any context. `headers()` also throws when called with no request in
 * scope at all — a Server Action invoked directly from a test or a script —
 * which is handled the same way rather than failing the call over logging
 * plumbing.
 */
export async function withRequestContext<T>(fn: () => Promise<T>): Promise<T> {
  let requestId: string | null = null;

  try {
    requestId = (await headers()).get("x-request-id");
  } catch {
    requestId = null;
  }

  if (!requestId) return fn();
  return runWithRequestId(requestId, fn);
}
