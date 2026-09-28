"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import * as motion from "motion/react-client";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { ArrowLeft, MailCheck } from "lucide-react";
import { fadeInUp } from "@/lib/animations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { OAuthButtons } from "./OAuthButtons";
import { PasswordInput } from "./PasswordInput";
import { PasswordStrengthMeter } from "./PasswordStrengthMeter";
import { useTranslation } from "@/lib/i18n/client";
import { translateAuthError } from "@/lib/i18n/errors";
import { registerSchema, RegisterInput } from "@/lib/validations/auth";
import { register as registerUser } from "@/app/actions/register";
import { resendConfirmation } from "@/app/actions/resend-confirmation";

export function RegisterForm() {
  const { t } = useTranslation();
  const router = useRouter();
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [isResending, setIsResending] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  });

  // Drives the live strength meter, and feeds the email/name into scoring so a
  // password built out of them is flagged. `useWatch` rather than `watch` so
  // the subscription is memo-safe under the React Compiler.
  const password = useWatch({ control, name: "password" }) ?? "";
  const email = useWatch({ control, name: "email" }) ?? "";
  const name = useWatch({ control, name: "name" }) ?? "";

  const onSubmit = async (data: RegisterInput) => {
    const formData = new FormData();
    formData.append("email", data.email);
    formData.append("password", data.password);
    formData.append("confirmPassword", data.confirmPassword);
    if (data.name) {
      formData.append("name", data.name);
    }

    const result = await registerUser(formData);

    if (!result.success) {
      toast.error(translateAuthError(t, result.error) ?? t.auth.registrationFailed);
      return;
    }

    // Verify-first signup: no account exists yet, so there is nothing to sign
    // in to. This panel is shown for a free address and a taken one alike —
    // that identical outcome is what stops the form revealing which is which.
    if (result.pending) {
      // Kept so the panel can re-request the link without asking again.
      setPendingEmail(data.email);
      setAwaitingConfirmation(true);
      return;
    }

    // Only reached when email is unconfigured, where the account is created
    // immediately and auto sign-in still applies.
    const signInResult = await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
    });

    toast.success(t.auth.accountCreated);

    // Account exists now; if the auto sign-in somehow failed, send them to
    // the login page rather than an unauthenticated home page.
    if (signInResult?.error) {
      router.push("/login");
      return;
    }

    router.push("/");
    router.refresh();
  };

  const onResend = async () => {
    setIsResending(true);

    const formData = new FormData();
    formData.append("email", pendingEmail);

    const result = await resendConfirmation(formData);
    setIsResending(false);

    if (!result.success) {
      toast.error(translateAuthError(t, result.error));
      return;
    }

    // Same neutral wording as the panel itself — this must not become a second
    // way to learn whether the address has a pending signup.
    toast.success(t.verifyEmail.resent);
  };

  return (
    <motion.div {...fadeInUp}>
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="space-y-1 pb-4">
          <Link
            href="/"
            className="-ml-1 mb-2 inline-flex w-fit items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
          >
            <ArrowLeft className="h-3 w-3" />
            {t.auth.return}
          </Link>
          <CardTitle className="text-2xl font-bold">
            {awaitingConfirmation ? t.verifyEmail.pendingTitle : t.auth.createAccount}
          </CardTitle>
          <CardDescription>
            {awaitingConfirmation ? t.verifyEmail.pendingDescription : t.auth.signUpDescription}
          </CardDescription>
        </CardHeader>

        {awaitingConfirmation && (
          <CardContent>
            <div className="flex flex-col items-center gap-4 py-4 text-center" aria-live="polite">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 ring-1 ring-accent/20">
                <MailCheck className="h-6 w-6 text-accent" />
              </div>

              {/* Without this, a delayed or filtered email left the user with
                  no route forward but re-registering, which reads like a fault. */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isResending}
                onClick={onResend}
              >
                {isResending ? (
                  <span className="flex items-center gap-2">
                    <AiOutlineLoading3Quarters className="h-3.5 w-3.5 animate-spin" />
                    {t.verifyEmail.resending}
                  </span>
                ) : (
                  t.verifyEmail.resend
                )}
              </Button>

              <Button asChild variant="outline" className="w-full" size="lg">
                <Link href="/login">{t.auth.signIn}</Link>
              </Button>
            </div>
          </CardContent>
        )}

        {!awaitingConfirmation && (
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t.auth.name}</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder={t.auth.namePlaceholder}
                  autoComplete="name"
                  className="bg-background/50"
                  {...register("name")}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">
                    {translateAuthError(t, errors.name.message)}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">{t.auth.email}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t.auth.emailPlaceholder}
                  autoComplete="email"
                  className="bg-background/50"
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-sm text-destructive">
                    {translateAuthError(t, errors.email.message)}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">{t.auth.password}</Label>
                <PasswordInput
                  id="password"
                  placeholder={t.auth.passwordPlaceholder}
                  autoComplete="new-password"
                  className="bg-background/50"
                  error={translateAuthError(t, errors.password?.message)}
                  {...register("password")}
                />
                <PasswordStrengthMeter password={password} userInputs={[email, name]} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t.auth.confirmPassword}</Label>
                <PasswordInput
                  id="confirmPassword"
                  placeholder={t.auth.confirmPasswordPlaceholder}
                  autoComplete="new-password"
                  className="bg-background/50"
                  error={translateAuthError(t, errors.confirmPassword?.message)}
                  {...register("confirmPassword")}
                />
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <AiOutlineLoading3Quarters className="h-4 w-4 animate-spin" />
                    {t.auth.creatingAccount}
                  </span>
                ) : (
                  t.auth.signUp
                )}
              </Button>
            </form>

            {/* Same component and same action as on the login page. With OAuth
                there is no separate "register" — NextAuth creates the account
                on first sign-in — so the only thing this adds is letting
                someone who came here to sign up actually find the option,
                instead of having to guess it lives behind "Welcome back". */}
            <OAuthButtons />
          </CardContent>
        )}

        <CardFooter className="flex-col gap-4 border-t border-border/50 pt-6">
          <p className="text-center text-sm text-muted-foreground">
            {t.auth.alreadyHaveAccount}{" "}
            <Link
              href="/login"
              className="font-medium text-primary transition-colors hover:text-primary/80"
            >
              {t.auth.signIn}
            </Link>
          </p>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
