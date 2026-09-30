import pino from "pino";
import { env } from "@/lib/env";
import { getRequestId } from "@/lib/request-context";

// PLAT-15/16 (docs/specs/core-platform.md): the one Pino logger every
// `console.*` call in app/, components/, lib/ and server/ is replaced by.
// JSON in production, pino-pretty in development, silent under Vitest.

export interface LogDestination {
  write(line: string): void;
}

export type Logger = pino.Logger;

// Values that must never reach a log line, wherever in the payload they show
// up — a leaked password or token is a credential, not diagnostic data.
const REDACT_PATHS = [
  "password",
  "*.password",
  "token",
  "*.token",
  "email",
  "*.email",
  "secret",
  "*.secret",
  "code",
  "*.code",
  "headers.authorization",
  "headers.cookie",
];

/**
 * Builds a Pino logger.
 *
 * A `destination` is for tests: it captures the written lines so redaction and
 * the request-id mixin can be asserted directly, and — because the point of
 * passing one is to inspect what was logged — it is never silenced, even under
 * Vitest. The shared `logger` below has no destination, so it follows the
 * normal env-based level.
 */
export function createLogger(destination?: LogDestination): Logger {
  const level = destination ? "info" : env.NODE_ENV === "test" ? "silent" : "info";

  const options: pino.LoggerOptions = {
    level,
    redact: { paths: REDACT_PATHS, censor: "[Redacted]" },
    // Every log line written inside a request carries its correlation id
    // (PLAT-17), without every call site having to pass it explicitly.
    mixin() {
      const requestId = getRequestId();
      return requestId ? { requestId } : {};
    },
    ...(env.NODE_ENV === "development" && !destination
      ? { transport: { target: "pino-pretty" } }
      : {}),
  };

  return destination ? pino(options, destination) : pino(options);
}

export const logger: Logger = createLogger();
