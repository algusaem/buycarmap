"use client";

import { useId, useState } from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { AnimatePresence } from "motion/react";
import { Check, ChevronDown } from "lucide-react";

import { PresenceFade } from "@/components/ui/PresenceFade";
import { dropdownReveal } from "@/lib/animations";
import { cn } from "@/lib/utils";

interface CheckboxSelectOption {
  value: string;
  label: string;
}

export interface CheckboxSelectProps {
  label: string;
  options: CheckboxSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  /** Shown in the trigger while nothing is chosen. The caller owns the copy. */
  placeholder?: string;
  /** Put on the trigger, for the browser tests that find it (`/palette`, LOOK-11, LOOK-13). */
  "data-testid"?: string;
}

/**
 * LOOK-21 (docs/specs/redesign-foundation.md), docs/design/system/components/
 * Select/README.md: the design's only select style, always with checkboxes.
 * The trigger is a field that lists the chosen labels separated by commas,
 * truncated with «…», with no counter; the list is a small floating card of
 * 44px options, each with a 20px box that is violet with an on-violet check
 * when chosen.
 *
 * Built on Radix DropdownMenu checkbox items, which give the keyboard model
 * (arrows, Enter/Space, typeahead, Escape and focus return to the trigger).
 * The roles are set to the listbox pattern the design describes —
 * `listbox` with `aria-multiselectable` and `option` with `aria-selected` —
 * and choosing an option keeps the list open so several can be chosen.
 *
 * Opened or closed with a pointer, the list fades and moves 4px over 180ms;
 * opened with Enter, Space or an arrow key, or closed with Escape, it appears
 * and leaves at once (MOTION-18, docs/specs/motion.md).
 */
export function CheckboxSelect({
  label,
  options,
  value,
  onChange,
  placeholder,
  "data-testid": testId,
}: CheckboxSelectProps) {
  const [open, setOpen] = useState(false);
  const labelId = useId();
  const valueId = useId();

  const chosenLabels = value.flatMap((chosen) => {
    const option = options.find((candidate) => candidate.value === chosen);
    return option ? [option.label] : [];
  });

  function toggle(optionValue: string) {
    onChange(
      value.includes(optionValue)
        ? value.filter((chosen) => chosen !== optionValue)
        : [...value, optionValue],
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span id={labelId} className="font-sans text-[13px] font-bold text-text">
        {label}
      </span>
      <DropdownMenuPrimitive.Root open={open} onOpenChange={setOpen}>
        <DropdownMenuPrimitive.Trigger
          data-testid={testId}
          aria-haspopup="listbox"
          aria-labelledby={`${labelId} ${valueId}`}
          className={cn(
            "flex h-13 w-full cursor-pointer items-center justify-between gap-3 rounded-field border border-line bg-bg pr-3.5 pl-4 text-left font-sans text-base text-text",
            // MOTION-5: text-muted on hover while not focused or open, in the state transition.
            "transition-[border-color] not-focus:not-data-[state=open]:hover:border-text-muted focus:border-lime data-[state=open]:border-lime",
            "disabled:pointer-events-none disabled:opacity-50",
          )}
        >
          <span
            id={valueId}
            className={cn("min-w-0 truncate", chosenLabels.length === 0 && "text-text-muted")}
          >
            {chosenLabels.length > 0 ? chosenLabels.join(", ") : placeholder}
          </span>
          <ChevronDown aria-hidden="true" strokeWidth={2.4} className="size-4.5 shrink-0" />
        </DropdownMenuPrimitive.Trigger>

        <AnimatePresence>
          {open && (
            <DropdownMenuPrimitive.Portal forceMount>
              <DropdownMenuPrimitive.Content
                forceMount
                asChild
                role="listbox"
                aria-multiselectable="true"
                aria-labelledby={labelId}
                align="start"
                sideOffset={6}
                className="z-50 flex min-w-(--radix-dropdown-menu-trigger-width) flex-col gap-0.5 rounded-field border border-line bg-surface p-1.5 font-sans text-text shadow-float"
              >
                <PresenceFade preset={dropdownReveal}>
                  {options.map((option) => (
                    <CheckboxOption
                      key={option.value}
                      option={option}
                      selected={value.includes(option.value)}
                      onToggle={toggle}
                    />
                  ))}
                </PresenceFade>
              </DropdownMenuPrimitive.Content>
            </DropdownMenuPrimitive.Portal>
          )}
        </AnimatePresence>
      </DropdownMenuPrimitive.Root>
    </div>
  );
}

interface CheckboxOptionProps {
  option: CheckboxSelectOption;
  selected: boolean;
  onToggle: (value: string) => void;
}

function CheckboxOption({ option, selected, onToggle }: CheckboxOptionProps) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      role="option"
      aria-selected={selected}
      checked={selected}
      onCheckedChange={() => onToggle(option.value)}
      // Keeps the list open after a choice: this select picks several values.
      onSelect={(event) => event.preventDefault()}
      className={cn(
        "flex h-11 cursor-pointer select-none items-center gap-3 rounded-option pr-3 pl-3.5 text-body-15 font-medium",
        // MOTION-22: the arrow keys move the highlight at once, with no transition.
        "data-[highlighted]:bg-surface-strong",
        selected && "font-bold",
      )}
    >
      <span
        data-checkbox=""
        data-state={selected ? "checked" : "unchecked"}
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-[6px] border-[1.5px]",
          selected ? "border-violet bg-violet text-on-violet" : "border-text-muted",
        )}
      >
        {selected && <Check aria-hidden="true" strokeWidth={3.2} className="size-3.5" />}
      </span>
      {option.label}
    </DropdownMenuPrimitive.CheckboxItem>
  );
}
