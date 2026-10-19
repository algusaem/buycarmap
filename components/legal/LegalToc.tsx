"use client";

import { useId, type MouseEvent } from "react";
import { AnimatePresence, type HTMLMotionProps } from "motion/react";
import * as motion from "motion/react-client";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { dropdownReveal } from "@/lib/animations";
import { usePresenceMotion } from "@/lib/hooks/usePresenceMotion";
import { cn } from "@/lib/utils";

interface TocSection {
  id: string;
  heading: string;
}

interface LegalTocProps {
  sections: readonly TocSection[];
  /** The id of the section on screen. */
  current: string;
  open: boolean;
  showList: boolean;
  /** Hides the list below `lg` with CSS, before the phone width is known. */
  foldWithCss: boolean;
  onToggle: () => void;
  onSelect: (id: string) => void;
  onListExitComplete: () => void;
}

// docs/specs/redesign-pages.md (PAGES-62, PAGES-63, PAGES-74);
// docs/design/system/components/LegalToc/README.md. One index for both
// widths, so each section has one link: from `lg` a 260px column, sticky
// beside the text, under «En esta página» at 12px; on a phone a `surface`
// field after the date whose button opens the same list inside it, under a
// `line-soft` divider. The section on screen is in `text` with the 2px lime
// bar and `aria-current="location"`; the others in `text-muted`. The phone
// list folds over 180ms when a pointer chooses a section, and at once when a
// key does (MOTION-15); either way its exit's end runs the jump. A list CSS
// folds below `lg` (`foldWithCss`) leaves at once: nothing of it is seen.
export function LegalToc({
  sections,
  current,
  open,
  showList,
  foldWithCss,
  onToggle,
  onSelect,
  onListExitComplete,
}: LegalTocProps) {
  const t = useTranslations("legal");
  const listId = useId();

  const go = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault();
    onSelect(id);
  };

  return (
    <nav
      aria-label={t("onThisPage")}
      className="rounded-field border border-line bg-surface lg:sticky lg:top-7.5 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:self-start lg:rounded-none lg:border-0 lg:bg-transparent"
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={onToggle}
        className="flex min-h-11 w-full touch-manipulation items-center justify-between rounded-field px-4 py-3 text-label font-bold text-text transition-[background-color,scale] hover:bg-surface-strong active:scale-97 motion-reduce:active:scale-none lg:hidden"
      >
        {t("onThisPage")}
        <ChevronDown
          aria-hidden="true"
          className={cn("size-4.5 transition-transform", open && "rotate-180")}
        />
      </button>
      <p aria-hidden="true" className="mb-2 hidden text-caption font-bold text-text-muted lg:block">
        {t("onThisPage")}
      </p>
      <AnimatePresence initial={false} onExitComplete={onListExitComplete}>
        {showList && (
          <TocList
            key="toc"
            id={listId}
            instantExit={foldWithCss}
            className={cn(
              "flex flex-col border-t border-line-soft px-4 py-2 lg:gap-1.5 lg:border-0 lg:p-0",
              foldWithCss && "max-lg:hidden",
            )}
          >
            {sections.map((section) => {
              const isCurrent = section.id === current;
              return (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    aria-current={isCurrent ? "location" : undefined}
                    onClick={(event) => go(event, section.id)}
                    className={cn(
                      "flex min-h-8 items-center py-1.75 text-label font-semibold transition-colors hover:text-text max-lg:min-h-11",
                      isCurrent
                        ? "border-l-2 border-lime pl-3 text-text"
                        : "pl-3.5 text-text-muted",
                    )}
                  >
                    {section.heading}
                  </a>
                </li>
              );
            })}
          </TocList>
        )}
      </AnimatePresence>
    </nav>
  );
}

interface TocListProps extends HTMLMotionProps<"ul"> {
  /** It leaves at once whatever the input: CSS hides it, so its fold is never seen. */
  instantExit: boolean;
}

/** The list's fold, instant from the keyboard (usePresenceMotion). */
function TocList({ instantExit, ...props }: TocListProps) {
  const reveal = usePresenceMotion(dropdownReveal, instantExit);

  return <motion.ul {...reveal} {...props} />;
}
