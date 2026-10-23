"use client";

import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence } from "motion/react";
import { useMessages, useTranslations } from "next-intl";
import { FieldMessage } from "@/components/auth/FieldMessage";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PresenceFade } from "@/components/ui/PresenceFade";
import { AUTH_ERROR } from "@/lib/auth/errors";
import { focusOnMount } from "@/lib/focus";
import { translateAuthError, translateRefusal } from "@/lib/i18n/errors";
import type { Translations } from "@/lib/i18n/types";
import { requestEmailChange } from "@/server/email-verification/actions";
import { type ChangeEmailInput, changeEmailSchema } from "@/server/email-verification/schema";
import {
  AccountDialog,
  type AccountDialogFrameProps,
  AccountDialogTitle,
  DialogActions,
  useAccountDialog,
} from "./AccountDialog";

// docs/specs/redesign-pages.md (PAGES-41, PAGES-71 to PAGES-73; AUTH-13);
// F7-cuenta-editar › Cambiar correo. The line on how it works, «Nueva
// dirección de correo» and «Contraseña actual» with the eye — required as
// well as the emailed link, so a hijacked session alone cannot move the
// account to another inbox. `sameEmail` and `currentPasswordIncorrect` sit
// under their fields, any other refusal is a form alert. Sent, the form
// gives way to the neutral notice and «Cerrar», the same whether the address
// is free or taken, and the card's email does not change; the two cross-fade,
// and the focus moves to «Cerrar» (PAGES-76).

export function EmailDialog({ open, isPhone, returnFocusRef, onClose }: AccountDialogFrameProps) {
  return (
    <AccountDialog open={open} onClose={onClose} isPhone={isPhone} returnFocusRef={returnFocusRef}>
      <EmailChange onClose={onClose} />
    </AccountDialog>
  );
}

interface EmailChangeProps {
  onClose: () => void;
}

function EmailChange({ onClose }: EmailChangeProps) {
  const t = useTranslations();
  const [sent, setSent] = useState(false);
  // The focus lands on «Cerrar» (PAGES-76), which carries the notice, so a
  // screen reader reads it with the button.
  const noticeId = useId();

  return (
    <>
      <AccountDialogTitle>{t("account.email.submit")}</AccountDialogTitle>
      <AnimatePresence mode="wait" initial={false}>
        {sent && (
          <PresenceFade key="sent" className="flex flex-col gap-3.5">
            <p id={noticeId} className="m-0 text-meta leading-normal text-text-muted">
              {t("account.email.submitted")}
            </p>
            <Button
              ref={focusOnMount}
              aria-describedby={noticeId}
              type="button"
              variant="secondary"
              size="48"
              onClick={onClose}
              className="w-full"
            >
              {t("common.close")}
            </Button>
          </PresenceFade>
        )}
        {!sent && (
          <PresenceFade key="form">
            <EmailChangeForm onSent={() => setSent(true)} />
          </PresenceFade>
        )}
      </AnimatePresence>
    </>
  );
}

interface EmailChangeFormProps {
  onSent: () => void;
}

function EmailChangeForm({ onSent }: EmailChangeFormProps) {
  const t = useTranslations();
  const messages = useMessages() as Translations;
  const { run } = useAccountDialog();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ChangeEmailInput>({ resolver: zodResolver(changeEmailSchema), mode: "onBlur" });

  const onSubmit = async (data: ChangeEmailInput) => {
    setFormError(null);
    const formData = new FormData();
    formData.append("email", data.email);
    formData.append("currentPassword", data.currentPassword);
    const result = await run(() => requestEmailChange(formData));

    if (!result.success) {
      // The raw code: the fields render it through `translateAuthError`.
      if (result.error === AUTH_ERROR.currentPasswordIncorrect) {
        setError("currentPassword", { message: result.error }, { shouldFocus: true });
        return;
      }
      if (result.error === AUTH_ERROR.sameEmail) {
        setError("email", { message: result.error }, { shouldFocus: true });
        return;
      }
      setFormError(translateRefusal(messages, result.error));
      return;
    }

    onSent();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3.5" noValidate>
      <p className="m-0 text-meta leading-normal text-text-muted">{t("account.email.notice")}</p>
      <div className="flex flex-col gap-2">
        <Label htmlFor="new-email" className="text-field-label font-bold">
          {t("account.email.newEmail")}
        </Label>
        <Input
          id="new-email"
          type="email"
          placeholder={t("account.email.newEmailPlaceholder")}
          autoComplete="email"
          spellCheck={false}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "new-email-error" : undefined}
          {...register("email")}
        />
        <FieldMessage show={!!errors.email} id="new-email-error" role="alert">
          {translateAuthError(messages, errors.email?.message)}
        </FieldMessage>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="email-current-password" className="text-field-label font-bold">
          {t("account.email.currentPassword")}
        </Label>
        <PasswordInput
          id="email-current-password"
          placeholder={t("auth.passwordPlaceholder")}
          autoComplete="current-password"
          error={translateAuthError(messages, errors.currentPassword?.message)}
          {...register("currentPassword")}
        />
      </div>
      <FieldMessage show={!!formError} role="alert">
        {formError}
      </FieldMessage>
      <DialogActions busy={isSubmitting}>{t("account.email.submit")}</DialogActions>
    </form>
  );
}
