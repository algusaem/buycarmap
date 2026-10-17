"use client";

import { Fragment, type ReactNode } from "react";
import { AnimatePresence } from "motion/react";
import { useMessages, useTranslations } from "next-intl";
import { BusyButton } from "@/components/ui/BusyButton";
import type { ActionResult } from "@/lib/auth/settle-action";
import { useTokenConfirmation } from "@/lib/hooks/useTokenConfirmation";
import { translateAuthError } from "@/lib/i18n/errors";
import type { Translations } from "@/lib/i18n/types";
import { AccessState } from "./AccessLayout";
import { FieldMessage } from "./FieldMessage";

interface TokenConfirmationProps {
  token: string;
  /** The Server Action that redeems the token. */
  action: (formData: FormData) => Promise<ActionResult>;
  /** The page's message namespace: its confirm and confirmed states' copy. */
  copy: "verifyEmail" | "confirmEmail";
  /** The confirmed state's way forward. */
  confirmed: ReactNode;
  /** The expired-link state, reached from the button: it takes the focus. */
  expired: ReactNode;
}

/**
 * docs/specs/redesign-pages.md (PAGES-13 to PAGES-19, PAGES-76): a page that
 * redeems an emailed token with one button — /verify-email and
 * /confirm-email. The confirm state, then the confirmed state, or the
 * expired-link state when the token is rejected, each giving way to the next
 * with no toast, the focus moving to the new state's headline. Any other
 * refusal is the alert above the button. No email address is shown: that
 * would mean looking the token up at render (the spec's Decisions). The
 * request lifecycle is useTokenConfirmation's.
 */
export function TokenConfirmation({
  token,
  action,
  copy,
  confirmed,
  expired,
}: TokenConfirmationProps) {
  const t = useTranslations(copy);
  const messages = useMessages() as Translations;
  const { state, busy, error, confirm } = useTokenConfirmation(token, action);
  const formError = error && translateAuthError(messages, error);

  return (
    <AnimatePresence mode="wait" initial={false}>
      {state === "confirm" && (
        <AccessState
          key="confirm"
          question={t("headline")}
          punchline={t("headlineHighlight")}
          line={t("line")}
          title={t("title")}
          hint={t("hint")}
        >
          <FieldMessage show={!!formError} role="alert">
            {formError}
          </FieldMessage>
          <BusyButton type="button" variant="primary" size="display" busy={busy} onClick={confirm}>
            {t("submit")}
          </BusyButton>
        </AccessState>
      )}
      {state === "confirmed" && (
        <AccessState
          key="confirmed"
          question={t("successHeadline")}
          punchline={t("successHeadlineHighlight")}
          line={t("successDescription")}
          title={t("successTitle")}
          focusHeading
        >
          {confirmed}
        </AccessState>
      )}
      {state === "expired" && <Fragment key="expired">{expired}</Fragment>}
    </AnimatePresence>
  );
}
