"use client";

import { useRef } from "react";
import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useDescriptionDraft } from "@/lib/hooks/useDescriptionDraft";
import { KEYWORDS_MAX_LENGTH } from "@/lib/search/schema";
import { cn } from "@/lib/utils";

// docs/specs/map-description-search.md (Key DESC). The filter row's own
// field (DESC-1): 240×34, `rounded-pill`, `line` border (`lime` with focus,
// `violet` once the shown text is applied), 13px text, weight 800 once
// applied — 16px on a coarse pointer, since the row renders from 1024px and
// an iPad in landscape still gets it (LOOK-13's exception). No listbox:
// typing is a free text, not a choice from a list.

export interface DescriptionFieldProps {
  /** The applied, trimmed text — "" when nothing is applied. */
  applied: string;
  /**
   * Changes whenever the hook discards the typed draft out from under this
   * field (Back/Forward, «Borrar» or «Quitar filtros», DESC-15, DESC-19) —
   * anything other than `applied` changing or this field's own Enter and
   * «Borrar texto». Optional only so a caller with no such discard (FilterRow's
   * own isolation tests) can leave it out.
   */
  resetKey?: number;
  /** Called with the trimmed text on Enter (DESC-6) or «Borrar texto» (DESC-9). */
  onApply: (text: string) => void;
  /** Called with every keystroke's raw value, so the hook can carry the
   * unconfirmed draft into «Buscar» (DESC-8). */
  onDraftChange?: (value: string) => void;
}

export function DescriptionField({
  applied,
  resetKey,
  onApply,
  onDraftChange,
}: DescriptionFieldProps) {
  const t = useTranslations();
  const inputRef = useRef<HTMLInputElement>(null);
  const { value, setValue, trimmed, isApplied } = useDescriptionDraft(applied, resetKey);

  // Updates the shown value and notes the draft, together, every time either
  // changes — typing, Escape (discards it back to `applied`) and «Borrar
  // texto» (empties it).
  function edit(next: string) {
    setValue(next);
    onDraftChange?.(next);
  }

  return (
    <div
      data-applied={isApplied || undefined}
      className={cn(
        "group/field flex h-8.5 w-60 shrink-0 items-center gap-2 rounded-pill border border-line pl-3 text-text-muted",
        "transition-[border-color] not-focus-within:hover:border-text-muted focus-within:border-lime",
        "has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-3 has-[input:focus-visible]:outline-lime",
        "not-focus-within:data-[applied]:border-violet",
      )}
    >
      <Search aria-hidden="true" strokeWidth={2.4} className="size-4 shrink-0" />
      <input
        ref={inputRef}
        type="search"
        name="q"
        aria-label={t("search.descriptionField")}
        placeholder={t("search.descriptionPlaceholder")}
        maxLength={KEYWORDS_MAX_LENGTH}
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(event) => edit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") onApply(trimmed);
          if (event.key === "Escape") {
            event.preventDefault();
            edit(applied);
          }
        }}
        className={cn(
          // LOOK-11's ring goes around the pill, as in Combobox, not around the input.
          "h-full min-w-0 flex-1 bg-transparent font-sans text-small font-semibold text-text outline-none focus-visible:outline-none",
          "placeholder:text-text-muted",
          "pointer-coarse:text-base",
          "[&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden",
          "group-data-[applied]/field:font-extrabold",
          // The clear button sits closer to the pill's edge than the text does, so
          // the trailing padding belongs to the input, and only while it has no button.
          value === "" && "pr-3",
        )}
      />
      {value !== "" && (
        <button
          type="button"
          aria-label={t("search.clearText")}
          onClick={() => {
            edit("");
            if (applied !== "") onApply("");
            inputRef.current?.focus();
          }}
          className="relative mr-1 flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-pill text-text-muted transition-[color,scale] before:absolute before:size-11 hover:text-text active:scale-97 motion-reduce:active:scale-none"
        >
          <X aria-hidden="true" strokeWidth={2.4} className="size-3.5" />
        </button>
      )}
    </div>
  );
}
