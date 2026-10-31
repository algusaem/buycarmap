"use client";

import { type ChangeEvent, type KeyboardEvent, useId, useState } from "react";
import { useLocale } from "next-intl";
import { formatAmount } from "@/lib/format";

// docs/design/system/components/FilterSheet/README.md (Precio, Kilómetros,
// Año): the number boxes of the price range («Mínimo», «Máximo») and of
// the filters panel's «Kilómetros» («Mínimo», «Máximo») and «Año»
// («Desde»). `surface`, `line`
// border (`lime` with focus, plus LOOK-11's 2px lime ring on the box),
// `radius-field`, padding 10px 14px; the visible label at 11px `text-muted`
// over the value at 16px, so a phone never zooms into it. The caller owns the
// value: `onValueChange` reports each edit, `onCommit` the box losing focus
// and Enter. While not focused, hover turns the border text-muted (MOTION-5).
//
// `type="text"` (MAPUI-11), not `type="number"`: a `grouped` box reads with
// the thousands point while not focused (`formatAmount`), which a number
// input's own formatting cannot show. While focused the box always shows
// exactly what is typed until Enter applies it, so formatting never fights the caret.
interface NumberBoxProps {
  name: string;
  label: string;
  value: number | undefined;
  placeholder?: string;
  /** Shown after the value, e.g. the euro sign. Always shown once given,
   * unless `suffixOnlyWithValue`. */
  suffix?: string;
  /** MAPUI-84: for «Kilómetros»'s «Mínimo» and «Máximo», the «km» suffix
   * shows only once the box has a value, never beside the placeholder —
   * unlike the price boxes' «€», which this leaves alone. */
  suffixOnlyWithValue?: boolean;
  /** MAPUI-11: reads with the thousands point while not focused — the price boxes and «Kilómetros»'s «Mínimo» and «Máximo», never «Año»'s «Desde». */
  grouped?: boolean;
  onValueChange: (value: number | undefined) => void;
  onCommit: () => void;
}

type ParsedAmount = { kind: "value"; amount: number } | { kind: "empty" } | { kind: "unreadable" };

/** A typed amount: empty clears the criterion, a whole number of at least 0
 * applies, anything else («abc», «-5», «1.2.3x») is unreadable — it is kept
 * out of `onValueChange` entirely, not read as empty. */
function parseAmount(text: string): ParsedAmount {
  const cleaned = text.replace(/[.,\s]/g, "");
  if (cleaned === "") return { kind: "empty" };
  const amount = Number(cleaned);
  if (!Number.isFinite(amount) || amount < 0) return { kind: "unreadable" };
  return { kind: "value", amount: Math.round(amount) };
}

/** What the box shows while not focused: grouped with the thousands point, or the plain amount. */
function displayValue(value: number | undefined, grouped: boolean, locale: string): string {
  if (value == null) return "";
  return grouped ? formatAmount(value, locale) : String(value);
}

export function NumberBox({
  name,
  label,
  value,
  placeholder,
  suffix,
  suffixOnlyWithValue = false,
  grouped = false,
  onValueChange,
  onCommit,
}: NumberBoxProps) {
  const id = useId();
  const locale = useLocale();
  // What is currently typed, while the box is being edited; `null` once it
  // is not (reset on focus, blur and Enter), so the box falls back to showing
  // `value` — the committed amount again when what was last typed could not
  // be read, since that never reached `onValueChange` to begin with.
  const [typedText, setTypedText] = useState<string | null>(null);

  const text = typedText ?? displayValue(value, grouped, locale);

  function handleFocus() {
    setTypedText(null);
  }

  function handleBlur() {
    setTypedText(null);
    onCommit();
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const typed = event.target.value;
    setTypedText(typed);
    const parsed = parseAmount(typed);
    if (parsed.kind === "unreadable") return;
    onValueChange(parsed.kind === "empty" ? undefined : parsed.amount);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    onCommit();
    // Same as handleBlur (MAPUI-86, amended 2026-10-31): once Enter applies
    // the committed amount — swapped or not — the box falls back to showing
    // it formatted, rather than leaving what was typed on screen.
    setTypedText(null);
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col rounded-field border border-line bg-surface px-3.5 py-2.5 transition-[border-color] not-focus-within:hover:border-text-muted focus-within:border-lime has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-3 has-[input:focus-visible]:outline-lime">
      <label htmlFor={id} className="font-sans text-box-label text-text-muted">
        {label}
      </label>
      <span className="flex items-baseline gap-1 font-sans text-base font-bold text-text">
        <input
          id={id}
          name={name}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder={placeholder}
          value={text}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="w-full min-w-0 bg-transparent outline-none placeholder:text-text-muted focus-visible:outline-none"
        />
        {suffix && (!suffixOnlyWithValue || text !== "") && (
          <span aria-hidden="true">{suffix}</span>
        )}
      </span>
    </div>
  );
}
