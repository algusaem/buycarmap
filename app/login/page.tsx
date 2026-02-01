"use client";

import Link from "next/link";
import * as motion from "motion/react-client";
import { AuthBackground } from "@/components/auth/AuthBackground";
import { BrandHeader } from "@/components/auth/BrandHeader";
import { LoginForm } from "@/components/auth/LoginForm";
import { useTranslation } from "@/lib/i18n/client";

export default function LoginPage() {
  const { t } = useTranslation();

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background">
      <AuthBackground />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-8">
          <BrandHeader />
          <LoginForm />

          <motion.p
            className="text-center text-xs text-muted-foreground/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.9 }}
          >
            {t.auth.legalNotice}{" "}
            <Link
              href="/terms"
              className="underline hover:text-muted-foreground"
            >
              {t.auth.terms}
            </Link>{" "}
            {t.auth.and}{" "}
            <Link
              href="/privacy"
              className="underline hover:text-muted-foreground"
            >
              {t.auth.privacyPolicy}
            </Link>
          </motion.p>
        </div>
      </div>
    </div>
  );
}
