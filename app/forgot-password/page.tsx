"use client";

import { AuthBackground } from "@/components/auth/AuthBackground";
import { BrandHeader } from "@/components/auth/BrandHeader";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { LegalNotice } from "@/components/auth/LegalNotice";

export default function ForgotPasswordPage() {
  return (
    <div className="relative flex flex-1 flex-col w-full overflow-y-auto bg-background">
      <AuthBackground />

      <div className="relative z-10 flex min-h-full items-center justify-center px-4 py-6">
        <div className="w-full max-w-md space-y-6">
          <BrandHeader />
          <ForgotPasswordForm />
          <LegalNotice />
        </div>
      </div>
    </div>
  );
}
