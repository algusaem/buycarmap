import { useState } from "react";
import { AUTH_ERROR, type AuthErrorCode, refusalCode } from "@/lib/auth/errors";
import { type ActionResult, settleAction } from "@/lib/auth/settle-action";

// docs/specs/redesign-pages.md (PAGES-2, PAGES-4, PAGES-13 to PAGES-19): the
// request lifecycle of a page that redeems an emailed token with one button —
// /verify-email (verifyRegistration) and /confirm-email (confirmEmail). A
// button rather than a redemption on load (PAGES-14): mail scanners fetch
// every link in an inbox and would burn the token before the user arrives.
// Success gives way to the confirmed state, `tokenInvalid` to the
// expired-link state, and any other refusal stays on the form as its alert's
// code; the button is busy while the request runs.

type TokenConfirmationState = "confirm" | "confirmed" | "expired";

export function useTokenConfirmation(
  token: string,
  action: (formData: FormData) => Promise<ActionResult>,
) {
  const [state, setState] = useState<TokenConfirmationState>("confirm");
  const [busy, setBusy] = useState(false);
  // PAGES-4: a refusal that belongs to no field, shown above the button.
  const [error, setError] = useState<AuthErrorCode | null>(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);

    const formData = new FormData();
    formData.append("token", token);
    const result = await settleAction(() => action(formData));
    setBusy(false);

    if (result.success) {
      setState("confirmed");
      return;
    }
    if (result.error === AUTH_ERROR.tokenInvalid) {
      setState("expired");
      return;
    }
    setError(refusalCode(result.error));
  };

  return { state, busy, error, confirm };
}
