"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { AnimatePresence } from "motion/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations, useMessages } from "next-intl";
import { Button } from "@/components/ui/button";
import { BusyButton } from "@/components/ui/BusyButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { settleAction } from "@/lib/auth/settle-action";
import { translateAuthError, translateRefusal } from "@/lib/i18n/errors";
import type { Translations } from "@/lib/i18n/types";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/server/auth/schema";
import { requestPasswordReset } from "@/server/password-reset/actions";
import { AccessBody, AccessHeadline, AccessLink, AccessPanel, AccessState } from "./AccessLayout";
import { FieldMessage } from "./FieldMessage";

// docs/specs/redesign-pages.md (PAGES-20, PAGES-21): /forgot-password's form,
// then the «check your inbox» state — the same for an unknown address, an
// OAuth-only account and a password account (the action answers the same
// for all three), the focus moving to its headline (PAGES-76).
export function ForgotPasswordForm() {
  const t = useTranslations();
  const [sent, setSent] = useState(false);

  return (
    <AnimatePresence mode="wait" initial={false}>
      {!sent && <RequestForm key="form" onSent={() => setSent(true)} />}
      {sent && (
        <AccessState
          key="sent"
          question={t("forgotPassword.successHeadline")}
          punchline={t("forgotPassword.successHeadlineHighlight")}
          line={t("forgotPassword.successDescription")}
          title={t("forgotPassword.successTitle")}
          focusHeading
        >
          <Button asChild variant="primary" size="display">
            <Link href="/login">{t("forgotPassword.backToLogin")}</Link>
          </Button>
        </AccessState>
      )}
    </AnimatePresence>
  );
}

interface RequestFormProps {
  onSent: () => void;
}

function RequestForm({ onSent }: RequestFormProps) {
  const t = useTranslations();
  const messages = useMessages() as Translations;
  const emailErrorId = useId();
  // PAGES-4: a failure that belongs to no field, above «Enviar enlace».
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: "onBlur",
  });

  const onSubmit = async (data: ForgotPasswordInput) => {
    setFormError(null);
    const formData = new FormData();
    formData.append("email", data.email);

    const result = await settleAction(() => requestPasswordReset(formData));
    if (!result.success) {
      setFormError(translateRefusal(messages, result.error));
      return;
    }

    onSent();
  };

  return (
    <AccessBody variant="form">
      <AccessHeadline
        question={t("forgotPassword.headline")}
        punchline={t("forgotPassword.headlineHighlight")}
        line={t("forgotPassword.description")}
        lineFromLaptop
        className="gap-3.5 lg:gap-4.5"
      />

      <AccessPanel title={t("forgotPassword.title")} className="gap-3.5 lg:gap-4.5">
        <form
          onSubmit={handleSubmit(onSubmit, () => setFormError(null))}
          className="flex flex-col gap-3.5 lg:gap-4.5"
          noValidate
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="email" className="text-field-label font-bold">
              {t("auth.email")}
            </Label>
            <Input
              id="email"
              type="email"
              placeholder={t("auth.emailPlaceholder")}
              autoComplete="email"
              spellCheck={false}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? emailErrorId : undefined}
              {...register("email")}
            />
            <FieldMessage show={!!errors.email} id={emailErrorId} role="alert">
              {translateAuthError(messages, errors.email?.message)}
            </FieldMessage>
          </div>

          <FieldMessage show={!!formError} role="alert">
            {formError}
          </FieldMessage>

          <BusyButton type="submit" variant="primary" size="display" busy={isSubmitting}>
            {t("forgotPassword.submit")}
          </BusyButton>
        </form>

        <AccessLink href="/login">{t("forgotPassword.backToLogin")}</AccessLink>
      </AccessPanel>
    </AccessBody>
  );
}
