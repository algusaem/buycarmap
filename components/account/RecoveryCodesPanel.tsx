"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { FieldMessage } from "@/components/auth/FieldMessage";
import { Button } from "@/components/ui/button";
import { focusOnMount } from "@/lib/focus";
import { AccountDialogTitle } from "./AccountDialog";

interface RecoveryCodesPanelProps {
  codes: string[];
  onDismiss: () => void;
}

/**
 * Shows recovery codes once, at the only moment they exist in plaintext
 * (docs/specs/redesign-pages.md, PAGES-45, PAGES-46; BAUTH-11;
 * F7-cuenta-dos-pasos › Códigos de recuperación). The server stores digests,
 * so there is no "show them again": the panel is an alertdialog with no
 * «Cancelar» that Escape and a press outside do not close, and «Ya los he
 * guardado», worded as an acknowledgement, is the only way out. The focus
 * starts on «Copiar códigos» (PAGES-73).
 */
export function RecoveryCodesPanel({ codes, onDismiss }: RecoveryCodesPanelProps) {
  const t = useTranslations();
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      toast.success(t("account.twoFactor.copied"));
    } catch {
      // Clipboard access is denied outright by some browsers and blocked
      // outside secure contexts. The codes are on screen either way, so tell
      // the user to copy them by hand.
      toast.error(t("account.twoFactor.copyFailed"));
    } finally {
      // Unblocked regardless of whether the copy worked. Gating this on
      // success trapped anyone whose browser refuses clipboard access on a
      // panel that, by design, is never shown again.
      setCopied(true);
    }
  };

  const onSaved = () => {
    if (!copied) return;
    onDismiss();
  };

  return (
    <>
      <AccountDialogTitle>{t("account.twoFactor.recoveryTitle")}</AccountDialogTitle>
      <p className="m-0 text-meta leading-normal text-text-muted">
        {t("account.twoFactor.recoveryDescription")}
      </p>
      <FieldMessage show>{t("account.twoFactor.recoveryWarning")}</FieldMessage>
      <ul className="m-0 grid list-none grid-cols-2 gap-x-4 gap-y-2 rounded-field border border-line bg-bg p-4 text-body-15 font-bold tabular-nums">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <div className="mt-0.5 flex flex-col gap-1.5">
        <Button
          // PAGES-73: the focus starts on «Copiar códigos», the panel's first step.
          ref={focusOnMount}
          type="button"
          variant="secondary"
          size="48"
          onClick={onCopy}
          className="w-full"
        >
          <Copy aria-hidden="true" className="size-4" />
          {t("account.twoFactor.copyCodes")}
        </Button>
        {/* Disabled until «Copiar códigos» is pressed, so the codes cannot be
            dismissed by reflex before they have been saved anywhere. */}
        <Button
          type="button"
          variant="primary"
          size="48"
          aria-disabled={!copied || undefined}
          onClick={onSaved}
          className="w-full aria-disabled:cursor-not-allowed aria-disabled:opacity-40"
        >
          {t("account.twoFactor.recoveryDone")}
        </Button>
      </div>
    </>
  );
}
