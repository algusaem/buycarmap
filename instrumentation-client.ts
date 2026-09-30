import * as Sentry from "@sentry/nextjs";
import { env } from "@/lib/env";
import { PRIVATE_DATA_COLLECTION } from "@/lib/sentry-privacy";

// PLAT-18 (docs/specs/core-platform.md): the browser half of Sentry
// initialisation. Deliberately does not import lib/sentry.ts — that module
// pulls in lib/request-context.ts's `node:async_hooks` for the request-id
// tag, which has no meaning in the browser and must not reach this bundle —
// so the options are built inline here instead.
if (env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0,
    dataCollection: PRIVATE_DATA_COLLECTION,
  });
}
