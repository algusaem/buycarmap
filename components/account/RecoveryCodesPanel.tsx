"use client";

import { useState } from "react";
import { toast } from "sonner";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n/client";

interface RecoveryCodesPanelProps {
  codes: string[];
  onDismiss: () => void;
}

/**
 * Shows recovery codes once, at the only moment they exist in plaintext.
 *
 * The server stores digests, so there is no "show them again" — dismissing is
 * irreversible, which is why the warning is prominent and the dismiss button
 * is worded as an acknowledgement rather than a close.
 */
export function RecoveryCodesPanel({ codes, onDismiss }: RecoveryCodesPanelProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      toast.success(t.account.twoFactor.copied);
    } catch {
      // Clipboard access is denied outright by some browsers and blocked
      // outside secure contexts. The codes are on screen either way, so tell
      // the user to copy them by hand.
      toast.error(t.account.twoFactor.copyFailed);
    } finally {
      // Unblocked regardless of whether the copy worked. Gating this on
      // success trapped anyone whose browser refuses clipboard access on a
      // panel that, by design, is never shown again.
      setCopied(true);
    }
  };

  return (
    <div className="space-y-4" aria-live="polite">
      <div className="space-y-1">
        <h3 className="font-semibold">{t.account.twoFactor.recoveryTitle}</h3>
        <p className="text-sm text-muted-foreground">{t.account.twoFactor.recoveryDescription}</p>
      </div>

      <p className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-muted-foreground">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        {t.account.twoFactor.recoveryWarning}
      </p>

      <ul className="grid grid-cols-1 gap-1 rounded-md border border-border/50 bg-background/50 p-3 font-mono text-sm sm:grid-cols-2">
        {codes.map((code) => (
          <li key={code} className="tabular-nums">
            {code}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCopy}>
          {t.account.twoFactor.copyCodes}
        </Button>
        {/* Enabled only after copying, so the codes cannot be dismissed by
            reflex before they have been saved anywhere. */}
        <Button type="button" size="sm" disabled={!copied} onClick={onDismiss}>
          {t.account.twoFactor.recoveryDone}
        </Button>
      </div>
    </div>
  );
}
