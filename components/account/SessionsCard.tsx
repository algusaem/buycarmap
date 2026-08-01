"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
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
import { signOutEverywhere } from "@/app/actions/account";

export function SessionsCard() {
  const { t } = useTranslation();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const onSignOutEverywhere = async () => {
    setIsSigningOut(true);

    const result = await signOutEverywhere();

    if (!result.success) {
      setIsSigningOut(false);
      toast.error(translateAuthError(t, result.error));
      return;
    }

    // The revocation clock now excludes this device's token too, so drop the
    // cookie here rather than waiting for the next revalidation to notice.
    await signOut({ callbackUrl: "/" });
  };

  return (
    <Card className="border-border/50 bg-card/80">
      <CardHeader className="space-y-1">
        <CardTitle className="text-lg font-bold">
          {t.account.sessions.title}
        </CardTitle>
        <CardDescription>{t.account.sessions.description}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {t.account.sessions.warning}
        </p>

        <Button
          type="button"
          variant="outline"
          disabled={isSigningOut}
          onClick={onSignOutEverywhere}
        >
          {isSigningOut ? (
            <span className="flex items-center gap-2">
              <AiOutlineLoading3Quarters className="h-4 w-4 animate-spin" />
              {t.account.sessions.submitting}
            </span>
          ) : (
            t.account.sessions.submit
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
