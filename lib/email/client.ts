import { env, isEmailConfigured } from "@/lib/env";

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
    console.warn(
      `[email] RESEND_API_KEY/EMAIL_FROM not set — skipped "${input.subject}". See .env.example.`,
    );
    return false;
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
      console.error(
        `[email] Resend rejected "${input.subject}" with ${response.status}: ${await response.text()}`,
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error(`[email] Failed to send "${input.subject}"`, error);
    return false;
  }
}
