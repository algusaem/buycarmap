import Link from "next/link";
import { AuthBackground } from "@/components/auth/AuthBackground";
import { BrandHeader } from "@/components/auth/BrandHeader";
import { ConfirmEmailForm } from "@/components/auth/ConfirmEmailForm";
import { LegalNotice } from "@/components/auth/LegalNotice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getTranslations } from "next-intl/server";

interface ConfirmEmailPageProps {
  // Next 16 delivers search params as a Promise.
  searchParams: Promise<{ token?: string }>;
}

export default async function ConfirmEmailPage({ searchParams }: ConfirmEmailPageProps) {
  const { token } = await searchParams;
  const t = await getTranslations();

  // Presence only. Validity is decided by the action on submit, so that a link
  // prefetch cannot burn the token.
  return (
    <div className="relative flex flex-1 flex-col w-full overflow-y-auto bg-background">
      <AuthBackground />

      <div className="relative z-10 flex min-h-full items-center justify-center px-4 py-6">
        <div className="w-full max-w-md space-y-6">
          <BrandHeader />

          {token ? (
            <ConfirmEmailForm token={token} />
          ) : (
            <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
              <CardHeader className="space-y-1 pb-4">
                <CardTitle className="text-2xl font-bold">
                  {t("confirmEmail.invalidTitle")}
                </CardTitle>
                <CardDescription>{t("confirmEmail.invalidDescription")}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full" size="lg">
                  <Link href="/account">{t("confirmEmail.backToAccount")}</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          <LegalNotice />
        </div>
      </div>
    </div>
  );
}
