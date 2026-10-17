"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import QRCode from "react-qr-code";
import { useMessages, useTranslations } from "next-intl";
import { FieldMessage } from "@/components/auth/FieldMessage";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AUTH_ERROR } from "@/lib/auth/errors";
import { focusOnMount } from "@/lib/focus";
import { translateAuthError, translateRefusal } from "@/lib/i18n/errors";
import type { Translations } from "@/lib/i18n/types";
import { confirmTwoFactorSetup } from "@/server/two-factor/actions";
import { type TwoFactorCodeInput, twoFactorCodeSchema } from "@/server/two-factor/schema";
import { DialogActions, useAccountDialog } from "./AccountDialog";

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
}

/** Selects the whole key, so one copy takes all of it (PAGES-44). */
function selectAll(event: { currentTarget: HTMLInputElement }) {
  event.currentTarget.select();
}

/**
 * The enrolment step (docs/specs/redesign-pages.md, PAGES-44, PAGES-76;
 * F7-cuenta-dos-pasos › Paso 2): scan, then prove the app works before
 * anything is enforced. Nothing here changes how login behaves until the code
 * is accepted. The QR sits on a `text` plate with its modules in `bg`, the
 * contrast cameras need without the pure white the system bans; the key is a
 * read-only field selected whole, where the focus lands as the step opens.
 * «Activar dos pasos» is enabled from the start (RULES.md §19): an empty code
 * is the schema's error under the code field, as a wrong code is, which takes
 * the focus; a rate limit or an unexpected failure is a form alert.
 */
export function TwoFactorSetup({ otpauthUri, secret, onConfirmed }: TwoFactorSetupProps) {
  const t = useTranslations();
  const messages = useMessages() as Translations;
  const { run, busy } = useAccountDialog();
  const [formError, setFormError] = useState<string | undefined>();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<TwoFactorCodeInput>({
    resolver: zodResolver(twoFactorCodeSchema),
    mode: "onBlur",
  });

  const onSubmit = async (data: TwoFactorCodeInput) => {
    setFormError(undefined);

    const formData = new FormData();
    formData.append("code", data.code);
    const result = await run(() => confirmTwoFactorSetup(formData));

    if (!result.success) {
      // The raw code: the field renders it through `translateAuthError`.
      if (result.error === AUTH_ERROR.totpInvalid) {
        setError("code", { message: result.error }, { shouldFocus: true });
      } else setFormError(translateRefusal(messages, result.error));
      return;
    }

    onConfirmed();
  };

  const codeError = translateAuthError(messages, errors.code?.message);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3.5" noValidate>
      <div className="flex flex-col gap-1">
        <p className="m-0 text-meta font-bold">{t("account.twoFactor.scanTitle")}</p>
        <p className="m-0 text-meta leading-normal text-text-muted">
          {t("account.twoFactor.scanDescription")}
        </p>
      </div>

      <div className="w-fit rounded-field bg-text p-3 text-bg">
        <QRCode value={otpauthUri} size={150} fgColor="currentColor" bgColor="transparent" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="two-factor-secret" className="text-field-label font-bold">
          {t("account.twoFactor.manualLabel")}
        </Label>
        <Input
          ref={focusOnMount}
          id="two-factor-secret"
          name="secret"
          readOnly
          value={secret}
          spellCheck={false}
          autoComplete="off"
          aria-describedby="two-factor-secret-hint"
          onFocus={selectAll}
          onClick={selectAll}
          className="font-bold tracking-wide select-all"
        />
        <p id="two-factor-secret-hint" className="m-0 text-meta text-text-muted">
          {t("account.twoFactor.manualHint")}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="two-factor-code" className="text-field-label font-bold">
          {t("account.twoFactor.codeLabel")}
        </Label>
        <Input
          id="two-factor-code"
          // `inputMode` brings up the numeric keypad; `one-time-code` lets
          // password managers and iOS autofill offer the code directly.
          inputMode="numeric"
          autoComplete="one-time-code"
          spellCheck={false}
          placeholder={t("account.twoFactor.codePlaceholder")}
          maxLength={6}
          aria-invalid={!!codeError}
          aria-describedby={codeError ? "two-factor-code-error" : undefined}
          {...register("code")}
        />
        <FieldMessage show={!!codeError} id="two-factor-code-error" role="alert">
          {codeError}
        </FieldMessage>
      </div>

      <FieldMessage show={!!formError} role="alert">
        {formError}
      </FieldMessage>

      <DialogActions busy={busy}>{t("account.twoFactor.confirm")}</DialogActions>
    </form>
  );
}
