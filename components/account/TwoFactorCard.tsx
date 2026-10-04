"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { useTranslations, useMessages } from "next-intl";
import { translateAuthError } from "@/lib/i18n/errors";
import type { Translations } from "@/lib/i18n/types";
import {
  disableTwoFactor,
  regenerateRecoveryCodes,
  startTwoFactorSetup,
} from "@/server/two-factor/actions";
import { RecoveryCodesPanel } from "./RecoveryCodesPanel";
import { TwoFactorSetup } from "./TwoFactorSetup";

interface TwoFactorCardProps {
  isEnabled: boolean;
}

interface SetupState {
  otpauthUri: string;
  secret: string;
  /** Minted at setup time by Better Auth's `twoFactor` plugin (BAUTH-11). */
  recoveryCodes: string[];
}

function StatusBadge({ isEnabled }: { isEnabled: boolean }) {
  const t = useTranslations();

  // Icon plus word, never colour alone.
  return isEnabled ? (
    <span className="inline-flex items-center gap-1 text-xs text-accent">
      <ShieldCheck className="h-3.5 w-3.5" />
      {t("account.twoFactor.enabled")}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <ShieldOff className="h-3.5 w-3.5" />
      {t("account.twoFactor.disabled")}
    </span>
  );
}

export function TwoFactorCard({ isEnabled }: TwoFactorCardProps) {
  const t = useTranslations();
  const messages = useMessages() as Translations;
  const router = useRouter();
  const [setup, setSetup] = useState<SetupState | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");

  const onStart = async () => {
    setPending("start");

    const formData = new FormData();
    formData.append("password", password);

    const result = await startTwoFactorSetup(formData);
    setPending(null);

    if (!result.success || !result.otpauthUri || !result.secret || !result.recoveryCodes) {
      toast.error(translateAuthError(messages, result.error));
      return;
    }

    setPassword("");
    setSetup({
      otpauthUri: result.otpauthUri,
      secret: result.secret,
      recoveryCodes: result.recoveryCodes,
    });
  };

  const onDisable = async () => {
    setPending("disable");

    const formData = new FormData();
    formData.append("currentPassword", password);
    formData.append("code", code);

    const result = await disableTwoFactor(formData);
    setPending(null);

    if (!result.success) {
      toast.error(translateAuthError(messages, result.error));
      return;
    }

    setPassword("");
    setCode("");
    toast.success(t("account.twoFactor.disabledToast"));
    router.refresh();
  };

  const onRegenerate = async () => {
    setPending("regenerate");

    const formData = new FormData();
    formData.append("currentPassword", password);

    const result = await regenerateRecoveryCodes(formData);
    setPending(null);

    if (!result.success || !result.recoveryCodes) {
      toast.error(translateAuthError(messages, result.error));
      return;
    }

    setPassword("");
    setRecoveryCodes(result.recoveryCodes);
  };

  const onCodesSaved = () => {
    setRecoveryCodes(null);
    setSetup(null);
    // Re-reads the server component so the card reflects the new state.
    router.refresh();
  };

  return (
    <Card className="border-border/50 bg-card/80">
      <CardHeader className="space-y-1">
        <CardTitle className="flex items-center justify-between gap-3 text-lg font-bold">
          {t("account.twoFactor.title")}
          <StatusBadge isEnabled={isEnabled} />
        </CardTitle>
        <CardDescription>{t("account.twoFactor.description")}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Recovery codes take over the card entirely: they are shown once, so
            nothing else should compete for attention while they are on screen. */}
        {recoveryCodes && <RecoveryCodesPanel codes={recoveryCodes} onDismiss={onCodesSaved} />}

        {!recoveryCodes && setup && (
          <TwoFactorSetup
            otpauthUri={setup.otpauthUri}
            secret={setup.secret}
            onConfirmed={() => setRecoveryCodes(setup.recoveryCodes)}
            onCancel={() => setSetup(null)}
          />
        )}

        {!recoveryCodes && !setup && !isEnabled && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="two-factor-setup-password">
                {t("account.twoFactor.currentPassword")}
              </Label>
              <PasswordInput
                id="two-factor-setup-password"
                autoComplete="current-password"
                placeholder={t("account.twoFactor.currentPasswordPlaceholder")}
                className="bg-background/50"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <Button
              type="button"
              disabled={pending !== null || password.length === 0}
              onClick={onStart}
            >
              {pending === "start" ? (
                <span className="flex items-center gap-2">
                  <AiOutlineLoading3Quarters className="h-4 w-4 animate-spin" />
                  {t("account.twoFactor.starting")}
                </span>
              ) : (
                t("account.twoFactor.enableCta")
              )}
            </Button>
          </div>
        )}

        {!recoveryCodes && !setup && isEnabled && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="two-factor-password">{t("account.twoFactor.currentPassword")}</Label>
              <PasswordInput
                id="two-factor-password"
                autoComplete="current-password"
                placeholder={t("account.twoFactor.currentPasswordPlaceholder")}
                className="bg-background/50"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            <div className="space-y-2 border-t border-border/50 pt-4">
              <p className="text-xs text-muted-foreground">
                {t("account.twoFactor.regenerateHint")}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending !== null || password.length === 0}
                onClick={onRegenerate}
              >
                {pending === "regenerate" ? (
                  <span className="flex items-center gap-2">
                    <AiOutlineLoading3Quarters className="h-3.5 w-3.5 animate-spin" />
                    {t("account.twoFactor.regenerating")}
                  </span>
                ) : (
                  t("account.twoFactor.regenerateCta")
                )}
              </Button>
            </div>

            <div className="space-y-2 border-t border-border/50 pt-4">
              <Label htmlFor="two-factor-disable-code">{t("account.twoFactor.codeLabel")}</Label>
              <Input
                id="two-factor-disable-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder={t("account.twoFactor.codePlaceholder")}
                className="bg-background/50 font-mono tracking-widest"
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">{t("account.twoFactor.disableHint")}</p>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={pending !== null || password.length === 0 || code.length === 0}
                onClick={onDisable}
              >
                {pending === "disable" ? (
                  <span className="flex items-center gap-2">
                    <AiOutlineLoading3Quarters className="h-3.5 w-3.5 animate-spin" />
                    {t("account.twoFactor.disabling")}
                  </span>
                ) : (
                  t("account.twoFactor.disableCta")
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
