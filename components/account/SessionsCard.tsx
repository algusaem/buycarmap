"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/auth-client";
import { toast } from "sonner";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslations, useLocale, useMessages } from "next-intl";
import { translateAuthError } from "@/lib/i18n/errors";
import { formatRelativeTime, parseDeviceLabel } from "@/lib/format";
import type { Translations } from "@/lib/i18n/types";
import { signOutEverywhere } from "@/server/account/actions";
import { useMySessions } from "@/lib/hooks/useMySessions";

// BAUTH-4 (docs/specs/core-better-auth.md): lists the signed-in user's own
// sessions (device, browser, last use), with a "Sign out" per other session
// and a "Sign out of all other sessions" action — above the pre-existing
// "sign out everywhere" button, which is the only destructive one that also
// drops this device's own session.
function deviceLabelText(t: ReturnType<typeof useTranslations>, userAgent: string): string {
  const { browser, os } = parseDeviceLabel(userAgent);

  if (!browser && !os) return t("account.sessions.unknownDevice");
  if (browser && os) return `${browser} · ${os}`;
  return browser ?? os ?? t("account.sessions.unknownDevice");
}

function SessionsList() {
  const t = useTranslations();
  const messages = useMessages() as Translations;
  const locale = useLocale();
  const { sessions, status, revokeSession, revokeOthers } = useMySessions();
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);

  const hasOtherSessions = sessions.some((item) => !item.current);

  const onRevoke = async (sessionId: string) => {
    setRevokingId(sessionId);
    const result = await revokeSession(sessionId);
    setRevokingId(null);

    if (!result.success) {
      toast.error(translateAuthError(messages, result.error));
    }
  };

  const onRevokeOthers = async () => {
    setRevokingOthers(true);
    const result = await revokeOthers();
    setRevokingOthers(false);

    if (!result.success) {
      toast.error(translateAuthError(messages, result.error));
      return;
    }

    toast.success(t("account.sessions.signedOutOthers"));
  };

  if (status === "loading") {
    return (
      <div className="space-y-2" aria-hidden="true">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (status === "error") {
    return <p className="text-sm text-destructive">{t("account.sessions.loadError")}</p>;
  }

  if (sessions.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("account.sessions.empty")}</p>;
  }

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-border/50">
        {sessions.map((item) => {
          const deviceLabel = deviceLabelText(t, item.userAgent);

          return (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <span className="flex min-w-0 flex-col text-sm">
                <span className="truncate font-medium">
                  {deviceLabel}
                  {item.current && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {t("account.sessions.current")}
                    </span>
                  )}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {formatRelativeTime(item.lastUsedAt, locale)}
                </span>
              </span>

              {!item.current && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={revokingId !== null}
                  // Every row says "Sign out", so a screen reader needs the
                  // device it is about to end to tell them apart.
                  aria-label={`${t("account.sessions.signOutSession")} — ${deviceLabel}`}
                  onClick={() => onRevoke(item.id)}
                >
                  {revokingId === item.id ? (
                    <span className="flex items-center gap-2">
                      <AiOutlineLoading3Quarters className="h-3.5 w-3.5 animate-spin" />
                      {t("account.sessions.signingOutSession")}
                    </span>
                  ) : (
                    t("account.sessions.signOutSession")
                  )}
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      {hasOtherSessions && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={revokingOthers}
          onClick={onRevokeOthers}
        >
          {revokingOthers ? (
            <span className="flex items-center gap-2">
              <AiOutlineLoading3Quarters className="h-4 w-4 animate-spin" />
              {t("account.sessions.signingOutOthers")}
            </span>
          ) : (
            t("account.sessions.signOutOthers")
          )}
        </Button>
      )}
    </div>
  );
}

export function SessionsCard() {
  const t = useTranslations();
  const messages = useMessages() as Translations;
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const onSignOutEverywhere = async () => {
    setIsSigningOut(true);

    const result = await signOutEverywhere();

    if (!result.success) {
      setIsSigningOut(false);
      toast.error(translateAuthError(messages, result.error));
      return;
    }

    // Every session, including this device's, was just revoked — drop the
    // cookie here rather than waiting for the next revalidation to notice.
    await authClient.signOut();
    router.push("/");
  };

  return (
    <Card className="border-border/50 bg-card/80">
      <CardHeader className="space-y-1">
        <CardTitle className="text-lg font-bold">{t("account.sessions.title")}</CardTitle>
        <CardDescription>{t("account.sessions.description")}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <SessionsList />

        <p className="text-sm text-muted-foreground">{t("account.sessions.warning")}</p>

        <Button
          type="button"
          variant="outline"
          disabled={isSigningOut}
          onClick={onSignOutEverywhere}
        >
          {isSigningOut ? (
            <span className="flex items-center gap-2">
              <AiOutlineLoading3Quarters className="h-4 w-4 animate-spin" />
              {t("account.sessions.submitting")}
            </span>
          ) : (
            t("account.sessions.submit")
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
