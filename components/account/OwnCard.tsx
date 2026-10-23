"use client";

import { useId } from "react";
import { AnimatePresence } from "motion/react";
import { useTranslations } from "next-intl";
import { initialOf } from "@/components/nav/Avatar";
import { Button } from "@/components/ui/button";
import { PresenceFade } from "@/components/ui/PresenceFade";
import { useAccountLabels } from "@/lib/hooks/useAccountLabels";
import { cardClasses } from "./AccountCard";

// docs/specs/redesign-pages.md (PAGES-29, PAGES-31); AccountCard/README.md ›
// La primera tarjeta es la tuya. The violet avatar with the initial of HEAD-9,
// the name as the card's heading and the email under it — with no name, the
// email is the heading —, the summary line «8 guardados · 3 alertas · en
// BuyCarMap desde marzo», its counts in `text` weight 700, and «Cambiar
// nombre». The line is one message (`account.summary.line`), written once
// for assistive tech and drawn once with its bold counts, hidden from it, so
// it never reads in three pieces. The
// email line fades in and out as a saved name comes and goes.

interface OwnCardProps {
  name: string | null;
  email: string;
  favoritesCount: number;
  alertsCount: number;
  createdAt: Date;
  onChangeName: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

export function OwnCard({
  name,
  email,
  favoritesCount,
  alertsCount,
  createdAt,
  onChangeName,
}: OwnCardProps) {
  const t = useTranslations();
  const { summary } = useAccountLabels();
  const headingId = useId();
  const values = summary(favoritesCount, alertsCount, createdAt);

  return (
    <section aria-labelledby={headingId} className={cardClasses()}>
      <div className="flex min-w-0 items-center gap-3.5">
        <span
          aria-hidden="true"
          className="flex size-12 shrink-0 items-center justify-center rounded-pill bg-violet font-display text-lg font-black text-on-violet lg:size-14 lg:text-account-name"
        >
          {initialOf(name, email)}
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2
            id={headingId}
            className="m-0 truncate font-display text-lg font-black uppercase lg:text-account-name"
          >
            {name || email}
          </h2>
          <AnimatePresence initial={false}>
            {name && (
              <PresenceFade key="email">
                <p className="m-0 truncate text-meta text-text-muted">{email}</p>
              </PresenceFade>
            )}
          </AnimatePresence>
        </div>
      </div>
      <p className="m-0 text-meta leading-normal text-text-muted">
        <span className="sr-only">
          {t.markup("account.summary.line", { ...values, b: (chunks) => chunks })}
        </span>
        <span aria-hidden="true">
          {t.rich("account.summary.line", {
            ...values,
            b: (chunks) => <strong className="font-bold text-text">{chunks}</strong>,
          })}
        </span>
      </p>
      <div className="mt-auto flex pt-1">
        <Button type="button" variant="secondary" size="44" onClick={onChangeName}>
          {t("account.profile.changeCta")}
        </Button>
      </div>
    </section>
  );
}
