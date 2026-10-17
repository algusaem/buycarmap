"use client";

import { type RefObject, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as Sentry from "@sentry/nextjs";
import { AnimatePresence } from "motion/react";
import * as motion from "motion/react-client";
import { useMessages, useTranslations } from "next-intl";
import { toast } from "sonner";
import { FieldMessage } from "@/components/auth/FieldMessage";
import { BusyButton } from "@/components/ui/BusyButton";
import { Skeleton } from "@/components/ui/skeleton";
import { crossFade } from "@/lib/animations";
import { authClient } from "@/lib/auth/auth-client";
import { AUTH_ERROR } from "@/lib/auth/errors";
import { useAccountLabels } from "@/lib/hooks/useAccountLabels";
import { useMySessions } from "@/lib/hooks/useMySessions";
import { translateAuthError, translateRefusal } from "@/lib/i18n/errors";
import type { Translations } from "@/lib/i18n/types";
import { signOutEverywhere, type AccountResult, type MySession } from "@/server/account/actions";
import {
  AccountDialog,
  type AccountDialogFrameProps,
  AccountDialogTitle,
  DialogCancel,
  useAccountDialog,
} from "./AccountDialog";
import { CardBadge } from "./AccountCard";

// docs/specs/redesign-pages.md (PAGES-49 to PAGES-51, PAGES-72, PAGES-73;
// BAUTH-4); F7-cuenta-sesiones-google › Sesiones. The user's sessions, read
// again each time it opens: each as «<navegador> en <sistema>», this device
// with the violet «Este dispositivo» and no button, every other with when it
// was last used and its «Cerrar sesión», named with its device. Then «Cerrar
// las demás»; after a divider the warning and «Cerrar sesión en todas
// partes», secondary since signing back in undoes it; and «Cerrar», where the
// focus starts. Loading, rows shaped like the list in a polite status; a
// failed read, the alert and «Reintentar», never a toast, which stays on
// screen with «Reintentar» busy while the read runs again. The states
// cross-fade, the actions with them, and a row leaves the list with a fade
// once its session ends. A refused action is the error toast. The user's own
// session is always listed, so the list is never empty and has no empty
// state (decided 2026-10-16, owner); a read that answers none (this session
// ended elsewhere) is the failed read (Edge cases).

/** The placeholder rows while the list loads, as many as the board draws. */
const PLACEHOLDER_ROWS = ["first", "second"];

interface SessionsDialogProps extends AccountDialogFrameProps {
  /** Called after sessions ended, so the card's line reads them again. */
  onChanged: () => void;
}

export function SessionsDialog({
  open,
  isPhone,
  returnFocusRef,
  onClose,
  onChanged,
}: SessionsDialogProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  return (
    <AccountDialog
      open={open}
      onClose={onClose}
      isPhone={isPhone}
      returnFocusRef={returnFocusRef}
      initialFocusRef={closeRef}
    >
      <SessionsBody closeRef={closeRef} onChanged={onChanged} />
    </AccountDialog>
  );
}

interface SessionsBodyProps {
  closeRef: RefObject<HTMLButtonElement | null>;
  onChanged: () => void;
}

function SessionsBody({ closeRef, onChanged }: SessionsBodyProps) {
  const t = useTranslations();
  const messages = useMessages() as Translations;
  const router = useRouter();
  const { run, hold, release } = useAccountDialog();
  const { sessions, status, retrying, reload, revokeSession, revokeOthers } = useMySessions();
  const [pending, setPending] = useState<string | null>(null);

  /** Runs one action of the dialog, busy and holding it open, and reports a refusal. */
  const act = async (key: string, action: () => Promise<AccountResult>) => {
    setPending(key);
    const result = await run(action);
    setPending(null);
    if (!result.success) toast.error(translateRefusal(messages, result.error));
    return result;
  };

  const onRevoke = async (sessionId: string) => {
    const result = await act(sessionId, () => revokeSession(sessionId));
    if (result.success) onChanged();
  };

  const onRevokeOthers = async () => {
    const result = await act("others", revokeOthers);
    if (!result.success) return;
    toast.success(t("account.sessions.signedOutOthers"));
    onChanged();
  };

  const onSignOutEverywhere = async () => {
    setPending("everywhere");
    const result = await run(signOutEverywhere);
    if (!result.success) {
      setPending(null);
      toast.error(translateRefusal(messages, result.error));
      return;
    }
    // Every session, this device's included, was just revoked: nothing may
    // close the dialog or press again before the page leaves (PAGES-72). Drop
    // the cookie here rather than waiting for the next revalidation (BAUTH-4).
    hold();
    try {
      await authClient.signOut();
      router.push("/");
    } catch (error) {
      Sentry.captureException(error);
      release();
      setPending(null);
      toast.error(translateAuthError(messages, AUTH_ERROR.generic));
    }
  };

  return (
    <>
      <AccountDialogTitle>{t("account.sessions.title")}</AccountDialogTitle>
      <AnimatePresence mode="wait" initial={false}>
        {status === "error" && (
          <motion.div key="error" {...crossFade} className="flex flex-col gap-3.5">
            <FieldMessage show role="alert">
              {t("account.sessions.loadError")}
            </FieldMessage>
            <BusyButton
              type="button"
              variant="secondary"
              size="48"
              busy={retrying}
              onClick={reload}
              className="w-full"
            >
              {t("errors.retry")}
            </BusyButton>
          </motion.div>
        )}
        {status === "loading" && (
          <motion.div key="loading" {...crossFade} role="status">
            <span className="sr-only">{t("account.loading")}</span>
            <SessionsPlaceholder />
          </motion.div>
        )}
        {status === "ready" && (
          <motion.ul key="ready" {...crossFade} className="m-0 flex list-none flex-col p-0">
            <AnimatePresence initial={false}>
              {sessions.map((session) => (
                <SessionRow
                  key={session.id}
                  session={session}
                  busy={pending === session.id}
                  disabled={pending !== null && pending !== session.id}
                  onRevoke={() => onRevoke(session.id)}
                />
              ))}
            </AnimatePresence>
          </motion.ul>
        )}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {status !== "error" && (
          <motion.div key="actions" {...crossFade} className="flex flex-col gap-3.5">
            <BusyButton
              type="button"
              variant="secondary"
              size="48"
              busy={pending === "others"}
              disabled={pending !== null && pending !== "others"}
              onClick={onRevokeOthers}
              className="w-full"
            >
              {t("account.sessions.signOutOthers")}
            </BusyButton>
            <hr className="m-0 border-0 border-t border-line-soft" />
            <p className="m-0 text-meta leading-normal text-text-muted">
              {t("account.sessions.warning")}
            </p>
            <BusyButton
              type="button"
              variant="secondary"
              size="48"
              busy={pending === "everywhere"}
              disabled={pending !== null && pending !== "everywhere"}
              onClick={onSignOutEverywhere}
              className="w-full"
            >
              {t("account.sessions.submit")}
            </BusyButton>
          </motion.div>
        )}
      </AnimatePresence>
      <DialogCancel ref={closeRef} label={t("common.close")} />
    </>
  );
}

interface SessionRowProps {
  session: MySession;
  busy: boolean;
  disabled: boolean;
  onRevoke: () => void;
}

/** One session: its device (15 / 700) and when it was last used (13px, muted), split by `line-soft`. */
function SessionRow({ session, busy, disabled, onRevoke }: SessionRowProps) {
  const t = useTranslations();
  const { device, lastUsed } = useAccountLabels();
  const label = device(session.userAgent);

  return (
    <motion.li
      {...crossFade}
      className="flex min-h-12.5 items-center justify-between gap-3 border-t border-line-soft py-3"
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-body-15 font-bold">{label}</span>
        {!session.current && (
          <span className="truncate text-small text-text-muted">
            {lastUsed(session.lastUsedAt)}
          </span>
        )}
      </span>
      {session.current && <CardBadge on>{t("account.sessions.current")}</CardBadge>}
      {!session.current && (
        <BusyButton
          type="button"
          variant="secondary"
          size="pad-14"
          busy={busy}
          disabled={disabled}
          // Every row says «Cerrar sesión»: the device tells them apart.
          aria-label={t("account.sessions.signOutSessionNamed", { device: label })}
          onClick={onRevoke}
        >
          {t("account.sessions.signOutSession")}
        </BusyButton>
      )}
    </motion.li>
  );
}

/** Two rows shaped like the list, in `surface-strong` bars since the sheet is `surface` (PAGES-50). */
function SessionsPlaceholder() {
  return (
    <ul aria-hidden="true" className="m-0 flex list-none flex-col p-0">
      {PLACEHOLDER_ROWS.map((row) => (
        <li
          key={row}
          className="flex min-h-12.5 items-center justify-between gap-3 border-t border-line-soft py-3"
        >
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-3.5 w-32 rounded-skeleton-sm bg-surface-strong" />
            <Skeleton className="h-3 w-20 rounded-skeleton-sm bg-surface-strong" />
          </div>
          <Skeleton className="h-9 w-28 rounded-pill bg-surface-strong" />
        </li>
      ))}
    </ul>
  );
}
