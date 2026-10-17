"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import * as Sentry from "@sentry/nextjs";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMessages, useTranslations } from "next-intl";
import { toast } from "sonner";
import { FieldMessage } from "@/components/auth/FieldMessage";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/auth-client";
import { AUTH_ERROR, CURRENT_PASSWORD_REJECTIONS, refusalCode } from "@/lib/auth/errors";
import { translateAuthError, translateRefusal } from "@/lib/i18n/errors";
import type { Translations } from "@/lib/i18n/types";
import { deleteAccount } from "@/server/account/actions";
import {
  type DeleteAccountFormInput,
  deleteAccountFormSchema,
  deletePasswordlessAccountFormSchema,
} from "@/server/account/schema";
import {
  AccountDialog,
  type AccountDialogFrameProps,
  AccountDialogTitle,
  DialogActions,
  useAccountDialog,
} from "./AccountDialog";

// docs/specs/redesign-pages.md (PAGES-54, PAGES-55, PAGES-71 to PAGES-73);
// F7-cuenta-eliminar-y-mas › Eliminar la cuenta. A confirmation
// (`alertdialog`, a sheet on the phone) with the warning and its
// circle-alert, «Tu contraseña» on a password account, «Escribe ELIMINAR para
// confirmar» with its hint, «Eliminar mi cuenta» (danger, full width) and
// «Cancelar». Deletion is irreversible and cascades, so the button stays
// aria-disabled until the word is typed and, on a password account, a
// password is given: no reflex can delete, even with the focus on the first
// field. A wrong password sits under «Tu contraseña»; anything else is a form
// alert. On success the session is signed out and the user goes home; the
// dialog stays locked and its button busy from the request to the navigation,
// so nothing can cancel what is already done. A sign-out that throws
// is reported, told in the error toast and lets go of the dialog.

interface DeleteAccountDialogProps extends AccountDialogFrameProps {
  hasPassword: boolean;
}

export function DeleteAccountDialog({
  open,
  isPhone,
  returnFocusRef,
  hasPassword,
  onClose,
}: DeleteAccountDialogProps) {
  return (
    <AccountDialog
      open={open}
      onClose={onClose}
      isPhone={isPhone}
      returnFocusRef={returnFocusRef}
      role="alertdialog"
    >
      <DeleteAccountForm hasPassword={hasPassword} />
    </AccountDialog>
  );
}

interface DeleteAccountFormProps {
  hasPassword: boolean;
}

function DeleteAccountForm({ hasPassword }: DeleteAccountFormProps) {
  const t = useTranslations();
  const messages = useMessages() as Translations;
  const router = useRouter();
  const { run, hold, release, busy } = useAccountDialog();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm<DeleteAccountFormInput>({
    resolver: zodResolver(
      hasPassword ? deleteAccountFormSchema : deletePasswordlessAccountFormSchema,
    ),
    mode: "onBlur",
    defaultValues: { password: "", confirmation: "" },
  });

  const confirmation = useWatch({ control, name: "confirmation" }) ?? "";
  const password = useWatch({ control, name: "password" }) ?? "";
  const isConfirmed = confirmation.trim() === t("account.danger.confirmWord");
  const canSubmit = isConfirmed && (!hasPassword || password.length > 0);

  const onDelete = async (data: DeleteAccountFormInput) => {
    setFormError(null);
    const formData = new FormData();
    formData.append("password", data.password);
    const result = await run(() => deleteAccount(formData));

    if (!result.success) {
      const code = refusalCode(result.error);
      if (CURRENT_PASSWORD_REJECTIONS.includes(code)) {
        setError("password", { message: code }, { shouldFocus: true });
      } else setFormError(translateRefusal(messages, code));
      return;
    }

    // The account is gone: nothing may close the dialog before the page leaves.
    hold();
    toast.success(t("account.danger.success"));
    // The session's user row is gone; sign out explicitly rather than waiting
    // for the next revalidation to notice and clear the cookie. A sign-out that
    // throws lets go of the dialog, as SignOutButton does.
    try {
      await authClient.signOut();
      router.push("/");
    } catch (error) {
      Sentry.captureException(error);
      release();
      toast.error(translateAuthError(messages, AUTH_ERROR.generic));
    }
  };

  const submit = handleSubmit(onDelete);

  return (
    <>
      <AccountDialogTitle>{t("account.danger.question")}</AccountDialogTitle>
      <form
        onSubmit={(event) => {
          if (canSubmit) return submit(event);
          event.preventDefault();
        }}
        className="flex flex-col gap-3.5"
        noValidate
      >
        <FieldMessage show>{t("account.danger.line")}</FieldMessage>
        {hasPassword && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="delete-password" className="text-field-label font-bold">
              {t("account.danger.password")}
            </Label>
            <PasswordInput
              id="delete-password"
              placeholder={t("auth.passwordPlaceholder")}
              autoComplete="current-password"
              error={translateAuthError(messages, errors.password?.message)}
              {...register("password")}
            />
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Label htmlFor="delete-confirmation" className="text-field-label font-bold">
            {t("account.danger.confirmLabel")}
          </Label>
          <Input
            id="delete-confirmation"
            type="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-describedby="delete-confirmation-hint"
            {...register("confirmation")}
          />
          <p id="delete-confirmation-hint" className="m-0 text-meta leading-normal text-text-muted">
            {t("account.danger.confirmHint")}
          </p>
        </div>
        <FieldMessage show={!!formError} role="alert">
          {formError}
        </FieldMessage>
        <DialogActions variant="danger" busy={busy} blocked={!canSubmit}>
          {t("account.danger.submit")}
        </DialogActions>
      </form>
    </>
  );
}
