import * as Sentry from "@sentry/nextjs";
import { env } from "@/lib/env";
import { PRIVATE_DATA_COLLECTION } from "@/lib/sentry-privacy";

// PLAT-18 (docs/specs/core-platform.md): Sentry is inert without a DSN — this
// never sends anything locally or in tests. Split per runtime with a dynamic
// import rather than a static one, so lib/sentry.ts — which pulls in
// lib/request-context.ts's `node:async_hooks` — is never bundled into the
// Edge runtime (proxy.ts and Edge API routes).
//
// `process.env.NEXT_RUNTIME` is read literally here rather than through
// lib/env.ts (PLAT-4/PLAT-5 elsewhere routes every read through it): Next's
// own bundler only recognises this literal expression to eliminate the
// "nodejs" branch — and lib/sentry.ts with it — from the Edge bundle.
// Wrapping it in a helper defeated that analysis and left the warning below
// wired into the Edge Instrumentation, confirmed against a real dev build:
//
//   ⚠ ./lib/request-context.ts:1:1 — A Node.js module is loaded
//   ('node:async_hooks') which is not supported in the Edge Runtime.
//   Import trace: Edge Instrumentation → lib/request-context.ts →
//   lib/sentry.ts → instrumentation.ts
//
// This is the one exception PLAT-4's test does not account for.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { sentryOptions } = await import("@/lib/sentry");
    const options = sentryOptions(env.SENTRY_DSN);

    if (options) {
      Sentry.init({
        dsn: options.dsn,
        tracesSampleRate: options.tracesSampleRate,
        dataCollection: PRIVATE_DATA_COLLECTION,
        beforeSend: options.beforeSend,
      });
    }
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    // No request-id tag here: that needs lib/request-context.ts, which is
    // Node-only.
    if (env.SENTRY_DSN) {
      Sentry.init({
        dsn: env.SENTRY_DSN,
        tracesSampleRate: 0,
        dataCollection: PRIVATE_DATA_COLLECTION,
      });
    }
  }
}

export const onRequestError = Sentry.captureRequestError;
