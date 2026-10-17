"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMessages, useTranslations } from "next-intl";
import { toast } from "sonner";
import { FieldMessage } from "@/components/auth/FieldMessage";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/auth-client";
import { AUTH_ERROR, PASSWORD_REJECTIONS } from "@/lib/auth/errors";
import { translateAuthError, translateRefusal } from "@/lib/i18n/errors";
import type { Translations } from "@/lib/i18n/types";
import { changePassword } from "@/server/account/actions";
import { type ChangePasswordInput, changePasswordSchema } from "@/server/account/schema";
import {
  AccountDialog,
  type AccountDialogFrameProps,
  AccountDialogTitle,
  DialogActions,
  useAccountDialog,
} from "./AccountDialog";

// docs/specs/redesign-pages.md (PAGES-42, PAGES-71 to PAGES-73; AUTH-5,
// BAUTH-2); F7-cuenta-editar › Cambiar contraseña. «Contraseña actual»,
// «Nueva contraseña» with the meter and «Repite la contraseña», all three
// with the eye, the note that every other session ends, «Guardar contraseña»
// and «Cancelar». A wrong current password sits under its field; a breached,
// weak or reused new one under «Nueva contraseña», before the meter (worked
// example "Server rejections"); anything else is a form alert. On success the
// dialog closes with the toast: the server ended every other session and kept
// this one (replacePassword's keepSessionId), so this device stays signed in
// with no new sign-in, and `authClient`'s session store is told to read it
// again, as NameDialog does (BAUTH-2).

interface PasswordDialogProps extends AccountDialogFrameProps {
  email: string;
  version: number;
  /** Called once the password changed, with the user row's new version (DATA-15). */
  onSaved: (version: number | undefined) => void;
}

export function PasswordDialog({
  open,
  isPhone,
  returnFocusRef,
  onClose,
  ...form
}: PasswordDialogProps) {
  return (
    <AccountDialog open={open} onClose={onClose} isPhone={isPhone} returnFocusRef={returnFocusRef}>
      <PasswordForm {...form} />
    </AccountDialog>
  );
}

type PasswordFormProps = Pick<PasswordDialogProps, "email" | "version" | "onSaved">;

function PasswordForm({ email, version, onSaved }: PasswordFormProps) {
  const t = useTranslations();
  const messages = useMessages() as Translations;
  const { run } = useAccountDialog();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema), mode: "onBlur" });

  // `useWatch` rather than `watch` so the subscription is memo-safe.
  const password = useWatch({ control, name: "password" }) ?? "";

  const onSubmit = async (data: ChangePasswordInput) => {
    setFormError(null);
    const formData = new FormData();
    formData.append("currentPassword", data.currentPassword);
    formData.append("password", data.password);
    formData.append("confirmPassword", data.confirmPassword);
    formData.append("version", String(version));
    const result = await run(() => changePassword(formData));

    if (!result.success) {
      // The raw codes: the fields render them through `translateAuthError`.
      if (result.error === AUTH_ERROR.currentPasswordIncorrect) {
        setError("currentPassword", { message: result.error }, { shouldFocus: true });
        return;
      }
      if (result.error && PASSWORD_REJECTIONS.includes(result.error)) {
        setError("password", { message: result.error }, { shouldFocus: true });
        return;
      }
      setFormError(translateRefusal(messages, result.error));
      return;
    }

    // Outside the action's answer: a failed refresh never turns the change
    // into a refusal.
    authClient.$store?.notify("$sessionSignal");
    toast.success(t("account.security.success"));
    onSaved(result.version);
  };

  return (
    <>
      <AccountDialogTitle>{t("account.security.changeCta")}</AccountDialogTitle>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3.5" noValidate>
        {/* Password managers need a username beside the password fields to
            file the new credential under the right account. */}
        <input type="email" name="email" value={email} autoComplete="username" readOnly hidden />
        <div className="flex flex-col gap-2">
          <Label htmlFor="currentPassword" className="text-field-label font-bold">
            {t("account.security.currentPassword")}
          </Label>
          <PasswordInput
            id="currentPassword"
            placeholder={t("auth.passwordPlaceholder")}
            autoComplete="current-password"
            error={translateAuthError(messages, errors.currentPassword?.message)}
            {...register("currentPassword")}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="newPassword" className="text-field-label font-bold">
            {t("account.security.newPassword")}
          </Label>
          <PasswordInput
            id="newPassword"
            autoComplete="new-password"
            error={translateAuthError(messages, errors.password?.message)}
            {...register("password")}
          />
          <PasswordStrengthMeter password={password} userInputs={[email]} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="confirmNewPassword" className="text-field-label font-bold">
            {t("account.security.confirmPassword")}
          </Label>
          <PasswordInput
            id="confirmNewPassword"
            placeholder={t("account.security.confirmPasswordPlaceholder")}
            autoComplete="new-password"
            error={translateAuthError(messages, errors.confirmPassword?.message)}
            {...register("confirmPassword")}
          />
        </div>
        <p className="m-0 text-small leading-normal text-text-muted">
          {t("account.security.signOutNotice")}
        </p>
        <FieldMessage show={!!formError} role="alert">
          {formError}
        </FieldMessage>
        <DialogActions busy={isSubmitting}>{t("account.security.submit")}</DialogActions>
      </form>
    </>
  );
}
