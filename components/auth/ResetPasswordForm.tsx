"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "motion/react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useTranslations, useMessages } from "next-intl";
import { Button } from "@/components/ui/button";
import { BusyButton } from "@/components/ui/BusyButton";
import { Label } from "@/components/ui/label";
import { settleAction } from "@/lib/auth/settle-action";
import { translateAuthError, translateRefusal } from "@/lib/i18n/errors";
import type { Translations } from "@/lib/i18n/types";
import { AUTH_ERROR, PASSWORD_REJECTIONS } from "@/lib/auth/errors";
import { resetPasswordSchema, type ResetPasswordInput } from "@/server/password-reset/schema";
import { resetPassword } from "@/server/password-reset/actions";
import {
  AccessBody,
  AccessHeadline,
  AccessLink,
  AccessPanel,
  AccessState,
  type LinkExpiredProps,
} from "./AccessLayout";
import { FieldMessage } from "./FieldMessage";
import { PasswordInput } from "./PasswordInput";
import { PasswordStrengthMeter } from "./PasswordStrengthMeter";

interface ResetPasswordFormProps {
  token: string;
}

// docs/specs/redesign-pages.md (PAGES-22 to PAGES-24): /reset-password with a
// token. The form, or the expired-link state once the token is rejected,
// with no toast, the focus moving to its headline (PAGES-76). The server's
// password rejections sit under «Nueva contraseña» before the meter (PAGES-3,
// worked example "Server rejections").
export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const [expired, setExpired] = useState(false);

  return (
    <AnimatePresence mode="wait" initial={false}>
      {!expired && <NewPasswordForm key="form" token={token} onExpired={() => setExpired(true)} />}
      {expired && <ResetLinkExpired key="expired" focusHeading />}
    </AnimatePresence>
  );
}

interface NewPasswordFormProps {
  token: string;
  onExpired: () => void;
}

function NewPasswordForm({ token, onExpired }: NewPasswordFormProps) {
  const t = useTranslations();
  const messages = useMessages() as Translations;
  const router = useRouter();
  // PAGES-4: a failure that belongs to no field, above «Guardar contraseña».
  const [formError, setFormError] = useState<string | null>(null);
  // Once saved, the button stays busy until /login replaces the page.
  const [leaving, setLeaving] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    mode: "onBlur",
    // The token comes from the URL, not from a field the user can see or edit.
    defaultValues: { token },
  });

  // `useWatch` rather than `watch` so the subscription is memo-safe.
  const password = useWatch({ control, name: "password" }) ?? "";

  const onSubmit = async (data: ResetPasswordInput) => {
    setFormError(null);
    const formData = new FormData();
    formData.append("token", token);
    formData.append("password", data.password);
    formData.append("confirmPassword", data.confirmPassword);

    const result = await settleAction(() => resetPassword(formData));

    if (!result.success) {
      if (result.error === AUTH_ERROR.tokenInvalid) {
        onExpired();
        return;
      }
      if (result.error && PASSWORD_REJECTIONS.includes(result.error)) {
        // Store the raw code, not the translated sentence: the field renders
        // through `translateAuthError`, so translating here too would feed a
        // sentence back into the code lookup and fall through to "generic".
        setError("password", { message: result.error }, { shouldFocus: true });
        return;
      }
      setFormError(translateRefusal(messages, result.error));
      return;
    }

    setLeaving(true);
    toast.success(t("resetPassword.success"));
    // Not signed in (PAGES-23, AUTH-11): the reset ended every session, and
    // asking for the new password once confirms it was memorized.
    router.push("/login");
  };

  return (
    <AccessBody variant="form">
      <AccessHeadline
        question={t("resetPassword.headline")}
        punchline={t("resetPassword.headlineHighlight")}
        line={t("resetPassword.description")}
        lineFromLaptop
        className="gap-3.5 lg:gap-4.5"
      />

      <AccessPanel title={t("resetPassword.title")} className="gap-3.5 lg:gap-4.5">
        <form
          onSubmit={handleSubmit(onSubmit, () => setFormError(null))}
          className="flex flex-col gap-3.5 lg:gap-4.5"
          noValidate
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="password" className="text-field-label font-bold">
              {t("resetPassword.newPassword")}
            </Label>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              error={translateAuthError(messages, errors.password?.message)}
              {...register("password")}
            />
            <PasswordStrengthMeter password={password} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="confirmPassword" className="text-field-label font-bold">
              {t("resetPassword.confirmPassword")}
            </Label>
            <PasswordInput
              id="confirmPassword"
              placeholder={t("resetPassword.confirmPasswordPlaceholder")}
              autoComplete="new-password"
              error={translateAuthError(messages, errors.confirmPassword?.message)}
              {...register("confirmPassword")}
            />
          </div>

          <FieldMessage show={!!formError} role="alert">
            {formError}
          </FieldMessage>

          <BusyButton type="submit" variant="primary" size="display" busy={isSubmitting || leaving}>
            {t("resetPassword.submit")}
          </BusyButton>
        </form>

        <AccessLink href="/login">{t("resetPassword.backToLogin")}</AccessLink>
      </AccessPanel>
    </AccessBody>
  );
}

/**
 * PAGES-24: the expired-link state, the same for a link with no token
 * (app/reset-password/page.tsx) and a token the server rejected.
 */
export function ResetLinkExpired({ focusHeading = false }: LinkExpiredProps) {
  const t = useTranslations();

  return (
    <AccessState
      question={t("resetPassword.invalidHeadline")}
      punchline={t("resetPassword.invalidHeadlineHighlight")}
      line={t("resetPassword.invalidDescription")}
      title={t("resetPassword.invalidTitle")}
      focusHeading={focusHeading}
      fadeIn={focusHeading}
    >
      <Button asChild variant="primary" size="display">
        <Link href="/forgot-password">{t("resetPassword.requestNewLink")}</Link>
      </Button>
      <AccessLink href="/login">{t("resetPassword.backToLogin")}</AccessLink>
    </AccessState>
  );
}
