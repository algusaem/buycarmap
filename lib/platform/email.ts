// The Resend SDK adapter (docs/decisions/0007-adopt-core-rules.md row 24;
// docs/specs/core-integrations.md, INT-12). The only module that imports
// `resend` — every caller goes through `sendEmail`.

import { Resend } from "resend";
import { liveEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

// PLAT-2 (docs/specs/core-platform.md): fires once per process, the first
// time a send actually needs the configuration — never at import time.
let warnedNotConfigured = false;

/**
 * Sends an email through Resend. Never throws.
 *
 * Callers are auth flows whose responses must not vary with account existence;
 * letting a provider error bubble up would turn "did the send succeed?" into an
 * account-enumeration oracle. Failures are logged for operators instead.
 *
 * Returns whether the send actually happened, for tests and logging — callers
 * in enumeration-sensitive paths must ignore the result.
 */
export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  // A live read, not `lib/env.ts`'s `env`: that module's `createEnv` output
  // is resolved once at import time, so a test that `vi.stubEnv`s these per
  // test (as this module's own tests do) would never be seen through it.
  const apiKey = liveEnv("RESEND_API_KEY");
  const from = liveEnv("EMAIL_FROM");

  if (!apiKey || !from) {
    // Not an error: email is optional configuration. Loud enough that nobody
    // wonders why the reset link never arrived in a fresh environment.
    if (!warnedNotConfigured) {
      warnedNotConfigured = true;
      logger.warn(
        { subject: input.subject },
        "RESEND_API_KEY/EMAIL_FROM not set — emails are skipped. See .env.example.",
      );
    }
    return false;
  }

  try {
    const result = await new Resend(apiKey).emails.send({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });

    if (result.error) {
      logger.error(
        { err: { name: result.error.name ?? null, statusCode: result.error.statusCode ?? null } },
        `Resend rejected "${input.subject}"`,
      );
      return false;
    }

    return true;
  } catch (error) {
    const err = error as { name?: string; statusCode?: number };
    logger.error(
      { err: { name: err?.name ?? null, statusCode: err?.statusCode ?? null } },
      `Failed to send "${input.subject}"`,
    );
    return false;
  }
}
