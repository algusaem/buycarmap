"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { Translations } from "@/lib/i18n/types";
import {
  evaluatePassword,
  type PasswordIssue,
  type PasswordScore,
} from "@/lib/auth/password-strength";

interface PasswordStrengthMeterProps {
  password: string;
  /** Email and name, so the meter can flag a password built from them. */
  userInputs?: string[];
}

// Stable ids for the strength-meter segments, so React keys don't depend on
// array position (the segment count never changes at runtime).
const SEGMENT_IDS = ["segment-1", "segment-2", "segment-3", "segment-4"] as const;

// Amber is the brand's "good"; eucalyptus marks the top band so "strong" reads
// as distinct from "good" rather than just more of the same colour.
const SCORE_FILL: Record<PasswordScore, string> = {
  0: "bg-destructive",
  1: "bg-destructive",
  2: "bg-primary/60",
  3: "bg-primary",
  4: "bg-accent",
};

const SCORE_TEXT: Record<PasswordScore, string> = {
  0: "text-destructive",
  1: "text-destructive",
  2: "text-muted-foreground",
  3: "text-primary",
  4: "text-accent",
};

const SCORE_LABEL_KEY: Record<PasswordScore, keyof Translations["passwordStrength"]["scores"]> = {
  0: "veryWeak",
  1: "weak",
  2: "fair",
  3: "good",
  4: "strong",
};

// A filled bar count of 1 at score 0 keeps the control visible rather than
// rendering as an empty, ambiguous track.
function filledSegments(score: PasswordScore): number {
  return Math.max(1, score);
}

function Segment({ active, score }: { active: boolean; score: PasswordScore }) {
  return (
    <span
      className={`h-1 flex-1 rounded-full transition-colors ${
        active ? SCORE_FILL[score] : "bg-border"
      }`}
    />
  );
}

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

  const filled = filledSegments(score);
  const label = t(`passwordStrength.scores.${SCORE_LABEL_KEY[score]}`);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1" aria-hidden="true">
        {SEGMENT_IDS.map((id, index) => (
          <Segment key={id} active={index < filled} score={score} />
        ))}
      </div>

      {/* The bar is decorative; this line carries the same information as text
          so strength is never communicated by colour alone. */}
      <p className="flex items-center justify-between gap-2 text-xs" aria-live="polite">
        <span className="text-muted-foreground">{t("passwordStrength.label")}</span>
        <span className={`font-medium ${SCORE_TEXT[score]}`}>{label}</span>
      </p>

      {issues.length > 0 && (
        <ul className="space-y-0.5">
          {issues.map((issue: PasswordIssue) => (
            <li key={issue} className="text-xs text-muted-foreground">
              {t(`passwordStrength.issues.${issue}`)}
            </li>
          ))}
        </ul>
      )}

      {issues.length === 0 && score < 3 && (
        <p className="text-xs text-muted-foreground">{t("passwordStrength.hint")}</p>
      )}
    </div>
  );
}
