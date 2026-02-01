"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import * as motion from "motion/react-client";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { ArrowLeft } from "lucide-react";
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
import { PasswordInput } from "./PasswordInput";
import { useTranslation } from "@/lib/i18n/client";
import { registerSchema, RegisterInput } from "@/lib/validations/auth";
import { register as registerUser } from "@/app/actions/register";

export function RegisterForm() {
  const { t } = useTranslation();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  });

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
      toast.error(result.error ?? t.auth.registrationFailed);
      return;
    }

    await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
    });

    toast.success(t.auth.accountCreated);
    router.push("/");
    router.refresh();
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
            {t.auth.createAccount}
          </CardTitle>
          <CardDescription>{t.auth.signUpDescription}</CardDescription>
        </CardHeader>

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
                <p className="text-sm text-destructive">{errors.name.message}</p>
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
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t.auth.password}</Label>
              <PasswordInput
                id="password"
                placeholder={t.auth.passwordPlaceholder}
                autoComplete="new-password"
                className="bg-background/50"
                error={errors.password?.message}
                {...register("password")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t.auth.confirmPassword}</Label>
              <PasswordInput
                id="confirmPassword"
                placeholder={t.auth.confirmPasswordPlaceholder}
                autoComplete="new-password"
                className="bg-background/50"
                error={errors.confirmPassword?.message}
                {...register("confirmPassword")}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isSubmitting}
            >
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
        </CardContent>

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
