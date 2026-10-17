"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { Translations } from "@/lib/i18n/types";
import { cn } from "@/lib/utils";
import {
  evaluatePassword,
  type PasswordIssue,
  type PasswordScore,
} from "@/lib/auth/password-strength";

interface PasswordStrengthMeterProps {
  password: string;
  /** The email, so the meter can flag a password built from it. */
  userInputs?: string[];
}

// Stable ids for the strength-meter segments, so React keys don't depend on
// array position (the segment count never changes at runtime).
const SEGMENT_IDS = ["segment-1", "segment-2", "segment-3", "segment-4"] as const;

const SCORE_LABEL_KEY: Record<PasswordScore, keyof Translations["passwordStrength"]["scores"]> = {
  0: "veryWeak",
  1: "weak",
  2: "fair",
  3: "good",
  4: "strong",
};

// docs/design/system/components/PasswordField/README.md and
// docs/specs/redesign-pages.md (PAGES-5): four 4px segments 6px apart, the
// ones the score has passed in `lime` and the rest in `line` — none for
// «muy débil», all four for «muy buena» — then, 6px under them, one line
// «Seguridad: <nivel>» in 12px `text-muted`, then what fails, one line per
// issue, or the hint when nothing fails under «buena». It is a hint: it never
// blocks submit, the server's policy decides (AUTH-3). Mounted 10px under its
// field, or under the field's error when the server rejected the password.
export function PasswordStrengthMeter({ password, userInputs = [] }: PasswordStrengthMeterProps) {
  const t = useTranslations();

  // Re-scoring on every keystroke is cheap, but the dependency on a joined
  // string keeps the array identity from busting the memo each render.
  const joinedInputs = userInputs.join("\u0000");
  const { score, issues } = useMemo(
    () => evaluatePassword(password, joinedInputs.split("\u0000")),
    [password, joinedInputs],
  );

  if (!password) return null;

  const level = t(`passwordStrength.scores.${SCORE_LABEL_KEY[score]}`);

  return (
    <div className="mt-0.5 flex flex-col gap-1.5 text-caption text-text-muted">
      <div className="flex gap-1.5" aria-hidden="true">
        {SEGMENT_IDS.map((id, index) => (
          <span
            key={id}
            className={cn(
              "h-1 flex-1 rounded-pill transition-colors",
              index < score ? "bg-lime" : "bg-line",
            )}
          />
        ))}
      </div>

      {/* The bar is decorative; this line carries the same information as
          text, so strength is never communicated by colour alone. */}
      <p className="m-0" aria-live="polite">
        {t.rich("passwordStrength.label", {
          level,
          // One message, so a translation places the level where its grammar wants it.
          strong: (chunks) => <strong className="font-bold text-text">{chunks}</strong>,
        })}
      </p>

      {issues.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {issues.map((issue: PasswordIssue) => (
            <li key={issue}>{t(`passwordStrength.issues.${issue}`)}</li>
          ))}
        </ul>
      )}

      {issues.length === 0 && score < 3 && <p className="m-0">{t("passwordStrength.hint")}</p>}
    </div>
  );
}
