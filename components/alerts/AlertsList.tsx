"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BellRing, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteAlert } from "@/server/alerts/actions";
import type { AlertSummary } from "@/interfaces/alert";
import type { SearchInput } from "@/lib/search/schema";
import { useTranslations, useLocale, useMessages } from "next-intl";
import { translateError } from "@/lib/i18n/errors";
import type { Translations } from "@/lib/i18n/types";
import { formatMileage, formatPrice } from "@/lib/format";

interface AlertsListProps {
  alerts: AlertSummary[];
}

/**
 * Turns a saved SearchInput into something readable.
 *
 * The stored criteria are unreadable as JSON, and someone with several alerts
 * has to be able to tell them apart at a glance.
 */
function summarise(criteria: SearchInput, locale: string): string {
  const parts: string[] = [];

  if (criteria.brand) parts.push(criteria.brand);
  if (criteria.model) parts.push(criteria.model);
  if (criteria.maxPrice != null) {
    parts.push(`≤ ${formatPrice(criteria.maxPrice, locale)}`);
  }
  if (criteria.minYear != null) parts.push(`${criteria.minYear}+`);
  if (criteria.maxKm != null) {
    parts.push(`≤ ${formatMileage(criteria.maxKm, locale)}`);
  }
  if (criteria.latitude != null && criteria.distanceInKm != null) {
    parts.push(`${criteria.distanceInKm} km`);
  }

  return parts.join(" · ");
}

function EmptyState() {
  const t = useTranslations();

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <BellRing className="h-10 w-10 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">{t("alerts.empty")}</p>
      {/* No dead ends: the empty state has to lead somewhere. */}
      <Link
        href="/map"
        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
      >
        {t("alerts.emptyCta")}
      </Link>
    </div>
  );
}

function AlertRow({ alert }: { alert: AlertSummary }) {
  const t = useTranslations();
  const locale = useLocale();
  const messages = useMessages() as Translations;
  const router = useRouter();
  const [removing, setRemoving] = useState(false);

  async function remove() {
    setRemoving(true);

    try {
      const result = await deleteAlert(alert.id);
      if (!result.ok) {
        setRemoving(false);
        toast.error(translateError(messages, result.error.messageKey));
        return;
      }
      router.refresh();
    } catch {
      // An unexpected failure — a thrown database or network error (PLAT-12,
      // docs/specs/core-platform.md) — reads the same generic copy the auth
      // forms use, since there is nothing more specific to say about it.
      setRemoving(false);
      toast.error(t("alertErrors.unexpected"));
    }
  }

  return (
    <article className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
      <div className="min-w-0 flex-1">
        <Link
          href={`/alerts/${alert.id}`}
          className="block truncate text-sm font-semibold text-foreground hover:underline"
        >
          {alert.label}
        </Link>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {summarise(alert.criteria, locale)}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          {/* tabular-nums so counts line up down the list */}
          <span className="font-semibold tabular-nums text-foreground">{alert.matchCount}</span>{" "}
          {t("alerts.matchCount")}
          {/* Not colour alone — an unsubscribed alert says so in words, and is
              shown rather than hidden so nobody wonders where it went. */}
          {!alert.active && <span className="ml-2">· {t("alerts.inactive")}</span>}
        </p>
      </div>
      <button
        type="button"
        onClick={remove}
        disabled={removing}
        aria-label={t("alerts.delete")}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </article>
  );
}

export function AlertsList({ alerts }: AlertsListProps) {
  if (alerts.length === 0) return <EmptyState />;

  return (
    <div className="flex flex-col gap-3">
      {alerts.map((alert) => (
        <AlertRow key={alert.id} alert={alert} />
      ))}
    </div>
  );
}
