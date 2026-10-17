"use client";

import { useState } from "react";
import { type UseFormRegisterReturn, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence } from "motion/react";
import * as motion from "motion/react-client";
import { useMessages, useTranslations } from "next-intl";
import { toast } from "sonner";
import { FieldMessage } from "@/components/auth/FieldMessage";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { BusyButton } from "@/components/ui/BusyButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { crossFade } from "@/lib/animations";
import { AUTH_ERROR, CURRENT_PASSWORD_REJECTIONS, refusalCode } from "@/lib/auth/errors";
import type { ShownCodes } from "@/lib/hooks/useAccountPage";
import { translateAuthError, translateRefusal } from "@/lib/i18n/errors";
import type { Translations } from "@/lib/i18n/types";
import {
  disableTwoFactor,
  regenerateRecoveryCodes,
  startTwoFactorSetup,
} from "@/server/two-factor/actions";
import {
  type DisableTwoFactorInput,
  disableTwoFactorSchema,
  type TwoFactorPasswordInput,
  twoFactorPasswordSchema,
} from "@/server/two-factor/schema";
import {
  AccountDialog,
  type AccountDialogFrameProps,
  AccountDialogTitle,
  DialogActions,
  useAccountDialog,
} from "./AccountDialog";
import { RecoveryCodesPanel } from "./RecoveryCodesPanel";
import { TwoFactorSetup } from "./TwoFactorSetup";

// docs/specs/redesign-pages.md (PAGES-44 to PAGES-48, PAGES-71 to PAGES-73,
// PAGES-76; BAUTH-11); F7-cuenta-dos-pasos. «Dos pasos»: with two-factor off,
// «Activar» asks for the password («Configurar dos pasos»), then shows the
// QR, the key and the code («Activar dos pasos»); with it on, «Gestionar»
// offers «Generar códigos nuevos» (the password) and «Desactivar dos pasos»
// (the password and a code). The recovery codes, after enabling or
// regenerating, take the same dialog over as an alertdialog that only «Ya los
// he guardado» closes. Each step cross-fades into the next, the focus moving
// to its first control. A wrong password sits under «Tu contraseña», a wrong
// code under the code field, and anything else is a form alert: never a
// toast (BAUTH-11 amended).

interface TwoFactorDialogProps extends AccountDialogFrameProps {
  enabled: boolean;
  /** The codes shown once, when they are (the page holds them so the dialog never flashes back). */
  codes: ShownCodes | null;
  onCodes: (codes: ShownCodes) => void;
  /** «Ya los he guardado». */
  onCodesSaved: () => void;
  onDisabled: () => void;
}

export function TwoFactorDialog({
  open,
  isPhone,
  returnFocusRef,
  enabled,
  codes,
  onClose,
  onCodes,
  onCodesSaved,
  onDisabled,
}: TwoFactorDialogProps) {
  const step = codes ? "codes" : enabled ? "manage" : "enable";

  return (
    <AccountDialog
      open={open}
      onClose={onClose}
      isPhone={isPhone}
      returnFocusRef={returnFocusRef}
      role={codes ? "alertdialog" : undefined}
      dismissible={!codes}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={step} {...crossFade} className="flex flex-col gap-3.5">
          {codes && <RecoveryCodesPanel codes={codes.codes} onDismiss={onCodesSaved} />}
          {step === "enable" && <EnableTwoFactor onCodes={onCodes} />}
          {step === "manage" && <ManageTwoFactor onCodes={onCodes} onDisabled={onDisabled} />}
        </motion.div>
      </AnimatePresence>
    </AccountDialog>
  );
}

interface TwoFactorPasswordProps {
  registration: UseFormRegisterReturn;
  /** The refusal's code, translated here. */
  error?: string;
}

/** «Tu contraseña», with the eye, in every step that asks for it. */
function TwoFactorPassword({ registration, error }: TwoFactorPasswordProps) {
  const t = useTranslations();
  const messages = useMessages() as Translations;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="two-factor-password" className="text-field-label font-bold">
        {t("account.twoFactor.currentPassword")}
      </Label>
      <PasswordInput
        id="two-factor-password"
        autoComplete="current-password"
        placeholder={t("auth.passwordPlaceholder")}
        error={translateAuthError(messages, error)}
        {...registration}
      />
    </div>
  );
}

interface EnableTwoFactorProps {
  onCodes: (codes: ShownCodes) => void;
}

interface SetupState {
  otpauthUri: string;
  secret: string;
  /** Minted at setup time by Better Auth's `twoFactor` plugin (BAUTH-11). */
  recoveryCodes: string[];
}

/** «Activar»: the password, then the setup step (PAGES-44). */
function EnableTwoFactor({ onCodes }: EnableTwoFactorProps) {
  const t = useTranslations();
  const messages = useMessages() as Translations;
  const { run, busy } = useAccountDialog();
  const [setup, setSetup] = useState<SetupState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<TwoFactorPasswordInput>({
    resolver: zodResolver(twoFactorPasswordSchema),
    mode: "onBlur",
  });

  const onStart = async (data: TwoFactorPasswordInput) => {
    setFormError(null);
    const formData = new FormData();
    formData.append("password", data.password);
    const result = await run(() => startTwoFactorSetup(formData));

    if (!result.success || !result.otpauthUri || !result.secret || !result.recoveryCodes) {
      const code = refusalCode(result.error);
      if (CURRENT_PASSWORD_REJECTIONS.includes(code)) {
        setError("password", { message: code }, { shouldFocus: true });
      } else setFormError(translateRefusal(messages, code));
      return;
    }
    setSetup({
      otpauthUri: result.otpauthUri,
      secret: result.secret,
      recoveryCodes: result.recoveryCodes,
    });
  };

  return (
    <>
      <AccountDialogTitle>{t("account.twoFactor.title")}</AccountDialogTitle>
      <AnimatePresence mode="wait" initial={false}>
        {setup && (
          <motion.div key="setup" {...crossFade}>
            <TwoFactorSetup
              otpauthUri={setup.otpauthUri}
              secret={setup.secret}
              onConfirmed={() => onCodes({ codes: setup.recoveryCodes, source: "enable" })}
            />
          </motion.div>
        )}
        {!setup && (
          <motion.form
            key="password"
            {...crossFade}
            onSubmit={handleSubmit(onStart)}
            className="flex flex-col gap-3.5"
            noValidate
          >
            <p className="m-0 text-meta leading-normal text-text-muted">
              {t("account.twoFactor.line")}
            </p>
            <TwoFactorPassword
              registration={register("password")}
              error={errors.password?.message}
            />
            <FieldMessage show={!!formError} role="alert">
              {formError}
            </FieldMessage>
            <DialogActions busy={busy}>{t("account.twoFactor.setupCta")}</DialogActions>
          </motion.form>
        )}
      </AnimatePresence>
    </>
  );
}

interface ManageTwoFactorProps {
  onCodes: (codes: ShownCodes) => void;
  onDisabled: () => void;
}

/** «Gestionar»: new codes with the password, or off with the password and a code (PAGES-48). */
function ManageTwoFactor({ onCodes, onDisabled }: ManageTwoFactorProps) {
  const t = useTranslations();
  const messages = useMessages() as Translations;
  const { run } = useAccountDialog();
  const [pending, setPending] = useState<"regenerate" | "disable" | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    trigger,
    getValues,
    formState: { errors },
  } = useForm<DisableTwoFactorInput>({
    resolver: zodResolver(disableTwoFactorSchema),
    mode: "onBlur",
  });

  /** Sorts a refusal: under «Tu contraseña», under the code, or a form alert. */
  const showRefusal = (code: string) => {
    if (CURRENT_PASSWORD_REJECTIONS.includes(code)) {
      setError("currentPassword", { message: code }, { shouldFocus: true });
    } else if (code === AUTH_ERROR.totpInvalid) {
      setError("code", { message: code }, { shouldFocus: true });
    } else setFormError(translateRefusal(messages, code));
  };

  // «Generar códigos nuevos» needs the password alone, so only that field is checked.
  const onRegenerate = async () => {
    setFormError(null);
    if (!(await trigger("currentPassword"))) return;

    setPending("regenerate");
    const formData = new FormData();
    formData.append("currentPassword", getValues("currentPassword"));
    const result = await run(() => regenerateRecoveryCodes(formData));
    setPending(null);

    if (!result.success || !result.recoveryCodes) {
      showRefusal(refusalCode(result.error));
      return;
    }
    onCodes({ codes: result.recoveryCodes, source: "regenerate" });
  };

  const onDisable = async (data: DisableTwoFactorInput) => {
    setFormError(null);
    setPending("disable");
    const formData = new FormData();
    formData.append("currentPassword", data.currentPassword);
    formData.append("code", data.code);
    const result = await run(() => disableTwoFactor(formData));
    setPending(null);

    if (!result.success) {
      showRefusal(refusalCode(result.error));
      return;
    }
    toast.success(t("account.twoFactor.disabledToast"));
    onDisabled();
  };

  return (
    <>
      <AccountDialogTitle>{t("account.twoFactor.title")}</AccountDialogTitle>
      <form onSubmit={handleSubmit(onDisable)} className="flex flex-col gap-3.5" noValidate>
        <TwoFactorPassword
          registration={register("currentPassword")}
          error={errors.currentPassword?.message}
        />
        <BusyButton
          type="button"
          variant="secondary"
          size="48"
          busy={pending === "regenerate"}
          disabled={pending === "disable"}
          onClick={onRegenerate}
          className="w-full"
        >
          {t("account.twoFactor.regenerateCta")}
        </BusyButton>
        <p className="m-0 text-meta leading-normal text-text-muted">
          {t("account.twoFactor.regenerateHint")}
        </p>
        <hr className="m-0 border-0 border-t border-line-soft" />
        <div className="flex flex-col gap-2">
          <Label htmlFor="two-factor-disable-code" className="text-field-label font-bold">
            {t("account.twoFactor.codeLabel")}
          </Label>
          <Input
            id="two-factor-disable-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            spellCheck={false}
            placeholder={t("account.twoFactor.codePlaceholder")}
            aria-invalid={!!errors.code}
            aria-describedby={errors.code ? "two-factor-disable-code-error" : undefined}
            {...register("code")}
          />
          <FieldMessage show={!!errors.code} id="two-factor-disable-code-error" role="alert">
            {translateAuthError(messages, errors.code?.message)}
          </FieldMessage>
        </div>
        <p className="m-0 text-meta leading-normal text-text-muted">
          {t("account.twoFactor.disableHint")}
        </p>
        <FieldMessage show={!!formError} role="alert">
          {formError}
        </FieldMessage>
        <DialogActions
          variant="danger"
          busy={pending === "disable"}
          disabled={pending === "regenerate"}
        >
          {t("account.twoFactor.disableCta")}
        </DialogActions>
      </form>
    </>
  );
}
