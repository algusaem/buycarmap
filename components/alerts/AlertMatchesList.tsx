"use client";

import Link from "next/link";
import { ArrowLeft, BellRing } from "lucide-react";
import type { AlertMatch } from "@/interfaces/alert";
import { CarListingCard } from "@/components/map/CarListingCard";
import { useTranslation } from "@/lib/i18n/client";

interface AlertMatchesListProps {
  alertLabel: string;
  matches: AlertMatch[];
}

function EmptyState() {
  const { t } = useTranslation();

  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-4 py-24 text-center"
    >
      <BellRing className="h-10 w-10 text-muted-foreground/40" />
      {/* "Nothing yet" and "broken" look identical without saying which. */}
      <p className="text-sm text-muted-foreground">{t.alerts.noMatchesYet}</p>
    </div>
  );
}

export function AlertMatchesList({ alertLabel, matches }: AlertMatchesListProps) {
  const { t } = useTranslation();

  // Newest first here rather than relying on the order received, so the page is
  // right whatever the caller hands it.
  const ordered = [...matches].sort((a, b) => b.foundAt.getTime() - a.foundAt.getTime());

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/alerts"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t.alerts.backToAlerts}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">{alertLabel}</h1>
      </div>

      {ordered.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {ordered.map((match) => (
            <CarListingCard key={match.id} {...match} />
          ))}
        </div>
      )}
    </div>
  );
}
