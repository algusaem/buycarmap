"use client";

import { type Ref, useId } from "react";
import Link from "next/link";
import { AnimatePresence } from "motion/react";
import * as motion from "motion/react-client";
import { useLocale, useTranslations } from "next-intl";
import { activeHandlers, CarPhoto, listingMeta } from "@/components/map/CarCard";
import { sourceLabel } from "@/components/map/SourceBadge";
import type { AlertSummary } from "@/interfaces/alert";
import type { CarListing } from "@/interfaces/listing";
import { formatPrice } from "@/lib/format";
import { keys } from "@/components/favorites/SavedPlaceholders";
import { Skeleton } from "@/components/ui/skeleton";
import { crossFade } from "@/lib/animations";
import { useAlertLabels } from "@/lib/hooks/useAlertLabels";
import { cn } from "@/lib/utils";

// docs/specs/redesign-alerts.md (ALERTUI-6 to ALERTUI-9, ALERTUI-11,
// ALERTUI-28, ALERTUI-41); docs/design/system/components/AlertCard/README.md
// and R3-alertas. Each alert on /alerts: the open one with its criteria as
// chips and its newest matches, the folded ones on one line, which open on a
// press, and on the phone one link to the alert's page. `surface`, a `line`
// border (`lime` when open), `radius-card`; 18px 20px of padding and 12px
// between blocks on desktop, 16px and 10px on the phone.

/** How many matches the open card shows; past it, «Ver las N coincidencias» (ALERTUI-7). */
const OPEN_CARD_MATCHES = 4;

const SEPARATOR = " · ";

/**
 * The ids a card's parts carry, so a folded or phone card, named by its alert,
 * is described by «En pausa», its count and its criteria (as SavedRow is).
 */
function cardIds(base: string) {
  return {
    name: `${base}-name`,
    paused: `${base}-paused`,
    count: `${base}-count`,
    criteria: `${base}-criteria`,
  };
}

type CardIds = ReturnType<typeof cardIds>;

/** `aria-describedby` for a card: «En pausa» when paused, the count, then the criteria when any. */
function describedBy(alert: AlertSummary, ids: CardIds, parts: string[]): string {
  return [!alert.active && ids.paused, ids.count, parts.length > 0 && ids.criteria]
    .filter((id): id is string => typeof id === "string")
    .join(" ");
}

/** «En pausa»: the photos' source badge, `scrim` with `text-muted` (AlertCard/README.md › En pausa). */
function PausedBadge({ id }: { id: string }) {
  const t = useTranslations();
  return (
    <span
      id={id}
      className="shrink-0 rounded-pill bg-scrim px-2.5 py-1.25 text-xs font-bold whitespace-nowrap text-text-muted"
    >
      {t("alerts.inactive")}
    </span>
  );
}

interface AlertNameRowProps {
  alert: AlertSummary;
  ids: CardIds;
  /** The phone card's smaller name and gaps, with «En pausa» on its criteria line instead. */
  phone?: boolean;
}

/** The name in capitals, «En pausa» beside it when paused (desktop), and the match count on the right. */
function AlertNameRow({ alert, ids, phone = false }: AlertNameRowProps) {
  const labels = useAlertLabels();

  return (
    <span className={cn("flex min-w-0 items-center justify-between", phone ? "gap-2" : "gap-2.5")}>
      <span className="flex min-w-0 items-center gap-2.5">
        <strong
          id={ids.name}
          className={cn(
            "min-w-0 truncate font-display font-extrabold uppercase",
            phone ? "text-sm" : "text-alert-name",
          )}
        >
          {alert.label}
        </strong>
        {!phone && !alert.active && <PausedBadge id={ids.paused} />}
      </span>
      <span
        id={ids.count}
        className="shrink-0 rounded-pill border border-line px-2.75 py-1.5 text-small font-extrabold whitespace-nowrap text-text-muted tabular-nums"
      >
        {labels.matchCount(alert.matchCount)}
      </span>
    </span>
  );
}

interface CriteriaLineProps {
  id: string;
  parts: string[];
  className: string;
}

/** The criteria on one line, « · » apart; nothing when none could be read. */
function CriteriaLine({ id, parts, className }: CriteriaLineProps) {
  if (parts.length === 0) return null;
  return (
    <span id={id} className={cn("min-w-0 truncate text-text-muted", className)}>
      {parts.join(SEPARATOR)}
    </span>
  );
}

interface CriteriaChipsProps {
  parts: string[];
}

/**
 * The criteria as chips, in order: 13px weight 600, a `line` outline, 6px
 * apart. A chip longer than the row is cut to one line with «…», its whole
 * text still in the DOM for assistive tech.
 */
export function CriteriaChips({ parts }: CriteriaChipsProps) {
  if (parts.length === 0) return null;
  return (
    <ul className="m-0 flex min-w-0 list-none flex-wrap gap-1.5 p-0">
      {parts.map((part) => (
        <li
          key={part}
          className="max-w-full min-w-0 truncate rounded-pill border border-line px-2.75 py-1.5 text-small font-semibold text-text"
        >
          {part}
        </li>
      ))}
    </ul>
  );
}

interface FoldedAlertCardProps {
  alert: AlertSummary;
  onOpen: () => void;
}

/** A folded card: one button named by the alert, which opens it (ALERTUI-6, ALERTUI-11). */
export function FoldedAlertCard({ alert, onOpen }: FoldedAlertCardProps) {
  const labels = useAlertLabels();
  const ids = cardIds(useId());
  const parts = labels.criteria(alert);

  return (
    <button
      type="button"
      aria-expanded="false"
      aria-labelledby={ids.name}
      aria-describedby={describedBy(alert, ids, parts)}
      onClick={onOpen}
      className="flex w-full min-w-0 cursor-pointer flex-col gap-3 rounded-card border border-line bg-surface px-5 py-4.5 text-left text-text transition-[background-color] hover:bg-surface-strong"
    >
      <AlertNameRow alert={alert} ids={ids} />
      <CriteriaLine id={ids.criteria} parts={parts} className="text-sm" />
      <span className="text-small text-text-muted">{labels.createdOn(alert.createdAt)}</span>
    </button>
  );
}

interface OpenAlertCardProps {
  alert: AlertSummary;
  /** Every match of the alert, newest first: the card shows the first four. */
  matches: CarListing[];
  /** The matches whose pin is active, outlined (ALERTUI-17). */
  activeIds: ReadonlySet<string>;
  onActiveChange: (listingId: string | null) => void;
  /** «Eliminar», which opens the confirmation (ALERTUI-33). */
  onDelete: (opener: HTMLButtonElement) => void;
  /**
   * The server has not read this alert's matches yet (after a delete, until
   * its next data): the match placeholders, and no «Ver las …» (ALERTUI-35).
   */
  pending?: boolean;
  /** Takes the card's `<article>` as it mounts: a press that opened it moves the focus there (ALERTUI-57). */
  articleRef?: Ref<HTMLElement>;
}

/** The open card's matches while they load: four match cards' shapes, in `surface-strong` bars. */
function MatchPlaceholders() {
  return (
    <div
      aria-busy="true"
      data-testid="open-card-loading"
      className="grid grid-cols-2 gap-3.5 xl:grid-cols-4"
    >
      {keys(OPEN_CARD_MATCHES).map((key) => (
        <div key={key} aria-hidden="true" className="flex min-w-0 flex-col gap-1">
          <Skeleton className="h-27.5 rounded-field bg-surface-strong" />
          <Skeleton className="mt-1 h-3 w-1/3 bg-surface-strong" />
          <Skeleton className="h-4 w-4/5 bg-surface-strong" />
          <Skeleton className="h-3.5 w-3/5 bg-surface-strong" />
          <Skeleton className="mt-0.5 h-5 w-1/2 rounded-skeleton bg-surface-strong" />
        </div>
      ))}
    </div>
  );
}

/** The open card, with the lime border: the chips, the newest matches and «Eliminar» (ALERTUI-7). */
export function OpenAlertCard({
  alert,
  matches,
  activeIds,
  onActiveChange,
  onDelete,
  pending = false,
  articleRef,
}: OpenAlertCardProps) {
  const t = useTranslations();
  const labels = useAlertLabels();
  const ids = cardIds(useId());
  const shown = matches.slice(0, OPEN_CARD_MATCHES);

  return (
    <article
      ref={articleRef}
      aria-labelledby={ids.name}
      // Focused by script only, when a press opened it (ALERTUI-57).
      tabIndex={-1}
      className="flex min-w-0 flex-col gap-3 rounded-card border border-lime bg-surface px-5 py-4.5"
    >
      <AlertNameRow alert={alert} ids={ids} />
      <CriteriaChips parts={labels.criteria(alert)} />
      {/* The placeholders give way to the matches with a cross-fade (RULES.md §17). */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={pending ? "pending" : "loaded"}
          {...crossFade}
          className="flex min-w-0 flex-col gap-3"
        >
          {pending && <MatchPlaceholders />}
          {!pending && shown.length === 0 && (
            <p className="m-0 text-body-15 text-text-muted">{t("alerts.noMatchesYet")}</p>
          )}
          {shown.length > 0 && (
            <ul className="m-0 grid list-none grid-cols-2 gap-3.5 p-0 xl:grid-cols-4">
              {shown.map((listing) => (
                <li key={listing.id} className="min-w-0">
                  <AlertMatchCard
                    listing={listing}
                    active={activeIds.has(listing.id)}
                    onActiveChange={(active) => onActiveChange(active ? listing.id : null)}
                  />
                </li>
              ))}
            </ul>
          )}
          {!pending && alert.matchCount > OPEN_CARD_MATCHES && (
            <Link
              href={`/alerts/${alert.id}`}
              className="flex min-h-6 items-center self-start text-sm font-bold text-text transition-colors hover:text-lime"
            >
              {t("alerts.viewAllMatches", { count: alert.matchCount })}
            </Link>
          )}
        </motion.div>
      </AnimatePresence>
      <span className="flex items-center justify-between gap-3 text-small text-text-muted">
        <span>{labels.createdOn(alert.createdAt)}</span>
        <button
          type="button"
          onClick={(event) => onDelete(event.currentTarget)}
          className="relative flex cursor-pointer items-center justify-center font-bold text-text transition-colors before:absolute before:size-11 hover:text-lime"
        >
          {t("alerts.deleteShort")}
        </button>
      </span>
    </article>
  );
}

interface AlertMatchCardProps {
  listing: CarListing;
  active: boolean;
  onActiveChange: (active: boolean) => void;
}

/**
 * The alert match card (ALERTUI-8; ListingCard/README.md › Tarjeta de
 * coincidencia): one link to the listing in a new tab, with the 110px photo
 * or the tint, the source as text, the name, «año · km» and the price. No
 * heart and no badge. Hovering or focusing it marks its pin (ALERTUI-17).
 */
function AlertMatchCard({ listing, active, onActiveChange }: AlertMatchCardProps) {
  const t = useTranslations();
  const locale = useLocale();
  const meta = listingMeta(listing, { t, locale }, "none");

  return (
    <a
      href={listing.url}
      target="_blank"
      rel="noopener noreferrer"
      data-active={active || undefined}
      {...activeHandlers(onActiveChange)}
      // ALERTUI-17: the photo's lime ring below is this link's focus
      // indicator — it shows on `group-focus-visible/card` independent of
      // `active` (which follows hover too, MAPUI-28), so the global
      // focus-visible outline is suppressed here unconditionally.
      className="group/card flex min-w-0 flex-col gap-1 rounded-field focus-visible:outline-hidden"
    >
      <CarPhoto
        listing={listing}
        alt=""
        sizes="(min-width: 1280px) 171px, 213px"
        badge={false}
        iconClassName="size-9"
        focusRing
        className={cn("h-27.5 rounded-field transition-[box-shadow]", active && "ring-2 ring-lime")}
      />
      <span className="mt-1 truncate text-xs font-bold text-text-muted">
        {sourceLabel(listing.source)}
      </span>
      <strong className="truncate text-body-15 font-bold text-text">{listing.title}</strong>
      {meta !== "" && (
        <span className="truncate text-small text-text-muted tabular-nums">{meta}</span>
      )}
      <span className="mt-0.5 font-display text-lg font-extrabold text-lime tabular-nums">
        {formatPrice(listing.price, locale)}
      </span>
    </a>
  );
}

interface PhoneAlertCardProps {
  alert: AlertSummary;
}

/**
 * The phone card: one link to the alert's page, with no date, no match and no
 * «Eliminar» (ALERTUI-28). «En pausa» opens its criteria line, so the name
 * keeps the row beside the count at 390px (R3-alertas).
 */
export function PhoneAlertCard({ alert }: PhoneAlertCardProps) {
  const labels = useAlertLabels();
  const ids = cardIds(useId());
  const parts = labels.criteria(alert);
  const paused = !alert.active;

  return (
    <Link
      href={`/alerts/${alert.id}`}
      aria-labelledby={ids.name}
      aria-describedby={describedBy(alert, ids, parts)}
      className="flex min-h-11 min-w-0 flex-col gap-2.5 rounded-card border border-line bg-surface p-4 text-text transition-[background-color] active:bg-surface-strong"
    >
      <AlertNameRow alert={alert} ids={ids} phone />
      {(paused || parts.length > 0) && (
        <span className="flex min-w-0 items-center gap-2">
          {paused && <PausedBadge id={ids.paused} />}
          <CriteriaLine id={ids.criteria} parts={parts} className="text-small" />
        </span>
      )}
    </Link>
  );
}
