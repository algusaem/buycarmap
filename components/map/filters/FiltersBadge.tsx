"use client";

import * as motion from "motion/react-client";
import { AnimatePresence } from "motion/react";
import { useTranslations } from "next-intl";
import { crossFade } from "@/lib/animations";
import { usePresenceMotion } from "@/lib/hooks/usePresenceMotion";
import { cn } from "@/lib/utils";

// docs/specs/redesign-map.md (MAPUI-13, MAPUI-64, MAPUI-67). «Filtros»'s
// violet badge, shared by the desktop row (FilterRow.tsx) and the phone band
// (PhoneSearchBar.tsx): none shows no badge, and the badge fades in and out,
// at once when a key caused the change (MOTION-23, usePresenceMotion).
// It is always `aria-hidden`, and while a criterion is active it also renders
// the sr-only `map.filtersActive` span its caller's button points to with
// `aria-describedby` — the phone band positions the badge at the button's
// corner, the desktop one inline after the visible «Filtros» text.
export interface FiltersBadgeProps {
  count: number;
  descriptionId: string;
  className?: string;
}

export function FiltersBadge({ count, descriptionId, className }: FiltersBadgeProps) {
  const t = useTranslations();

  return (
    <>
      <AnimatePresence initial={false}>
        {count > 0 && <Badge key="badge" count={count} className={className} />}
      </AnimatePresence>
      {count > 0 && (
        <span id={descriptionId} className="sr-only">
          {t("map.filtersActive", { count })}
        </span>
      )}
    </>
  );
}

interface BadgeProps {
  count: number;
  className?: string;
}

/** The drawn badge, inside FiltersBadge's AnimatePresence. */
function Badge({ count, className }: BadgeProps) {
  const fade = usePresenceMotion(crossFade);

  return (
    <motion.span
      {...fade}
      aria-hidden="true"
      className={cn(
        "rounded-pill bg-violet px-2 py-px text-xs font-extrabold text-on-violet",
        className,
      )}
    >
      {count}
    </motion.span>
  );
}
