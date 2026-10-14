"use client";

import type {
  ComponentProps,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  ReactNode,
  Ref,
} from "react";
import { AnimatePresence, useIsPresent } from "motion/react";
import * as motion from "motion/react-client";
import { Check, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { crossFade } from "@/lib/animations";
import { cn } from "@/lib/utils";

// docs/design/system/components/SearchPopover/README.md: the pieces «Dónde»
// and «Coche» share, in the popovers, the «BUSCAR» sheet and the filters
// panel's «Marca y modelo».
//
// - SearchField: 52px, `bg` fill, `line` border (`lime` with focus, plus the
//   2px lime focus ring of LOOK-11 on the field), `radius-field`, the 18px
//   magnifier in `text-muted` and the text at 16px. With text, a 44px «Borrar
//   texto» button on the right.
// - ComboOption: a 44px option, 15px weight 500, `radius-option`; hovered or
//   highlighted in `surface-strong`; chosen at weight 700 with an 18px violet
//   check on the right, without filling the row.
// - NoMatch and ListStatus: the no-match line in place of the list (MAPUI-56)
//   and the polite status that announces it, or the count, mounted from the
//   start so its first announcement is not lost.
// - SectionLabel: `section-label`, 12px weight 700, uppercase, `text-muted`.

/**
 * Radix's `onEscapeKeyDown` for a popover or dialog holding a combobox: while
 * the combobox's listbox shows, Escape closes only the listbox (the field's own
 * key handler does that), and a second Escape closes the layer (MAPUI-2,
 * MAPUI-21). Radix hears Escape before the field does, so the field still
 * reads expanded here.
 */
export function closeListboxFirst(event: KeyboardEvent) {
  const target = event.target;
  if (
    target instanceof HTMLElement &&
    target.getAttribute("role") === "combobox" &&
    target.getAttribute("aria-expanded") === "true"
  ) {
    event.preventDefault();
  }
}

interface SearchFieldProps
  extends Omit<ComponentProps<"input">, "className" | "type" | "role" | "onChange"> {
  ref?: Ref<HTMLInputElement>;
  /** Whether its listbox is showing. */
  expanded: boolean;
  value: string;
  onValueChange: (value: string) => void;
  onClearText: () => void;
}

export function SearchField({
  ref,
  expanded,
  value,
  onValueChange,
  onClearText,
  ...inputProps
}: SearchFieldProps) {
  const t = useTranslations();

  return (
    <div className="flex h-13 items-center gap-2.5 rounded-field border border-line bg-bg pr-1 pl-4 text-text-muted transition-[border-color] focus-within:border-lime has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-3 has-[input:focus-visible]:outline-lime">
      <Search aria-hidden="true" strokeWidth={2.4} className="size-4.5 shrink-0" />
      <input
        ref={ref}
        type="text"
        role="combobox"
        aria-expanded={expanded}
        autoComplete="off"
        spellCheck={false}
        aria-autocomplete="list"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        className="h-full min-w-0 flex-1 bg-transparent font-sans text-base text-text outline-none placeholder:text-text-muted focus-visible:outline-none"
        {...inputProps}
      />
      <AnimatePresence initial={false}>
        {value !== "" && (
          <motion.button
            key="clear"
            type="button"
            aria-label={t("search.clearText")}
            onClick={onClearText}
            className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-pill text-text-muted"
            {...crossFade}
          >
            <X aria-hidden="true" strokeWidth={2.4} className="size-4" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

interface AnimatedListboxProps {
  id: string;
  label: string;
  className?: string;
  children: ReactNode;
}

/**
 * The listbox wrapper CarTypeahead's CarListbox and PlaceField's PlaceListbox
 * both animate out the same way: while present, this is the interactive
 * listbox; while AnimatePresence keeps it mounted to animate it out,
 * `useIsPresent()` flips and it renders inert — no role or id to claim the
 * listbox semantics, `aria-hidden` so screen readers skip it, and no
 * handlers, so a press on a still-fading option cannot choose it (MAP-20).
 * The caller reads the same `useIsPresent()` itself to pass each option's own
 * `interactive` prop (ComboOption).
 */
export function AnimatedListbox({ id, label, className, children }: AnimatedListboxProps) {
  const isPresent = useIsPresent();

  return (
    <motion.div
      id={isPresent ? id : undefined}
      role={isPresent ? "listbox" : undefined}
      aria-label={isPresent ? label : undefined}
      aria-hidden={isPresent ? undefined : "true"}
      inert={isPresent ? undefined : true}
      className={cn("flex flex-col", !isPresent && "pointer-events-none", className)}
      {...crossFade}
    >
      {children}
    </motion.div>
  );
}

interface ComboOptionProps {
  id: string;
  label: string;
  secondary?: string;
  selected: boolean;
  highlighted: boolean;
  /**
   * False while its listbox animates out: the same look, with no role, id or
   * handlers, so a fading option is not an option and a press on it chooses
   * nothing (MAP-20).
   */
  interactive?: boolean;
  onChoose: () => void;
  onHighlight: () => void;
}

export function ComboOption({
  id,
  label,
  secondary,
  selected,
  highlighted,
  interactive = true,
  onChoose,
  onHighlight,
}: ComboOptionProps) {
  return (
    <div
      tabIndex={-1}
      className={cn(
        "flex min-h-11 cursor-pointer items-center gap-3 rounded-option py-2 pr-3 pl-3.5 text-body-15 font-medium text-text",
        highlighted && "bg-surface-strong",
        selected && "font-bold",
      )}
      {...(interactive
        ? {
            id,
            role: "option" as const,
            "aria-selected": selected,
            // The field keeps the focus while an option is pressed.
            onMouseDown: (event: ReactMouseEvent<HTMLDivElement>) => event.preventDefault(),
            onClick: onChoose,
            onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => {
              // The field drives the options from the keyboard; an option that
              // received focus still answers Enter and Space.
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onChoose();
              }
            },
            onMouseEnter: onHighlight,
          }
        : {})}
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate">{label}</span>
        {secondary && (
          <span className="truncate text-small leading-normal font-normal text-text-muted">
            {secondary}
          </span>
        )}
      </span>
      <AnimatePresence initial={false}>
        {selected && (
          <motion.span key="check" aria-hidden="true" className="flex shrink-0" {...crossFade}>
            <Check strokeWidth={2.4} className="size-4.5 text-violet" />
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

interface NoMatchProps {
  children: string;
}

/** The no-match line, in place of the list (MAPUI-56); the status announces it. */
export function NoMatch({ children }: NoMatchProps) {
  return (
    <motion.p aria-hidden="true" className="m-0 px-3.5 text-body-15 text-text-muted" {...crossFade}>
      {children}
    </motion.p>
  );
}

interface ListStatusProps {
  children: string;
}

/** The field's polite status: empty, «Cargando…», the count or the no-match line. */
export function ListStatus({ children }: ListStatusProps) {
  return (
    <p role="status" aria-live="polite" className="sr-only">
      {children}
    </p>
  );
}

interface SectionLabelProps {
  id?: string;
  children: ReactNode;
}

export function SectionLabel({ id, children }: SectionLabelProps) {
  return (
    <span
      id={id}
      className="font-sans text-section-label leading-4 font-bold uppercase text-text-muted"
    >
      {children}
    </span>
  );
}
