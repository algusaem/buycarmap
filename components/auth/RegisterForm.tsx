"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "motion/react";
import { authClient } from "@/lib/auth/auth-client";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BusyButton } from "@/components/ui/BusyButton";
import { Button } from "@/components/ui/button";
import {
  ACCESS_LINK_CLASSES,
  AccessArrow,
  AccessBody,
  AccessHeadline,
  AccessPanel,
  AccessState,
} from "./AccessLayout";
import { FieldMessage } from "./FieldMessage";
import { OAuthButtons } from "./OAuthButtons";
import { PasswordInput } from "./PasswordInput";
import { PasswordStrengthMeter } from "./PasswordStrengthMeter";
import { useTranslations, useMessages } from "next-intl";
import { translateAuthError, translateRefusal } from "@/lib/i18n/errors";
import type { Translations } from "@/lib/i18n/types";
import { REGISTER_PASSWORD_REJECTIONS } from "@/lib/auth/errors";
import { settleAction } from "@/lib/auth/settle-action";
import { registerSchema, type RegisterInput } from "@/server/registration/schema";
import { register as registerUser, resendConfirmation } from "@/server/registration/actions";

interface RegisterFormProps {
  /** Whether Google is configured server-side (lib/app-config.ts). */
  isGoogleConfigured: boolean;
}

// docs/specs/redesign-pages.md (PAGES-1 to PAGES-12): /register, the form
// (`F0-registro`) and, once `register` answers `pending`, the «check your
// inbox» state (`F7-registro-estados`), the same for a free and a taken
// address (AUTH-1), the focus moving to its headline (PAGES-76).
export function RegisterForm({ isGoogleConfigured }: RegisterFormProps) {
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  return (
    <AnimatePresence mode="wait" initial={false}>
      {pendingEmail === null && (
        <SignUpForm
          key="form"
          isGoogleConfigured={isGoogleConfigured}
          onPending={setPendingEmail}
        />
      )}
      {pendingEmail !== null && <PendingState key="pending" email={pendingEmail} />}
    </AnimatePresence>
  );
}

interface SignUpFormProps {
  isGoogleConfigured: boolean;
  /** Called with the address submitted when `register` answers `pending`. */
  onPending: (email: string) => void;
}

function SignUpForm({ isGoogleConfigured, onPending }: SignUpFormProps) {
  const t = useTranslations();
  const messages = useMessages() as Translations;
  const router = useRouter();
  const emailErrorId = useId();
  // PAGES-4: a failure that belongs to no field, above «Crear cuenta».
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    mode: "onBlur",
  });

  // Drives the live strength meter, and feeds the email into scoring so a
  // password built out of it is flagged (PAGES-10). `useWatch` rather than
  // `watch` so the subscription is memo-safe under the React Compiler.
  const password = useWatch({ control, name: "password" }) ?? "";
  const email = useWatch({ control, name: "email" }) ?? "";

  const onSubmit = async (data: RegisterInput) => {
    setFormError(null);
    // No name (PAGES-9, PAGES-10): it is set later from «Cambiar nombre».
    const formData = new FormData();
    formData.append("email", data.email);
    formData.append("password", data.password);
    formData.append("confirmPassword", data.confirmPassword);

    const result = await settleAction(() => registerUser(formData));

    if (!result.success) {
      if (result.error && REGISTER_PASSWORD_REJECTIONS.includes(result.error)) {
        // The raw code: the field renders it through `translateAuthError`.
        setError("password", { message: result.error }, { shouldFocus: true });
        return;
      }
      setFormError(translateRefusal(messages, result.error));
      return;
    }

    // Verify-first signup: no account exists yet, so there is nothing to sign
    // in to. The state is shown for a free address and a taken one alike —
    // that identical outcome is what stops the form revealing which is which.
    if (result.pending) {
      onPending(data.email);
      return;
    }

    // Only reached when email is unconfigured, where the account is created
    // immediately and auto sign-in still applies (Edge cases).
    const { error: signInError } = await authClient.signIn.email({
      email: data.email,
      password: data.password,
    });

    toast.success(t("auth.accountCreated"));

    // Account exists now; if the auto sign-in somehow failed, send them to
    // the login page rather than an unauthenticated home page.
    if (signInError) {
      router.push("/login");
      return;
    }

    router.push("/");
    router.refresh();
  };

  return (
    <AccessBody variant="form">
      <AccessHeadline
        question={t("auth.registerHeadline")}
        punchline={t("auth.registerHeadlineHighlight")}
        line={t("auth.tagline")}
        lineFromLaptop
        illustration
        className="gap-3.5 lg:gap-4.5"
      />

      <AccessPanel title={t("auth.createAccount")} className="gap-3.5 lg:gap-4.5">
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

          <div className="flex flex-col gap-2">
            <Label htmlFor="password" className="text-field-label font-bold">
              {t("auth.password")}
            </Label>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              error={translateAuthError(messages, errors.password?.message)}
              {...register("password")}
            />
            <PasswordStrengthMeter password={password} userInputs={[email]} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="confirmPassword" className="text-field-label font-bold">
              {t("auth.confirmPassword")}
            </Label>
            <PasswordInput
              id="confirmPassword"
              placeholder={t("auth.confirmPasswordPlaceholder")}
              autoComplete="new-password"
              error={translateAuthError(messages, errors.confirmPassword?.message)}
              {...register("confirmPassword")}
            />
          </div>

          <FieldMessage show={!!formError} role="alert">
            {formError}
          </FieldMessage>

          <BusyButton type="submit" variant="primary" size="display" busy={isSubmitting}>
            {t("auth.signUp")}
          </BusyButton>
        </form>

        {/* Same component and same action as on the login page: with OAuth
            there is no separate "register" — Better Auth creates the account
            on first sign-in (ENTRY-16, kept). Nothing at all, «o» included,
            when Google is not configured. */}
        <OAuthButtons googleEnabled={isGoogleConfigured} />

        {/* PAGES-9: the statement of consent, at every width. */}
        <p className="m-0 text-center text-label text-text-muted">
          {t.rich("auth.legalNotice", {
            terms: (chunks) => (
              <Link href="/terms" className={`${ACCESS_LINK_CLASSES} text-text`}>
                {chunks}
              </Link>
            ),
            privacy: (chunks) => (
              <Link href="/privacy" className={`${ACCESS_LINK_CLASSES} text-text`}>
                {chunks}
              </Link>
            ),
          })}
        </p>

        <p className="m-0 text-center text-label text-text-muted">
          {t("auth.alreadyHaveAccount")}{" "}
          <Link href="/login" className={`${ACCESS_LINK_CLASSES} font-bold text-lime`}>
            {t("auth.signInLink")}
          </Link>
        </p>
      </AccessPanel>

      <AccessArrow />
    </AccessBody>
  );
}

interface PendingStateProps {
  /** The address submitted, so the link can be sent again without asking for it. */
  email: string;
}

// PAGES-11, PAGES-12: the headline «¿Ya está? / Mira tu correo», its line,
// «Reenviar el correo», then «Entrar». From 1440px wide the illustration
// stays and the arrow goes: there is no «o» to point at.
function PendingState({ email }: PendingStateProps) {
  const t = useTranslations();
  const messages = useMessages() as Translations;
  const [isResending, setIsResending] = useState(false);

  const onResend = async () => {
    setIsResending(true);

    const formData = new FormData();
    formData.append("email", email);

    const result = await settleAction(() => resendConfirmation(formData));
    setIsResending(false);

    // An action with no form: a refusal is the error toast (FRONT-15).
    if (!result.success) {
      toast.error(translateRefusal(messages, result.error));
      return;
    }

    // Same neutral wording whatever the address — this must not become a
    // second way to learn whether it has a pending signup (AUTH-1).
    toast.success(t("verifyEmail.resent"));
  };

  return (
    <AccessState
      question={t("verifyEmail.pendingHeadline")}
      punchline={t("verifyEmail.pendingHeadlineHighlight")}
      line={t("verifyEmail.pendingDescription")}
      title={t("verifyEmail.pendingTitle")}
      illustration
      focusHeading
    >
      <BusyButton
        type="button"
        variant="secondary"
        size="48"
        busy={isResending}
        onClick={onResend}
        className="w-full"
      >
        {t("verifyEmail.resend")}
      </BusyButton>
      <Button asChild variant="primary" size="display">
        <Link href="/login">{t("auth.signIn")}</Link>
      </Button>
    </AccessState>
  );
}
