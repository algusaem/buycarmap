"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FcGoogle } from "react-icons/fc";
import { FaGithub } from "react-icons/fa";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/lib/i18n/client";
import { translateAuthError } from "@/lib/i18n/errors";
import { unlinkAccount } from "@/server/account/actions";

interface ConnectedAccountsProps {
  providers: string[];
  /** When false, the sole remaining provider cannot be disconnected. */
  hasPassword: boolean;
}

const PROVIDER_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  google: FcGoogle,
  github: FaGithub,
};

const PROVIDER_LABELS: Record<string, string> = {
  google: "Google",
  github: "GitHub",
};

export function ConnectedAccounts({ providers, hasPassword }: ConnectedAccountsProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  const onUnlink = async (provider: string) => {
    setPending(provider);

    const formData = new FormData();
    formData.append("provider", provider);

    const result = await unlinkAccount(formData);
    setPending(null);

    if (!result.success) {
      toast.error(translateAuthError(t, result.error));
      return;
    }

    toast.success(t.account.providers.unlinked);
    router.refresh();
  };

  return (
    <Card className="border-border/50 bg-card/80">
      <CardHeader className="space-y-1">
        <CardTitle className="text-lg font-bold">{t.account.providers.title}</CardTitle>
        <CardDescription>{t.account.providers.description}</CardDescription>
      </CardHeader>

      <CardContent>
        {providers.length === 0 && (
          <p className="text-sm text-muted-foreground">{t.account.providers.none}</p>
        )}

        {providers.length > 0 && (
          <ul className="divide-y divide-border/50">
            {providers.map((provider) => {
              const Icon = PROVIDER_ICONS[provider];
              // Removing the only way in would strand the account: no password
              // to fall back on, and password reset skips passwordless users.
              const isLastMethod = !hasPassword && providers.length === 1;

              return (
                <li
                  key={provider}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <span className="flex min-w-0 items-center gap-2 text-sm">
                    {Icon && <Icon className="h-4 w-4 shrink-0" />}
                    <span className="truncate">{PROVIDER_LABELS[provider] ?? provider}</span>
                  </span>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isLastMethod || pending !== null}
                    title={isLastMethod ? t.account.providers.lastMethodHint : undefined}
                    onClick={() => onUnlink(provider)}
                  >
                    {pending === provider ? (
                      <span className="flex items-center gap-2">
                        <AiOutlineLoading3Quarters className="h-3.5 w-3.5 animate-spin" />
                        {t.account.providers.unlinking}
                      </span>
                    ) : (
                      t.account.providers.unlink
                    )}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        {!hasPassword && providers.length === 1 && (
          <p className="mt-3 text-xs text-muted-foreground">{t.account.providers.lastMethodHint}</p>
        )}
      </CardContent>
    </Card>
  );
}
