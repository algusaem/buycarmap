"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

// docs/design/system/components/SearchPopover/README.md and FilterSheet: the
// single-choice groups of the search and the filters panel — the radius chips
// (MAPUI-4), the price shortcuts (MAPUI-11) and the «Cambio» segmented control
// (MAPUI-16). Native radios, so the browser gives the radio-group keyboard
// model (Tab reaches the chosen option, the arrows move and choose), drawn as
// chips over a visually hidden input.
//
// - `chips`: violet with on-violet text and weight 800 when chosen, a `line`
//   border at weight 600 otherwise. `stretch` shares the width at 44px tall
//   (the radii); otherwise padding 10px 16px with a 44px-tall hit area (the
//   shortcuts).
// - `segmented`: a `surface` pill with 4px of padding; the chosen option is
//   inverted, `text` fill with `bg` text and weight 800. Each option is drawn
//   40px tall and keeps a 44px-tall hit area (RULES §19) with the same
//   centred pseudo-element as the shortcut chips.
//
// An unchecked chip turns its border to text-muted on hover, and every option
// scales to 0.97 while pressed, off under reduced motion (MOTION-5).
interface RadioChipOption<T extends string | number> {
  value: T;
  label: string;
}

interface RadioChipsProps<T extends string | number> {
  label: string;
  options: RadioChipOption<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
  variant: "chips" | "segmented";
  stretch?: boolean;
  disabled?: boolean;
}

export function RadioChips<T extends string | number>({
  label,
  options,
  value,
  onChange,
  variant,
  stretch = false,
  disabled = false,
}: RadioChipsProps<T>) {
  const name = useId();

  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled || undefined}
      className={cn(
        "flex gap-2",
        variant === "chips" && !stretch && "flex-wrap",
        variant === "segmented" && "gap-0 rounded-pill border border-line bg-surface p-1",
        disabled && "opacity-40",
      )}
    >
      {options.map((option) => {
        const checked = option.value === value;
        return (
          <label
            key={option.value}
            className={cn(
              "flex cursor-pointer items-center justify-center whitespace-nowrap rounded-pill font-sans text-sm transition-[background-color,border-color,color,scale] active:scale-97 motion-reduce:active:scale-none",
              "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-lime",
              disabled && "cursor-not-allowed",
              variant === "chips" && "border",
              variant === "chips" && stretch && "h-11 flex-1",
              variant === "chips" &&
                !stretch &&
                "relative px-4 py-2.5 before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2",
              variant === "chips" &&
                (checked
                  ? "border-transparent bg-violet font-extrabold text-on-violet"
                  : "border-line font-semibold text-text hover:border-text-muted"),
              variant === "segmented" &&
                "relative flex-1 p-2.5 before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2",
              variant === "segmented" &&
                (checked ? "bg-text font-extrabold text-bg" : "font-semibold text-text"),
            )}
          >
            <input
              type="radio"
              name={name}
              value={String(option.value)}
              checked={checked}
              disabled={disabled}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        );
      })}
    </div>
  );
}
