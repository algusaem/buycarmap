import { AUTH_ERROR, type AuthErrorCode } from "@/lib/auth/errors";
import { evaluatePassword } from "@/lib/auth/password-strength";
import { checkPasswordBreached } from "@/lib/auth/pwned";

// Server-side gate for any password a user is *setting* (register, reset,
// change). The Zod schemas only enforce length because these two checks are
// async; both must run on the server regardless of what the client meter said,
// since the meter is just a hint and trivially bypassed.

// Score 2 of 4. Below this a password is guessable by an offline attacker in
// reasonable time even at bcrypt cost 12.
const MIN_ACCEPTABLE_SCORE = 2;

export async function validateNewPassword(
  password: string,
  userInputs: readonly string[] = [],
): Promise<AuthErrorCode | null> {
  // Local heuristics first — free, and they reject the obvious cases without
  // an outbound request.
  const { score } = evaluatePassword(password, userInputs);

  if (score < MIN_ACCEPTABLE_SCORE) {
    return AUTH_ERROR.passwordWeak;
  }

  // A strong-looking password can still be in a breach corpus verbatim, which
  // makes it worthless against credential stuffing.
  const { breached } = await checkPasswordBreached(password);

  if (breached) {
    return AUTH_ERROR.passwordBreached;
  }

  return null;
}
