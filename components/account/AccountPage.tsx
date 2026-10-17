"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAccountLabels } from "@/lib/hooks/useAccountLabels";
import { useAccountPage, type AccountDialogKey } from "@/lib/hooks/useAccountPage";
import { useIsPhone } from "@/lib/hooks/useIsPhone";
import type { ListedSession } from "@/server/account/actions";
import { AccountCard, CardBadge } from "./AccountCard";
import type { AccountDialogFrameProps } from "./AccountDialog";
import { AccountHeading } from "./AccountHeading";
import { DataExportCard } from "./DataExportCard";
import { DeleteAccountDialog } from "./DeleteAccountDialog";
import { EmailCard } from "./EmailCard";
import { EmailDialog } from "./EmailDialog";
import { GoogleCard } from "./GoogleCard";
import { NameDialog } from "./NameDialog";
import { OwnCard } from "./OwnCard";
import { PasswordDialog } from "./PasswordDialog";
import { SessionsDialog } from "./SessionsDialog";
import { SignOutButton } from "./SignOutButton";
import { TwoFactorDialog } from "./TwoFactorDialog";

// docs/specs/redesign-pages.md (PAGES-25 to PAGES-55, PAGES-71 to PAGES-73);
// F0-cuenta and its F7-cuenta-* boards. /account as a summary: «Cuenta», its
// line and «Cerrar sesión» on the heading's row (after the last card on the
// phone, HEAD-13, HEAD-18), then the cards — the user's own, «Correo»,
// «Contraseña», «Dos pasos», «Google», «Sesiones», «Tus datos», «Eliminar
// cuenta» — in three columns 20px apart from `lg`, one column 12px apart
// below. CSS breakpoints place the line and «Cerrar sesión», as the loading
// state does, so nothing waits on the client's media queries. A
// password-less (Google-only) account has no «Contraseña» and no «Dos pasos»
// card. Each card's button opens its form in a dialog (a sheet on the phone);
// useAccountPage keeps what those forms change, so the cards follow without a
// reload.

export interface AccountPageProps {
  name: string | null;
  email: string;
  emailConfirmed: boolean;
  hasPassword: boolean;
  twoFactorEnabled: boolean;
  version: number;
  createdAt: Date;
  /** Linked providers other than `credential` (PAGES-60). */
  providers: string[];
  favoritesCount: number;
  alertsCount: number;
  /** Newest-used first (PAGES-60). */
  sessions: ListedSession[];
}

export function AccountPage(props: AccountPageProps) {
  const { email, emailConfirmed, hasPassword, sessions } = props;
  const t = useTranslations();
  const router = useRouter();
  const isPhone = useIsPhone();
  const { sessionsLine } = useAccountLabels();
  const page = useAccountPage(props);

  const dialogProps = (key: AccountDialogKey): AccountDialogFrameProps => ({
    open: page.dialog === key,
    isPhone,
    returnFocusRef: page.openerRef,
    onClose: page.close,
  });

  // The change ended every other session (PAGES-42): the «Sesiones» card reads them again.
  const onPasswordSaved = (next: number | undefined) => {
    page.passwordSaved(next);
    router.refresh();
  };

  const onCodesSaved = () => {
    if (page.codesSaved()) toast.success(t("account.twoFactor.enabledToast"));
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background">
      <AccountHeading signOut={<SignOutButton size="pad-14" className="hidden lg:inline-flex" />}>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3 lg:gap-5">
          <OwnCard
            name={page.name}
            email={email}
            favoritesCount={props.favoritesCount}
            alertsCount={props.alertsCount}
            createdAt={props.createdAt}
            onChangeName={page.open("name")}
          />
          <EmailCard
            email={email}
            emailConfirmed={emailConfirmed}
            hasPassword={hasPassword}
            onChangeEmail={page.open("email")}
          />
          {hasPassword && (
            <AccountCard title={t("account.security.title")} line={t("account.security.line")}>
              <Button type="button" variant="secondary" size="44" onClick={page.open("password")}>
                {t("account.security.changeCta")}
              </Button>
            </AccountCard>
          )}
          {hasPassword && (
            <AccountCard
              title={t("account.twoFactor.title")}
              badge={
                <CardBadge on={page.twoFactorEnabled}>
                  {page.twoFactorEnabled
                    ? t("account.twoFactor.enabled")
                    : t("account.twoFactor.disabled")}
                </CardBadge>
              }
              line={t("account.twoFactor.line")}
            >
              <Button type="button" variant="secondary" size="44" onClick={page.open("twoFactor")}>
                {page.twoFactorEnabled
                  ? t("account.twoFactor.manageCta")
                  : t("account.twoFactor.enableCta")}
              </Button>
            </AccountCard>
          )}
          <GoogleCard
            providers={page.providers}
            hasPassword={hasPassword}
            onUnlinked={page.googleUnlinked}
          />
          <AccountCard
            title={t("account.sessions.title")}
            badge={
              <CardBadge on={false}>
                {t("account.sessions.open", { count: sessions.length })}
              </CardBadge>
            }
            line={sessions.length > 0 ? sessionsLine(sessions) : undefined}
          >
            <Button type="button" variant="secondary" size="44" onClick={page.open("sessions")}>
              {t("account.sessions.signOutOthers")}
            </Button>
          </AccountCard>
          <DataExportCard />
          <AccountCard
            title={t("account.danger.title")}
            line={t("account.danger.line")}
            tone="danger"
            wide={hasPassword}
          >
            <Button type="button" variant="danger" size="44" onClick={page.open("delete")}>
              {t("account.danger.submit")}
            </Button>
          </AccountCard>
        </div>

        <SignOutButton className="mt-3 w-full lg:hidden" />
      </AccountHeading>

      <NameDialog
        {...dialogProps("name")}
        name={page.name}
        version={page.version}
        onSaved={page.nameSaved}
      />
      <EmailDialog {...dialogProps("email")} />
      <PasswordDialog
        {...dialogProps("password")}
        email={email}
        version={page.version}
        onSaved={onPasswordSaved}
      />
      <TwoFactorDialog
        {...dialogProps("twoFactor")}
        enabled={page.twoFactorEnabled}
        codes={page.codes}
        onCodes={page.showCodes}
        onCodesSaved={onCodesSaved}
        onDisabled={page.twoFactorDisabled}
      />
      <SessionsDialog {...dialogProps("sessions")} onChanged={() => router.refresh()} />
      <DeleteAccountDialog {...dialogProps("delete")} hasPassword={hasPassword} />
    </div>
  );
}
