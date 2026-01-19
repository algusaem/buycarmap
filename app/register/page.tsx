"use client";

import Link from "next/link";
import * as motion from "motion/react-client";
import { AuthBackground } from "@/components/auth/AuthBackground";
import { BrandHeader } from "@/components/auth/BrandHeader";
import { RegisterForm } from "@/components/auth/RegisterForm";

export default function RegisterPage() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background">
      <AuthBackground />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-8">
          <BrandHeader />
          <RegisterForm />

          <motion.p
            className="text-center text-xs text-muted-foreground/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.9 }}
          >
            By signing up, you agree to our{" "}
            <Link
              href="/terms"
              className="underline hover:text-muted-foreground"
            >
              Terms
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy"
              className="underline hover:text-muted-foreground"
            >
              Privacy Policy
            </Link>
          </motion.p>
        </div>
      </div>
    </div>
  );
}
