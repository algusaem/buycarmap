import { getRequestId } from "@/lib/request-context";
import { PRIVATE_DATA_COLLECTION } from "@/lib/sentry-privacy";

// PLAT-18 (docs/specs/core-platform.md): the DSN-gated options every Sentry
// initialisation site (instrumentation.ts, instrumentation-client.ts) starts
// from. This module is Node-only — it pulls in lib/request-context.ts, which
// uses `node:async_hooks` — so the client bundle must not import it; see
// instrumentation-client.ts, which builds its own options inline instead.

interface SentryIntegration {
  name?: string;
}

interface SentryEventLike {
  tags?: Record<string, unknown>;
}

export interface SentryOptions {
  dsn: string;
  tracesSampleRate: number;
  dataCollection: typeof PRIVATE_DATA_COLLECTION;
  integrations?: SentryIntegration[];
  beforeSend: <T extends SentryEventLike>(event: T) => T;
}

/** Inert without a DSN: nothing is sent, and nothing is initialised. */
export function sentryOptions(dsn: string | undefined): SentryOptions | undefined {
  if (!dsn) return undefined;

  return {
    dsn,
    tracesSampleRate: 0,
    dataCollection: PRIVATE_DATA_COLLECTION,
    beforeSend(event) {
      event.tags = { ...event.tags, ...requestIdTag() };
      return event;
    },
  };
}

/** The correlation id as a Sentry tag, or nothing outside a request. */
export function requestIdTag(): Record<string, string> {
  const requestId = getRequestId();
  return requestId ? { request_id: requestId } : {};
}
