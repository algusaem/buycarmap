"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { useTranslations, useMessages } from "next-intl";
import { translateAuthError } from "@/lib/i18n/errors";
import type { Translations } from "@/lib/i18n/types";
import { deleteAccount } from "@/server/account/actions";

interface DeleteAccountFormProps {
  /** False for OAuth-only accounts, which have no password to re-enter. */
  hasPassword: boolean;
}

export function DeleteAccountForm({ hasPassword }: DeleteAccountFormProps) {
  const t = useTranslations();
  const messages = useMessages() as Translations;
  const [confirmation, setConfirmation] = useState("");
  const [password, setPassword] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Deletion is irreversible and cascades, so it gets a typed confirmation
  // rather than a one-click button that a mis-tap could trigger.
  const isConfirmed = confirmation.trim() === t("account.danger.confirmWord");
  const canSubmit = isConfirmed && (!hasPassword || password.length > 0);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmit) return;

    setIsDeleting(true);

    const formData = new FormData();
    formData.append("password", password);

    const result = await deleteAccount(formData);

    if (!result.success) {
      setIsDeleting(false);
      toast.error(translateAuthError(messages, result.error));
      return;
    }

    toast.success(t("account.danger.success"));
    // The session's user row is gone; sign out explicitly rather than waiting
    // for the next revalidation to notice and clear the cookie.
    await signOut({ callbackUrl: "/" });
  };

  return (
    <Card className="border-destructive/30 bg-card/80">
      <CardHeader className="space-y-1">
        <CardTitle className="flex items-center gap-2 text-lg font-bold text-destructive">
          <TriangleAlert className="h-4 w-4" />
          {t("account.danger.title")}
        </CardTitle>
        <CardDescription>{t("account.danger.description")}</CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <p className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-muted-foreground">
            {t("account.danger.warning")}
          </p>

          {hasPassword && (
            <div className="space-y-2">
              <Label htmlFor="delete-password">{t("account.danger.password")}</Label>
              <PasswordInput
                id="delete-password"
                placeholder={t("account.danger.passwordPlaceholder")}
                autoComplete="current-password"
                className="bg-background/50"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="delete-confirmation">{t("account.danger.confirmLabel")}</Label>
            <Input
              id="delete-confirmation"
              type="text"
              autoComplete="off"
              className="bg-background/50 font-mono"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              aria-describedby="delete-confirmation-hint"
            />
            <p id="delete-confirmation-hint" className="text-xs text-muted-foreground">
              {t("account.danger.confirmHint")}
            </p>
          </div>

          <Button type="submit" variant="destructive" disabled={!canSubmit || isDeleting}>
            {isDeleting ? (
              <span className="flex items-center gap-2">
                <AiOutlineLoading3Quarters className="h-4 w-4 animate-spin" />
                {t("account.danger.submitting")}
              </span>
            ) : (
              t("account.danger.submit")
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
