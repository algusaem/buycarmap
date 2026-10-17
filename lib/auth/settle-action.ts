import * as Sentry from "@sentry/nextjs";
import { AUTH_ERROR, type AuthErrorCode } from "./errors";

/** The shape every auth and account Server Action answers with. */
export interface ActionResult {
  success: boolean;
  error?: AuthErrorCode;
}

/**
 * What a thrown action reads as: the `generic` refusal, marked `thrown` for
 * the one form whose own `generic` answer means something else (/login's
 * wrong credentials, which must not read as a dropped request).
 */
export interface ActionRefusal {
  success: false;
  error: AuthErrorCode;
  thrown: true;
}

/**
 * docs/specs/redesign-pages.md (PAGES-2, PAGES-4, PAGES-71): runs a Server
 * Action from a form or a button of the access and account pages. An action
 * that throws instead of answering (the network dropped, the server crashed)
 * is reported to Sentry and reads as the `generic` refusal, so the caller's
 * busy state always ends and the form or the toast says what happened.
 */
export async function settleAction<T extends ActionResult>(
  request: () => Promise<T>,
): Promise<T | ActionRefusal> {
  try {
    return await request();
  } catch (error) {
    Sentry.captureException(error);
    return { success: false, error: AUTH_ERROR.generic, thrown: true };
  }
}
