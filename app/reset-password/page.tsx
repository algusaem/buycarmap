import { AuthBackground } from "@/components/auth/AuthBackground";
import { BrandHeader } from "@/components/auth/BrandHeader";
import { InvalidResetLink } from "@/components/auth/InvalidResetLink";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { LegalNotice } from "@/components/auth/LegalNotice";

interface ResetPasswordPageProps {
  // Next 16 delivers search params as a Promise.
  searchParams: Promise<{ token?: string }>;
}

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const { token } = await searchParams;

  // Only presence is checked here. Whether the token is real, unexpired and
  // unused is decided by the server action on submit — validating it during
  // render would turn this page into an oracle for probing tokens without
  // ever consuming one.
  return (
    <div className="relative flex flex-1 flex-col w-full overflow-hidden bg-background">
      <AuthBackground />

      <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-6">
        <div className="w-full max-w-md space-y-6">
          <BrandHeader />
          {token ? <ResetPasswordForm token={token} /> : <InvalidResetLink />}
          <LegalNotice />
        </div>
      </div>
    </div>
  );
}
