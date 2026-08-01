"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import * as motion from "motion/react-client";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { CircleCheck } from "lucide-react";
import { fadeInUp } from "@/lib/animations";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTranslation } from "@/lib/i18n/client";
import { translateAuthError } from "@/lib/i18n/errors";
import { verifyRegistration } from "@/app/actions/verify-registration";

interface VerifyRegistrationFormProps {
  token: string;
}

export function VerifyRegistrationForm({ token }: VerifyRegistrationFormProps) {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  // A button rather than confirming on page load: corporate mail scanners
  // fetch every link in an inbox, and an account-creating GET would let a
  // scanner burn the token before the recipient ever opens the page.
  const onConfirm = async () => {
    setIsSubmitting(true);

    const formData = new FormData();
    formData.append("token", token);

    const result = await verifyRegistration(formData);

    if (!result.success) {
      setIsSubmitting(false);
      toast.error(translateAuthError(t, result.error));
      return;
    }

    setConfirmed(true);
    toast.success(t.verifyEmail.success);
  };

  return (
    <motion.div {...fadeInUp}>
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-2xl font-bold">
            {confirmed ? t.verifyEmail.successTitle : t.verifyEmail.title}
          </CardTitle>
          <CardDescription>
            {confirmed
              ? t.verifyEmail.successDescription
              : t.verifyEmail.description}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {confirmed && (
            <div
              className="flex flex-col items-center gap-4 py-2 text-center"
              aria-live="polite"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 ring-1 ring-accent/20">
                <CircleCheck className="h-6 w-6 text-accent" />
              </div>
              <Button asChild className="w-full" size="lg">
                <Link href="/login">{t.verifyEmail.signIn}</Link>
              </Button>
            </div>
          )}

          {!confirmed && (
            <Button
              type="button"
              className="w-full"
              size="lg"
              disabled={isSubmitting}
              onClick={onConfirm}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <AiOutlineLoading3Quarters className="h-4 w-4 animate-spin" />
                  {t.verifyEmail.submitting}
                </span>
              ) : (
                t.verifyEmail.submit
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
