import { AuthBackground } from "@/components/auth/AuthBackground";
import { BrandHeader } from "@/components/auth/BrandHeader";
import { InvalidVerifyLink } from "@/components/auth/InvalidVerifyLink";
import { VerifyRegistrationForm } from "@/components/auth/VerifyRegistrationForm";
import { LegalNotice } from "@/components/auth/LegalNotice";

interface VerifyEmailPageProps {
  // Next 16 delivers search params as a Promise.
  searchParams: Promise<{ token?: string }>;
}

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const { token } = await searchParams;

  // Only presence is checked here. Whether the token is real and unexpired is
  // decided by the server action on submit — redeeming during render would let
  // a mail scanner's link prefetch create the account before the recipient
  // ever sees this page.
  return (
    <div className="relative flex flex-1 flex-col w-full overflow-y-auto bg-background">
      <AuthBackground />

      <div className="relative z-10 flex min-h-full items-center justify-center px-4 py-6">
        <div className="w-full max-w-md space-y-6">
          <BrandHeader />
          {token ? <VerifyRegistrationForm token={token} /> : <InvalidVerifyLink />}
          <LegalNotice />
        </div>
      </div>
    </div>
  );
}
