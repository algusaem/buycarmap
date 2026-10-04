import { AuthBackground } from "@/components/auth/AuthBackground";
import { BrandHeader } from "@/components/auth/BrandHeader";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { LegalNotice } from "@/components/auth/LegalNotice";
import { isGitHubConfigured, isGoogleConfigured } from "@/lib/app-config";

export default function RegisterPage() {
  const oauthProviders = [
    ...(isGoogleConfigured ? ["google"] : []),
    ...(isGitHubConfigured ? ["github"] : []),
  ];

  return (
    <div className="relative flex flex-1 flex-col w-full overflow-y-auto bg-background">
      <AuthBackground />

      <div className="relative z-10 flex min-h-full items-center justify-center px-4 py-6">
        <div className="w-full max-w-md space-y-6">
          <BrandHeader />
          <RegisterForm oauthProviders={oauthProviders} />
          <LegalNotice />
        </div>
      </div>
    </div>
  );
}
