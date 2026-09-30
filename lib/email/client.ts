import { isEmailConfigured } from "@/lib/app-config";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

// Thin wrapper over Resend's REST API.
//
// Called with plain `fetch` rather than the `resend` SDK on purpose: the API is
// a single POST, the SDK would add a dependency for nothing, and going through
// fetch means MSW can intercept it in tests like every other outbound call in
// this codebase (house rule: never hand-stub fetch).
//
// Features must go through this module rather than calling Resend directly,
// mirroring the lib/wallapop/* client pattern.

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const REQUEST_TIMEOUT_MS = 10000;

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

// PLAT-2 (docs/specs/core-platform.md): these used to be console warnings
// printed from lib/env.ts at import time. They now fire from here, once per
// process, the first time a send actually needs them — lib/env.ts itself
// never calls console or the logger.
let warnedNotConfigured = false;
let warnedSandboxSender = false;

/**
 * Sends an email. Never throws.
 *
 * Callers are auth flows whose responses must not vary with account existence;
 * letting a provider error bubble up would turn "did the send succeed?" into an
 * account-enumeration oracle. Failures are logged for operators instead.
 *
 * Returns whether the send actually happened, for tests and logging — callers
 * in enumeration-sensitive paths must ignore the result.
 */
export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  if (!isEmailConfigured) {
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

  // Resend's sandbox sender only delivers to the address the Resend account
  // was registered under. In production that is a silent trap: registration
  // becomes verify-first the moment email is "configured", so every real user
  // would be told to check an inbox that never receives anything.
  const usesSandboxSender = env.NODE_ENV === "production" && env.EMAIL_FROM?.includes("resend.dev");
  if (usesSandboxSender && !warnedSandboxSender) {
    warnedSandboxSender = true;
    logger.warn(
      {},
      "EMAIL_FROM uses Resend's sandbox sender (resend.dev), which only delivers to your own Resend account address. Verify a domain at resend.com/domains.",
    );
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      logger.error(
        { status: response.status, body: await response.text() },
        `Resend rejected "${input.subject}"`,
      );
      return false;
    }

    return true;
  } catch (error) {
    logger.error({ err: error }, `Failed to send "${input.subject}"`);
    return false;
  }
}
