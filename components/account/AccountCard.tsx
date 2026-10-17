import type { ReactNode, RefObject } from "react";
import { AnimatePresence } from "motion/react";
import * as motion from "motion/react-client";
import { crossFade } from "@/lib/animations";
import { cn } from "@/lib/utils";

// docs/specs/redesign-pages.md (PAGES-25 to PAGES-37); AccountCard/README.md.
// Every block of /account: `surface`, a `line` border, `radius-card`, 24px of
// padding with 12px between its pieces and at least 196px tall on desktop (18px
// and no minimum on the phone). On top a row of at least 26px with the title
// in Unbounded 16 capitals (14 on the phone) and, right, the badge; in the
// middle the muted line; at the bottom its one button. The card is a region
// named by its title (the own card by its heading, PAGES-29). «Eliminar
// cuenta» draws its title and border in `danger` and spans two columns. A
// badge or a button that comes or goes after an action fades (the Google
// card after «Desconectar», PAGES-53). The actions row is drawn only when the
// card has an action: a card with none (the Google-only «Correo») ends on its
// line.

interface AccountCardProps {
  title: string;
  badge?: ReactNode;
  /** The muted line under the title. */
  line?: ReactNode;
  /** The line's id, for a button it describes (the disabled «Desconectar», PAGES-34). */
  lineId?: string;
  /** `danger`: «Eliminar cuenta», its title in danger and its border at 35 %. */
  tone?: "danger";
  /** Two columns of the desktop grid (PAGES-28). */
  wide?: boolean;
  /**
   * The title, focusable from script only, for a card whose button goes away
   * after it is pressed (the Google card after «Desconectar», PAGES-76).
   */
  headingRef?: RefObject<HTMLHeadingElement | null>;
  children?: ReactNode;
}

export function AccountCard({
  title,
  badge,
  line,
  lineId,
  tone,
  wide = false,
  headingRef,
  children,
}: AccountCardProps) {
  return (
    <section aria-label={title} className={cardClasses(tone, wide)}>
      <div className="flex min-h-6.5 items-center justify-between gap-3">
        <h2
          ref={headingRef}
          tabIndex={headingRef ? -1 : undefined}
          className={cn(
            "m-0 min-w-0 font-display text-sm font-extrabold uppercase wrap-break-word lg:text-card-title",
            tone === "danger" && "text-danger",
          )}
        >
          {title}
        </h2>
        <AnimatePresence initial={false}>
          {badge && (
            <motion.span key="badge" {...crossFade} className="flex shrink-0">
              {badge}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      {line && (
        <p id={lineId} className="m-0 text-meta leading-normal text-text-muted">
          {line}
        </p>
      )}
      <AnimatePresence initial={false}>
        {children && (
          <motion.div
            key="actions"
            {...crossFade}
            className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2.5 pt-1"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

/** The card's frame, shared with the own card (OwnCard), which is named by its heading instead. */
export function cardClasses(tone?: "danger", wide = false) {
  return cn(
    "flex min-w-0 flex-col gap-3 rounded-card border bg-surface p-4.5 lg:min-h-49 lg:p-6",
    tone === "danger" ? "border-danger/35" : "border-line",
    wide && "lg:col-span-2",
  );
}

interface CardBadgeProps {
  /** `on`: something active, «Verificado», «Conectada», «Activada», in violet; otherwise outlined. */
  on: boolean;
  children: ReactNode;
}

/** The title row's badge: 12px weight 800, 5px 10px, a pill. */
export function CardBadge({ on, children }: CardBadgeProps) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-pill px-2.5 py-1.25 text-caption font-extrabold whitespace-nowrap",
        on ? "bg-violet text-on-violet" : "border border-line text-text-muted",
      )}
    >
      {children}
    </span>
  );
}
