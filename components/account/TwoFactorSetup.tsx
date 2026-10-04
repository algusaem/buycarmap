"use client";

import { useState } from "react";
import QRCode from "react-qr-code";
import { toast } from "sonner";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslations, useMessages } from "next-intl";
import { translateAuthError } from "@/lib/i18n/errors";
import type { Translations } from "@/lib/i18n/types";
import { confirmTwoFactorSetup } from "@/server/two-factor/actions";

interface TwoFactorSetupProps {
  otpauthUri: string;
  secret: string;
  /**
   * Called once the code is accepted. BAUTH-11 (docs/specs/core-better-auth.md):
   * Better Auth's `twoFactor` plugin mints the recovery codes at setup, not at
   * confirmation, so the caller already has them — this only signals that the
   * authenticator itself has now proven to work.
   */
  onConfirmed: () => void;
  onCancel: () => void;
}

/**
 * The enrolment step: scan, then prove the app works before anything is
 * enforced. Nothing here changes how login behaves until the code is accepted.
 */
export function TwoFactorSetup({ otpauthUri, secret, onConfirmed, onCancel }: TwoFactorSetupProps) {
  const t = useTranslations();
  const messages = useMessages() as Translations;
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(undefined);

    const formData = new FormData();
    formData.append("code", code);

    const result = await confirmTwoFactorSetup(formData);
    setIsSubmitting(false);

    if (!result.success) {
      setError(translateAuthError(messages, result.error));
      return;
    }

    toast.success(t("account.twoFactor.enabledToast"));
    onConfirmed();
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1">
        <h3 className="font-semibold">{t("account.twoFactor.scanTitle")}</h3>
        <p className="text-sm text-muted-foreground">{t("account.twoFactor.scanDescription")}</p>
      </div>

      {/* Rendered as inline SVG on a white plate: QR scanners need the light
          quiet zone, and the app's dark surface would otherwise invert it. */}
      <div className="w-fit rounded-md bg-white p-3">
        <QRCode value={otpauthUri} size={168} />
      </div>

      <div className="space-y-1">
        <p className="text-sm font-medium">{t("account.twoFactor.manualLabel")}</p>
        <code className="block break-all rounded-md border border-border/50 bg-background/50 p-2 font-mono text-sm">
          {secret}
        </code>
        <p className="text-xs text-muted-foreground">{t("account.twoFactor.manualHint")}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="two-factor-code">{t("account.twoFactor.codeLabel")}</Label>
        <Input
          id="two-factor-code"
          // `inputMode` brings up the numeric keypad; `one-time-code` lets
          // password managers and iOS autofill offer the code directly.
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder={t("account.twoFactor.codePlaceholder")}
          className="bg-background/50 font-mono tracking-widest"
          maxLength={6}
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isSubmitting || code.length === 0}>
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <AiOutlineLoading3Quarters className="h-4 w-4 animate-spin" />
              {t("account.twoFactor.confirming")}
            </span>
          ) : (
            t("account.twoFactor.confirm")
          )}
        </Button>
        <Button type="button" variant="ghost" disabled={isSubmitting} onClick={onCancel}>
          {t("account.twoFactor.cancel")}
        </Button>
      </div>
    </form>
  );
}
